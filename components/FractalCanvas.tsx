'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGesture } from '@use-gesture/react';
import {
  Cpu,
  Layers,
  Square,
  XCircle,
  Zap,
  Sparkles,
  Shuffle,
  RotateCcw,
  Sliders,
  FastForward,
  Maximize2,
  Eye,
  EyeOff,
  Download,
  Share2,
  CheckCircle2,
} from 'lucide-react';
import {
  formatFileSize,
  triggerDirectVideoDownload,
  triggerNativePhoneShare,
} from './VideoExportDrawer';
import {
  buildFractalFragmentShader,
  buildFractalVertexShader,
  UPSCALE_CAS_FRAGMENT_SHADER,
} from '@/lib/fractal-shaders';
import { audioEngine } from '@/lib/audio-engine';
import {
  computeDynamicRenderScale,
  computeRgbaDepthMapInPlace,
  computeZoomDirectionMultiplier,
  formatTimestamp,
  getActiveChoreographyKeyframe,
  getExportResolutionDimensions,
  getPreviewResolutionDimensions,
} from '@/lib/dsp-math';
import { transientState, useStudioStore } from '@/lib/store';
import { FRACTAL_MODE_INFO } from '@/lib/presets';
import {
  FractalMode,
  PrecomputedAudioFrame,
  SubFrameMotionBlur,
  VideoQualityPreset,
} from '@/lib/types';

export interface DecoupledExportSession {
  exportCanvas: HTMLCanvasElement;
  exportStream: MediaStream;
  exportRenderTarget: THREE.WebGLRenderTarget;
  width: number;
  height: number;
  getCapturedFrames: () => number;
  getDroppedFrames: () => number;
  stopSession: () => void;
}

// Global hooks for Deterministic Offline Frame-by-Frame Renderer & Live Clip Recorder
let activeWebGlCanvas: HTMLCanvasElement | null = null;
let startDecoupledRenderTargetSession:
  | ((width: number, height: number, recommendedScale?: number) => DecoupledExportSession | null)
  | null = null;
let setWebGlVideoQualitySize:
  | ((quality: VideoQualityPreset) => { width: number; height: number } | null)
  | null = null;
let beginOfflineSessionHook: ((width: number, height: number) => HTMLCanvasElement | null) | null =
  null;
let renderExactFrameAtTimeHook:
  | ((
      t: number,
      audioDataAtT: PrecomputedAudioFrame,
      targetWidth: number,
      targetHeight: number,
      subFrameBlur?: SubFrameMotionBlur
    ) => HTMLCanvasElement | null)
  | null = null;
let endOfflineSessionHook: (() => void) | null = null;
let externalStopExportHook: (() => void) | null = null;

export function registerExternalStopExportHook(fn: () => void) {
  externalStopExportHook = fn;
}

export function getActiveVisualizerCanvas(): HTMLCanvasElement | null {
  return activeWebGlCanvas;
}

export function captureCanvasThumbnailDataUrl(
  width = 160,
  height = 90
): string | undefined {
  if (!activeWebGlCanvas || typeof document === 'undefined') return undefined;
  try {
    const thumb = document.createElement('canvas');
    thumb.width = width;
    thumb.height = height;
    const ctx = thumb.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(activeWebGlCanvas, 0, 0, width, height);
    return thumb.toDataURL('image/webp', 0.65);
  } catch {
    return undefined;
  }
}

export function applyVideoQualityRenderSize(
  quality: VideoQualityPreset
): { width: number; height: number } | null {
  useStudioStore.getState().setVideoQuality(quality);
  if (!setWebGlVideoQualitySize) return null;
  return setWebGlVideoQualitySize(quality);
}

export function createDecoupledExportSession(
  width: number,
  height: number,
  recommendedScale?: number
): DecoupledExportSession | null {
  if (!startDecoupledRenderTargetSession) return null;
  return startDecoupledRenderTargetSession(width, height, recommendedScale);
}

export function beginDeterministicOfflineSession(
  width: number,
  height: number
): HTMLCanvasElement | null {
  if (!beginOfflineSessionHook) return null;
  return beginOfflineSessionHook(width, height);
}

export function renderExactFrameAtTime(
  t: number,
  audioDataAtT: PrecomputedAudioFrame,
  targetWidth: number,
  targetHeight: number,
  subFrameBlur: SubFrameMotionBlur = 1
): HTMLCanvasElement | null {
  if (!renderExactFrameAtTimeHook) return null;
  return renderExactFrameAtTimeHook(t, audioDataAtT, targetWidth, targetHeight, subFrameBlur);
}

export function renderDeterministicOfflineFrame(
  frame: PrecomputedAudioFrame,
  subFrameBlur: SubFrameMotionBlur = 1
): HTMLCanvasElement | null {
  if (!renderExactFrameAtTimeHook) return null;
  const state = useStudioStore.getState();
  const w = state.activeBackbufferWidth || 1920;
  const h = state.activeBackbufferHeight || 1080;
  return renderExactFrameAtTimeHook(frame.timeSec, frame, w, h, subFrameBlur);
}

export function endDeterministicOfflineSession(): void {
  if (endOfflineSessionHook) endOfflineSessionHook();
}

function createOffloaded60FpsWorker(
  onDeterministicFrameTick: (frameIndex: number, fixedDt: number) => void
): Worker | null {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return null;
  try {
    const workerCode = `
      let timer = null;
      let frameIndex = 0;
      const FIXED_DT = 1 / 60;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          frameIndex = 0;
          if (timer) clearInterval(timer);
          timer = setInterval(function() {
            frameIndex++;
            self.postMessage({ frameIndex: frameIndex, dt: FIXED_DT });
          }, 1000 / 60);
        } else if (e.data === 'stop') {
          if (timer) clearInterval(timer);
          timer = null;
        }
      };
    `;
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    worker.onmessage = (e) => {
      if (e.data && typeof e.data.frameIndex === 'number') {
        onDeterministicFrameTick(e.data.frameIndex, e.data.dt || 1 / 60);
      }
    };
    worker.postMessage('start');
    return worker;
  } catch {
    return null;
  }
}

function createProceduralEmblemTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // High-contrast non-sacred-geometry Bass Nation / Cyber Reactor Emblem
    const grad = ctx.createRadialGradient(256, 256, 20, 256, 256, 250);
    grad.addColorStop(0, '#111827');
    grad.addColorStop(0.65, '#090d16');
    grad.addColorStop(1, '#030712');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    const cx = 256;
    const cy = 256;
    // Outer neon turbine rings
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, 210, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, 172, 0, Math.PI * 2);
    ctx.stroke();

    // Bold stylized Bass Wave / Lightning Bolt Crest in the center
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(275, 105);
    ctx.lineTo(185, 265);
    ctx.lineTo(255, 265);
    ctx.lineTo(225, 405);
    ctx.lineTo(335, 235);
    ctx.lineTo(260, 235);
    ctx.closePath();
    ctx.fill();

    const imgData = ctx.getImageData(0, 0, 512, 512);
    computeRgbaDepthMapInPlace(imgData.data, 512, 512);
    ctx.putImageData(imgData, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createProceduralSecondImageTexture(maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(256, 256, 16, 256, 256, 256);
    grad.addColorStop(0, '#ec4899');
    grad.addColorStop(0.45, '#6366f1');
    grad.addColorStop(0.8, '#0f172a');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Concentric sacred geometric crystal rings for Multi-Image 3D Depth Morph
    for (let r = 48; r <= 220; r += 36) {
      ctx.strokeStyle = r % 72 === 0 ? '#22d3ee' : '#f472b6';
      ctx.lineWidth = 6;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const ang = (i * Math.PI) / 3 + r * 0.01;
        const px = 256 + Math.cos(ang) * r;
        const py = 256 + Math.sin(ang) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }

    const imgData = ctx.getImageData(0, 0, 512, 512);
    computeRgbaDepthMapInPlace(imgData.data, 512, 512);
    ctx.putImageData(imgData, 0, 0);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function loadRgbaDepthCanvasTexture(
  url: string,
  maxAnisotropy: number,
  onLoaded: (tex: THREE.CanvasTexture, aspect: number) => void
) {
  const img = new window.Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const aspect = img.naturalWidth / Math.max(1, img.naturalHeight);
    const w = 256;
    const h = 256;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, 0, 0, w, h);
      const imgData = ctx.getImageData(0, 0, w, h);
      computeRgbaDepthMapInPlace(imgData.data, w, h);
      ctx.putImageData(imgData, 0, 0);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = maxAnisotropy;
    onLoaded(tex, aspect);
  };
  img.src = url;
}

export default function FractalCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const lastTapTimeRef = useRef<number>(0);

  // Store ShaderMaterial uniforms object ONCE in a ref so React state updates
  // (e.g. export progress) never reset uniforms back to Frame 0
  const uniformsRef = useRef<Record<string, { value: any }> | null>(null);

  const bindGestures = useGesture(
    {
      onDrag: ({ delta: [dx, dy], touches, event }) => {
        if (event.target instanceof HTMLElement && event.target.closest('[data-hud-interactive="true"]')) {
          return;
        }
        if (touches >= 2) {
          transientState.cameraLateralX = Math.max(-2.5, Math.min(2.5, transientState.cameraLateralX + dx * 0.005));
          transientState.cameraLateralY = Math.max(-2.5, Math.min(2.5, transientState.cameraLateralY - dy * 0.005));
        } else {
          transientState.cameraOrbitX += dx * 0.0035;
          transientState.cameraOrbitY = Math.max(-1.2, Math.min(1.2, transientState.cameraOrbitY - dy * 0.0035));
        }
      },
      onPinch: ({ offset: [scale, angle] }) => {
        transientState.cameraZoomSpeed = Math.max(0.3, Math.min(2.8, scale));
        transientState.cameraRollZ = (angle * Math.PI) / 180;
      },
      onWheel: ({ delta: [, dy] }) => {
        transientState.cameraZoomSpeed = Math.max(
          0.3,
          Math.min(2.8, transientState.cameraZoomSpeed - dy * 0.001)
        );
      },
    },
    {
      drag: { filterTaps: true },
      pinch: { scaleBounds: { min: 0.3, max: 2.8 } },
    }
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLElement && e.target.closest('[data-hud-interactive="true"]')) {
      return;
    }
    const storeState = useStudioStore.getState();
    if (storeState.viewMode === 'zen-fullscreen') {
      storeState.setViewMode('clean-player');
      return;
    }
    const now = performance.now();
    if (now - lastTapTimeRef.current < 280) {
      storeState.cycleFractalMode();
      lastTapTimeRef.current = 0;
    } else {
      lastTapTimeRef.current = now;
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLElement && e.target.closest('[data-hud-interactive="true"]')) {
      return;
    }
    if (e.touches.length === 3) {
      useStudioStore.getState().cycleViewMode();
    } else if (e.touches.length === 2) {
      useStudioStore.getState().triggerBeatBang();
    }
  };

  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const canvas = document.createElement('canvas');
    let glContext: WebGL2RenderingContext | WebGLRenderingContext | null = null;
    try {
      const contextAttributes: WebGLContextAttributes = {
        alpha: false,
        depth: false,
        stencil: false,
        antialias: false,
        premultipliedAlpha: false,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      };
      glContext =
        (canvas.getContext('webgl2', contextAttributes) as WebGL2RenderingContext | null) ||
        (canvas.getContext('webgl', contextAttributes) as WebGLRenderingContext | null) ||
        canvas.getContext('webgl2') ||
        canvas.getContext('webgl');
    } catch {
      glContext = null;
    }

    let gpuLabel = 'WebGL2 Hardware GPU';
    let isSoftwareGl = false;
    let hasParallelShaderCompile = false;

    if (glContext) {
      try {
        const ext = glContext.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : glContext.RENDERER;
        const rawGpu = String(glContext.getParameter(param) || 'WebGL2 GPU');
        isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rawGpu);
        gpuLabel = rawGpu.replace(/ANGLE \(([^,]+), ([^,(]+).*\)/i, '$2').slice(0, 36);
        const parallelExt = glContext.getExtension('KHR_parallel_shader_compile');
        hasParallelShaderCompile = Boolean(parallelExt);
      } catch {
        hasParallelShaderCompile = false;
      }
    } else {
      isSoftwareGl = true;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        context: (glContext as WebGLRenderingContext) ?? undefined,
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
        depth: false,
        stencil: false,
        precision: 'highp',
      });
    } catch {
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setPixelRatio(1.0);

    const onContextLost = (ev: Event) => {
      ev.preventDefault();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost, false);

    useStudioStore.setState({
      gpuRendererName: gpuLabel,
      parallelCompileSupported: hasParallelShaderCompile || typeof renderer.compileAsync === 'function',
    });

    const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);

    mountEl.innerHTML = '';
    mountEl.appendChild(renderer.domElement);
    activeWebGlCanvas = renderer.domElement;

    const rtOptions: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
    };

    const raymarchFbo = new THREE.WebGLRenderTarget(960, 540, rtOptions);
    let rtA = new THREE.WebGLRenderTarget(640, 360, rtOptions);
    let rtB = new THREE.WebGLRenderTarget(640, 360, rtOptions);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new THREE.PlaneGeometry(2, 2);

    const defaultEmblemTexture = createProceduralEmblemTexture(maxAnisotropy);
    const defaultSecondTexture = createProceduralSecondImageTexture(maxAnisotropy);
    let customLoadedTexture: THREE.Texture | null = null;
    let customLoadedTextureB: THREE.Texture | null = null;
    let lastLoadedTextureUrl: string | null = null;
    let lastLoadedTextureUrlB: string | null = null;

    const initialGpuHeavy = useStudioStore.getState().gpuHeavyMode;

    if (!uniformsRef.current) {
      uniformsRef.current = {
        u_time: { value: 1.25 },
        u_resolution: { value: new THREE.Vector2(960, 540) },
        u_fractalMode: { value: 0 },
        u_prevFractalMode: { value: 0 },
        u_morph: { value: 1.0 },
        u_maxSteps: { value: isSoftwareGl ? 42 : 96 },
        u_iterationDetail: { value: 10 },
        u_exportTurbo: { value: false },
        u_gpuHeavyMode: { value: initialGpuHeavy },

        u_polychoraType: { value: 0 },
        u_zenoSpeed: { value: 1.15 },
        u_halvingRate: { value: 0.85 },
        u_escherTwist: { value: 1.0 },
        u_arrowParadoxMix: { value: 0.35 },
        u_sliceHz: { value: 8.0 },
        u_rot4dXW: { value: 0.65 },
        u_rot4dYW: { value: 0.48 },
        u_rot4dZW: { value: 0.32 },
        u_wCameraDist: { value: 2.25 },
        u_worldBiome: { value: -1.0 },
        u_transcendence: { value: 0.18 },
        u_collageJoinMode: { value: 0 },
        u_cloudDensity: { value: 0.55 },
        u_creatureSpeed: { value: 1.35 },
        u_cameraShake: { value: 0.85 },
        u_feedbackTrail: { value: 0.82 },
        u_emblemSize: { value: 0.38 },
        u_spectrumBars: { value: 64.0 },

        u_subBass: { value: 0 },
        u_bass: { value: 0 },
        u_lowMid: { value: 0 },
        u_mid: { value: 0 },
        u_upperMid: { value: 0 },
        u_presence: { value: 0 },
        u_brilliance: { value: 0 },
        u_bassCumulative: { value: 0 },
        u_midCumulative: { value: 0 },
        u_juiceBounce: { value: 1.0 },
        u_audioIntensity: { value: 0 },
        u_fractalSpike: { value: 0 },
        u_kickTransient: { value: 0 },
        u_snareTransient: { value: 0 },
        u_hiHatSparkle: { value: 0 },
        u_bpmPhase: { value: 0 },
        u_mirrorPhase: { value: 0 },
        u_pitchHue: { value: 0 },
        u_beatShockwave: { value: true },

        u_speed: { value: 1.2 },
        u_scale: { value: 2.15 },
        u_tunnelCurvature: { value: 1.0 },
        u_cameraFov: { value: 1.25 },
        u_bulbPower: { value: 8.0 },
        u_kleinianScale: { value: 1.42 },
        u_foldLimit: { value: 1.05 },
        u_chaosMode: { value: false },

        u_palA: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
        u_palB: { value: new THREE.Vector3(0.5, 0.5, 0.5) },
        u_palC: { value: new THREE.Vector3(1.0, 1.0, 0.5) },
        u_palD: { value: new THREE.Vector3(0.8, 0.9, 0.3) },

        u_cameraOrbit: { value: new THREE.Vector2(0, 0) },
        u_cameraRoll: { value: 0 },
        u_cameraLateral: { value: new THREE.Vector2(0, 0) },
        u_cameraZoom: { value: 1.0 },
        u_xyPad1: { value: new THREE.Vector2(0.35, 0.28) },
        u_xyPad2: { value: new THREE.Vector2(0.68, 0.45) },

        u_clarity: { value: 1.25 },
        u_kaleidoSlices: { value: 1.0 },
        u_mirrorX: { value: false },
        u_mirrorY: { value: false },
        u_fbmWarp: { value: 0.35 },
        u_metaBrightness: { value: 1.05 },
        u_metaContrast: { value: 1.08 },
        u_metaGamma: { value: 0.95 },
        u_metaSaturation: { value: 1.15 },
        u_metaHueSpeed: { value: 0.25 },
        u_colorInvert: { value: false },

        u_userTexture: { value: defaultEmblemTexture as THREE.Texture | null },
        u_userTextureB: { value: defaultSecondTexture as THREE.Texture | null },
        u_hasTexture: { value: false },
        u_textureMappingMode: { value: 3 },
        u_textureMix: { value: 0.65 },
        u_textureAspect: { value: 1.0 },
        u_textureAspectB: { value: 1.0 },
        u_textureScale: { value: 1.25 },
        u_trapScale: { value: 0.85 },
        u_imageSpinSpeed: { value: 0.4 },
        u_imageBeatPulse: { value: 0.65 },
        u_imageMorphT: { value: 0.0 },
        u_imageDepth3D: { value: 0.72 },
        u_imgFractalIter: { value: 6 },
        u_morphTurbulence: { value: 0.55 },
        u_imageBlendMethod: { value: 0 },
        u_img3DStyle: { value: 0 },
        u_kifsFoldAngle: { value: 0.58 },
        u_zoomDirection: { value: 1.0 },

        u_prevFrame: { value: rtA.texture as THREE.Texture | null },

        u_bloomIntensity: { value: 1.35 },
        u_chromaticAberration: { value: 0.0025 },
        u_vignetteDarkness: { value: 0.55 },
        u_filmGrain: { value: 0.1 },
        u_glitchActive: { value: false },

        // Mode 25: Divine Creation & Global Volumetric God Rays Sculptor Uniforms
        u_divineStage: { value: 0 },
        u_divineGodRays: { value: false },
        u_godRayIntensity: { value: 1.0 },
        u_godRayDensity: { value: 0.94 },
        u_godRayWeight: { value: 0.52 },
        u_godRayDecay: { value: 0.96 },
        u_godRayExposure: { value: 1.15 },
        u_sacredHaloEnabled: { value: false },
        u_sacredFiligreeMix: { value: 0.5 },
      };
    }

    const uniforms = uniformsRef.current;
    uniforms.u_maxSteps.value = isSoftwareGl ? 42 : 96;
    uniforms.u_gpuHeavyMode.value = initialGpuHeavy;
    uniforms.u_userTexture.value = defaultEmblemTexture;
    uniforms.u_userTextureB.value = defaultSecondTexture;
    uniforms.u_prevFrame.value = rtA.texture;

    const initialMode = useStudioStore.getState().fractalMode;
    const shaderMaterialCache = new Map<string, THREE.ShaderMaterial>();

    const getModeCacheKey = (mode: number, gpuHeavy: boolean): string =>
      `${mode}:${gpuHeavy ? '1' : '0'}`;

    const createLockedModeMaterial = (
      mode: number,
      gpuHeavy: boolean
    ): THREE.ShaderMaterial =>
      new THREE.ShaderMaterial({
        vertexShader: buildFractalVertexShader(gpuHeavy),
        fragmentShader: buildFractalFragmentShader(gpuHeavy, mode),
        uniforms,
        precision: gpuHeavy ? 'highp' : 'mediump',
        depthWrite: false,
        depthTest: false,
      });

    const getOrCreateModeMaterial = (
      mode: number,
      gpuHeavy: boolean
    ): THREE.ShaderMaterial => {
      const key = getModeCacheKey(mode, gpuHeavy);
      const cached = shaderMaterialCache.get(key);
      if (cached) return cached;
      const mat = createLockedModeMaterial(mode, gpuHeavy);
      shaderMaterialCache.set(key, mat);
      return mat;
    };

    let activeShaderMaterial = getOrCreateModeMaterial(initialMode, initialGpuHeavy);

    const casUpscaleMaterial = new THREE.ShaderMaterial({
      vertexShader: buildFractalVertexShader(true),
      fragmentShader: UPSCALE_CAS_FRAGMENT_SHADER,
      uniforms: {
        tDiffuse: { value: raymarchFbo.texture },
        u_sourceTexelSize: { value: new THREE.Vector2(1 / 960, 1 / 540) },
        u_sharpness: { value: 0.78 },
        u_fastUpscale: { value: false },
      },
      precision: 'highp',
      depthWrite: false,
      depthTest: false,
    });

    const screenQuad = new THREE.Mesh(quadGeo, activeShaderMaterial);
    screenQuad.frustumCulled = false;
    scene.add(screenQuad);

    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    let currentCompiledMode = initialMode;
    let currentCompiledGpuHeavy = initialGpuHeavy;
    let isCompilingShaderAsync = false;

    const triggerMultithreadedShaderCompile = (
      targetGpuHeavy: boolean,
      targetMode: number = useStudioStore.getState().fractalMode
    ) => {
      const cacheKey = getModeCacheKey(targetMode, targetGpuHeavy);
      const existingCached = shaderMaterialCache.get(cacheKey);
      if (existingCached) {
        currentCompiledMode = targetMode as FractalMode;
        currentCompiledGpuHeavy = targetGpuHeavy;
        uniforms.u_gpuHeavyMode.value = targetGpuHeavy;
        activeShaderMaterial = existingCached;
        useStudioStore.setState({ shaderCompileStatus: 'ready' });
        return;
      }

      if (isCompilingShaderAsync) return;
      isCompilingShaderAsync = true;
      currentCompiledMode = targetMode as FractalMode;
      currentCompiledGpuHeavy = targetGpuHeavy;
      uniforms.u_gpuHeavyMode.value = targetGpuHeavy;
      useStudioStore.setState({ shaderCompileStatus: 'compiling-multithreaded' });

      const nextMaterial = createLockedModeMaterial(targetMode, targetGpuHeavy);

      const tempScene = new THREE.Scene();
      const tempQuad = new THREE.Mesh(quadGeo, nextMaterial);
      tempScene.add(tempQuad);

      renderer.setRenderTarget(null);
      if (hasParallelShaderCompile && typeof renderer.compileAsync === 'function') {
        renderer
          .compileAsync(tempScene, camera)
          .then(() => {
            if (isDisposed) {
              nextMaterial.dispose();
              return;
            }
            shaderMaterialCache.set(cacheKey, nextMaterial);
            activeShaderMaterial = nextMaterial;
            isCompilingShaderAsync = false;
            useStudioStore.setState({ shaderCompileStatus: 'ready' });
          })
          .catch(() => {
            if (isDisposed) {
              nextMaterial.dispose();
              return;
            }
            nextMaterial.dispose();
            isCompilingShaderAsync = false;
            useStudioStore.setState({ shaderCompileStatus: 'ready' });
          });
      } else {
        window.setTimeout(() => {
          if (isDisposed) {
            nextMaterial.dispose();
            return;
          }
          renderer.setRenderTarget(null);
          renderer.compile(tempScene, camera);
          shaderMaterialCache.set(cacheKey, nextMaterial);
          activeShaderMaterial = nextMaterial;
          isCompilingShaderAsync = false;
          useStudioStore.setState({ shaderCompileStatus: 'ready' });
        }, 0);
      }
    };

    // Pre-initialize FBO textures so WebGL2 never validates an unallocated texture attachment
    const clearAllFbos = () => {
      renderer.setRenderTarget(raymarchFbo);
      renderer.clear();
      renderer.setRenderTarget(rtA);
      renderer.clear();
      renderer.setRenderTarget(rtB);
      renderer.clear();
      renderer.setRenderTarget(null);
    };
    clearAllFbos();

    let activeScale = isSoftwareGl ? 0.45 : 0.75;
    let currentBackbufferW = 1280;
    let currentBackbufferH = 720;
    let currentRayW = 960;
    let currentRayH = 540;

    let isExportingSessionActive = false;
    let isOfflineDeterministicSessionActive = false;
    let explicitVideoQualitySizeActive = false;
    let targetBackbufferW = 1920;
    let targetBackbufferH = 1080;
    let pendingWorkerFixedFrames = 0;

    const syncRenderTargets = (forceResize = false) => {
      if (!mountEl) return;
      const storeState = useStudioStore.getState();

      if (isOfflineDeterministicSessionActive || isExportingSessionActive || explicitVideoQualitySizeActive) {
        if (
          forceResize ||
          currentBackbufferW !== targetBackbufferW ||
          currentBackbufferH !== targetBackbufferH
        ) {
          currentBackbufferW = targetBackbufferW;
          currentBackbufferH = targetBackbufferH;
          renderer.setSize(targetBackbufferW, targetBackbufferH, false);
          useStudioStore.setState({
            activeBackbufferWidth: targetBackbufferW,
            activeBackbufferHeight: targetBackbufferH,
          });
        }

        const isVertical = targetBackbufferH > targetBackbufferW;
        const isSquare = targetBackbufferW === targetBackbufferH;
        const longTarget = Math.max(targetBackbufferW, targetBackbufferH);

        const maxExportRayLongEdge = isSoftwareGl
          ? 512
          : longTarget >= 2560
            ? 960
            : longTarget >= 1920
              ? 854
              : 640;
        const maxExportRayShortEdge = isSoftwareGl
          ? isSquare
            ? 512
            : 288
          : isSquare
            ? maxExportRayLongEdge
            : Math.round((maxExportRayLongEdge * 9) / 16);

        const targetRayW = isSquare
          ? maxExportRayLongEdge
          : isVertical
            ? maxExportRayShortEdge
            : maxExportRayLongEdge;
        const targetRayH = isSquare
          ? maxExportRayLongEdge
          : isVertical
            ? maxExportRayLongEdge
            : maxExportRayShortEdge;

        if (targetRayW !== currentRayW || targetRayH !== currentRayH) {
          currentRayW = targetRayW;
          currentRayH = targetRayH;
          raymarchFbo.setSize(targetRayW, targetRayH);
          uniforms.u_resolution.value.set(targetRayW, targetRayH);
          casUpscaleMaterial.uniforms.u_sourceTexelSize.value.set(1 / targetRayW, 1 / targetRayH);

          const fbW = Math.max(160, Math.round(targetRayW * 0.75));
          const fbH = Math.max(120, Math.round(targetRayH * 0.75));
          rtA.setSize(fbW, fbH);
          rtB.setSize(fbW, fbH);
          clearAllFbos();
        }
        return;
      }

      const previewCap = getPreviewResolutionDimensions(
        storeState.aspectRatio,
        storeState.previewResolutionCap
      );
      const cssW = Math.max(320, mountEl.clientWidth || 1280);
      const cssH = Math.max(240, mountEl.clientHeight || 720);
      const previewW = Math.min(cssW, previewCap.width);
      const previewH = Math.min(cssH, previewCap.height);

      if (forceResize || previewW !== currentBackbufferW || previewH !== currentBackbufferH) {
        currentBackbufferW = previewW;
        currentBackbufferH = previewH;
        renderer.setSize(previewW, previewH, false);
        useStudioStore.setState({
          activeBackbufferWidth: previewW,
          activeBackbufferHeight: previewH,
        });
      }

      const rayW = Math.max(256, Math.min(isSoftwareGl ? 640 : 1440, Math.round(previewW * activeScale)));
      const rayH = Math.max(144, Math.min(isSoftwareGl ? 360 : 1440, Math.round(previewH * activeScale)));

      if (rayW !== currentRayW || rayH !== currentRayH) {
        currentRayW = rayW;
        currentRayH = rayH;
        raymarchFbo.setSize(rayW, rayH);
        uniforms.u_resolution.value.set(rayW, rayH);
        casUpscaleMaterial.uniforms.u_sourceTexelSize.value.set(1 / rayW, 1 / rayH);

        const fbW = Math.max(160, Math.round(rayW * 0.75));
        const fbH = Math.max(120, Math.round(targetBackbufferH > 0 ? rayH * 0.75 : 360));
        rtA.setSize(fbW, fbH);
        rtB.setSize(fbW, fbH);
        clearAllFbos();
      }
    };

    setWebGlVideoQualitySize = (quality: VideoQualityPreset) => {
      const storeState = useStudioStore.getState();
      const { width, height, recommendedRaymarchScale } = getExportResolutionDimensions(
        storeState.aspectRatio,
        quality
      );
      explicitVideoQualitySizeActive = true;
      targetBackbufferW = width;
      targetBackbufferH = height;
      activeScale = isSoftwareGl ? Math.min(0.45, recommendedRaymarchScale) : recommendedRaymarchScale;
      casUpscaleMaterial.uniforms.u_fastUpscale.value = true;
      useStudioStore.setState({
        videoQuality: quality,
        exportResolutionPreset: quality,
        activeRenderScale: recommendedRaymarchScale,
        activeBackbufferWidth: width,
        activeBackbufferHeight: height,
      });
      syncRenderTargets(true);
      return { width, height };
    };

    const renderShaderWithCurrentUniforms = () => {
      const state = useStudioStore.getState();

      const itemA = state.multiImages[state.activeImageIndexA] || null;
      const itemB =
        state.multiImages.length > 1
          ? state.multiImages[state.activeImageIndexB % state.multiImages.length]
          : null;
      const targetUrlA = itemA ? itemA.url : state.userTextureUrl;
      const targetUrlB = itemB ? itemB.url : null;

      if (targetUrlA !== lastLoadedTextureUrl) {
        lastLoadedTextureUrl = targetUrlA;
        if (targetUrlA) {
          loadRgbaDepthCanvasTexture(targetUrlA, maxAnisotropy, (tex, aspect) => {
            if (customLoadedTexture) customLoadedTexture.dispose();
            customLoadedTexture = tex;
            uniforms.u_userTexture.value = tex;
            uniforms.u_textureAspect.value = aspect;
            uniforms.u_hasTexture.value = true;
          });
        } else {
          uniforms.u_userTexture.value = defaultEmblemTexture;
          uniforms.u_hasTexture.value = false;
        }
      }

      if (targetUrlB !== lastLoadedTextureUrlB) {
        lastLoadedTextureUrlB = targetUrlB;
        if (targetUrlB) {
          loadRgbaDepthCanvasTexture(targetUrlB, maxAnisotropy, (tex, aspect) => {
            if (customLoadedTextureB) customLoadedTextureB.dispose();
            customLoadedTextureB = tex;
            uniforms.u_userTextureB.value = tex;
            uniforms.u_textureAspectB.value = aspect;
          });
        } else {
          uniforms.u_userTextureB.value = defaultSecondTexture;
          uniforms.u_textureAspectB.value = 1.0;
        }
      }

      const maxSteps = isSoftwareGl
        ? 40
        : isOfflineDeterministicSessionActive || isExportingSessionActive
          ? state.gpuHeavyMode
            ? 108
            : 76
          : state.gpuHeavyMode || state.qualityTier === 'ultra'
            ? 140
            : state.qualityTier === 'balanced'
              ? 100
              : 64;

      uniforms.u_maxSteps.value = maxSteps;
      uniforms.u_iterationDetail.value = state.iterationDetail;
      uniforms.u_gpuHeavyMode.value = state.gpuHeavyMode;

      // 4D Hyperspace, Zeno's Paradox, AI World Biome & Bass Nation uniforms
      uniforms.u_polychoraType.value = state.polychoraType;
      uniforms.u_zenoSpeed.value = state.zenoReverseDirection ? -state.zenoSpeed : state.zenoSpeed;
      uniforms.u_halvingRate.value = state.zenoHalvingRate;
      uniforms.u_escherTwist.value = state.zenoEscherTwist;
      uniforms.u_arrowParadoxMix.value = state.zenoArrowParadoxMix;
      uniforms.u_sliceHz.value = state.zenoSliceHz;
      uniforms.u_rot4dXW.value = state.rot4dXW;
      uniforms.u_rot4dYW.value = state.rot4dYW;
      uniforms.u_rot4dZW.value = state.rot4dZW;
      uniforms.u_wCameraDist.value = state.wCameraDist;
      uniforms.u_worldBiome.value =
        state.worldBiomeMode === 'auto' ? -1.0 : state.worldBiomeMorph;
      uniforms.u_transcendence.value = state.transcendence;
      uniforms.u_collageJoinMode.value = state.collageJoinMode;
      uniforms.u_cloudDensity.value = state.cloudDensity;
      uniforms.u_creatureSpeed.value = state.creatureSpeed;
      uniforms.u_cameraShake.value = state.cameraShakeIntensity;
      uniforms.u_feedbackTrail.value = state.feedbackTrailLength;
      uniforms.u_emblemSize.value = state.emblemSize;
      uniforms.u_spectrumBars.value = state.spectrumBarCount;

      uniforms.u_time.value = transientState.dynamicTime;
      uniforms.u_fractalMode.value = state.fractalMode;
      uniforms.u_prevFractalMode.value = transientState.prevFractalMode;
      uniforms.u_morph.value =
        state.manualMorphOverride !== null ? state.manualMorphOverride : transientState.modeMorphProgress;

      uniforms.u_subBass.value = transientState.bands.subBass;
      uniforms.u_bass.value = transientState.bands.bass;
      uniforms.u_lowMid.value = transientState.bands.lowMid;
      uniforms.u_mid.value = transientState.bands.mid;
      uniforms.u_upperMid.value = transientState.bands.upperMid;
      uniforms.u_presence.value = transientState.bands.presence;
      uniforms.u_brilliance.value = transientState.bands.brilliance;
      uniforms.u_bassCumulative.value = transientState.bassCumulative;
      uniforms.u_midCumulative.value = transientState.midCumulative;
      uniforms.u_juiceBounce.value = transientState.juiceBounce;
      uniforms.u_audioIntensity.value = transientState.audioIntensity;
      uniforms.u_fractalSpike.value = transientState.fractalSpike;
      uniforms.u_kickTransient.value = transientState.kickTransient;
      uniforms.u_snareTransient.value = transientState.snareTransient;
      uniforms.u_hiHatSparkle.value = transientState.hiHatSparkle;
      uniforms.u_bpmPhase.value = transientState.bpmPhase;
      uniforms.u_mirrorPhase.value = transientState.mirrorPhase;
      uniforms.u_pitchHue.value = transientState.pitchHue;
      uniforms.u_beatShockwave.value = state.beatShockwaveEnabled;

      uniforms.u_speed.value = state.cameraSpeed * transientState.cameraZoomSpeed;
      uniforms.u_scale.value = state.tunnelScale;
      uniforms.u_tunnelCurvature.value = state.tunnelCurvature;
      uniforms.u_cameraFov.value = state.cameraFov;
      uniforms.u_bulbPower.value = state.bulbPower;
      uniforms.u_kleinianScale.value = state.kleinianScale;
      uniforms.u_foldLimit.value = state.foldLimit;
      uniforms.u_chaosMode.value = state.chaosMode;

      uniforms.u_palA.value.set(...state.palette.a);
      uniforms.u_palB.value.set(...state.palette.b);
      uniforms.u_palC.value.set(...state.palette.c);
      uniforms.u_palD.value.set(...state.palette.d);

      uniforms.u_cameraOrbit.value.set(
        transientState.cameraOrbitX + transientState.gyroTiltX * 0.6,
        transientState.cameraOrbitY + transientState.gyroTiltY * 0.6
      );
      uniforms.u_cameraRoll.value = transientState.cameraRollZ;
      uniforms.u_cameraLateral.value.set(transientState.cameraLateralX, transientState.cameraLateralY);
      uniforms.u_cameraZoom.value = transientState.cameraZoomSpeed;
      uniforms.u_xyPad1.value.set(transientState.xyPad1[0], transientState.xyPad1[1]);
      uniforms.u_xyPad2.value.set(transientState.xyPad2[0], transientState.xyPad2[1]);

      uniforms.u_clarity.value = state.clarity;
      uniforms.u_kaleidoSlices.value = state.kaleidoSlices;
      uniforms.u_mirrorX.value = state.mirrorX;
      uniforms.u_mirrorY.value = state.mirrorY;
      uniforms.u_fbmWarp.value = state.fbmWarpStrength;
      uniforms.u_metaBrightness.value = state.metaBrightness;
      uniforms.u_metaContrast.value = state.metaContrast;
      uniforms.u_metaGamma.value = state.metaGamma;
      uniforms.u_metaSaturation.value = state.metaSaturation;
      uniforms.u_metaHueSpeed.value = state.metaHueSpeed;
      uniforms.u_colorInvert.value = state.colorInvert;

      uniforms.u_textureMappingMode.value =
        state.textureMappingMode === 'orbit-trap'
          ? 0
          : state.textureMappingMode === 'triplanar'
            ? 1
            : state.textureMappingMode === 'both'
              ? 2
              : state.textureMappingMode === 'zeno-droste'
                ? 4
                : 3;
      uniforms.u_textureMix.value = state.textureMix;
      uniforms.u_textureAspect.value = state.userTextureAspect;
      uniforms.u_textureScale.value = state.textureScale;
      uniforms.u_trapScale.value = state.trapScale;
      uniforms.u_imageSpinSpeed.value = state.imageSpinSpeed;
      uniforms.u_imageBeatPulse.value = state.imageBeatPulse;

      // Multi-Image 3D Fractalizer & Zoom Direction Uniforms
      let computedMorphT = state.imageMorphPhase;
      if (state.imageTransitionTrigger === 'smooth-time') {
        computedMorphT = 0.5 + 0.5 * Math.sin(transientState.dynamicTime * 0.45);
      } else if (state.imageTransitionTrigger === 'bass-drops') {
        computedMorphT = Math.min(
          1.0,
          (transientState.bassCumulative * 0.25 + transientState.kickTransient * 0.35) % 1.0
        );
      } else if (state.imageTransitionTrigger === 'every-n-bars') {
        computedMorphT = transientState.bpmPhase;
      }
      uniforms.u_imageMorphT.value = computedMorphT;
      uniforms.u_imageDepth3D.value = state.imageDepth3D;
      uniforms.u_imgFractalIter.value = state.imageFractalizeIterations;
      uniforms.u_morphTurbulence.value = state.imageMorphTurbulence;
      uniforms.u_imageBlendMethod.value =
        state.imageBlendMethod === 'crystal-shatter'
          ? 1
          : state.imageBlendMethod === 'droste-nest'
          ? 2
          : state.imageBlendMethod === 'kaleido-trap'
          ? 3
          : 0;
      uniforms.u_img3DStyle.value = state.img3DStyle;
      uniforms.u_kifsFoldAngle.value = state.kifsFoldAngle;
      uniforms.u_zoomDirection.value = computeZoomDirectionMultiplier(
        state.zoomDirectionMode,
        transientState.bpmPhase
      );

      uniforms.u_bloomIntensity.value = state.bloomIntensity;
      uniforms.u_chromaticAberration.value = state.chromaticAberration;
      uniforms.u_vignetteDarkness.value = state.vignetteDarkness;
      uniforms.u_filmGrain.value = state.filmGrain;
      uniforms.u_glitchActive.value = state.glitchActive;

      // Mode 25: Divine Creation & Global Volumetric God Rays Sculptor Uniforms
      uniforms.u_divineStage.value = state.divineCreationStage;
      uniforms.u_divineGodRays.value = state.divineGodRaysEnabled;
      uniforms.u_godRayIntensity.value = state.divineGodRayIntensity;
      uniforms.u_godRayDensity.value = state.godRayDensity;
      uniforms.u_godRayWeight.value = state.godRayWeight;
      uniforms.u_godRayDecay.value = state.godRayDecay;
      uniforms.u_godRayExposure.value = state.godRayExposure;
      uniforms.u_sacredHaloEnabled.value = state.sacredHaloEnabled;
      uniforms.u_sacredFiligreeMix.value = state.sacredFiligreeMix;

      // Modes using optical ping-pong feedback persistence (or active mode cross-fade) render through rtA/rtB
      const usesFeedbackBuffer =
        state.fractalMode === 1 ||
        state.fractalMode === 8 ||
        state.fractalMode === 9 ||
        state.fractalMode === 10 ||
        state.fractalMode === 11 ||
        state.fractalMode === 13 ||
        state.fractalMode === 14 ||
        state.fractalMode === 15 ||
        state.fractalMode === 18 ||
        state.fractalMode === 19 ||
        state.fractalMode === 20 ||
        state.fractalMode === 21 ||
        state.fractalMode === 22 ||
        state.fractalMode === 23 ||
        state.fractalMode === 24 ||
        state.fractalMode === 25 ||
        uniforms.u_morph.value < 0.999;

      // Ensure activeShaderMaterial is matched to the current mode and precision tier
      if (
        state.fractalMode !== currentCompiledMode ||
        state.gpuHeavyMode !== currentCompiledGpuHeavy
      ) {
        activeShaderMaterial = getOrCreateModeMaterial(
          state.fractalMode,
          state.gpuHeavyMode
        );
        currentCompiledMode = state.fractalMode;
        currentCompiledGpuHeavy = state.gpuHeavyMode;
      }

      if (usesFeedbackBuffer) {
        casUpscaleMaterial.uniforms.tDiffuse.value = raymarchFbo.texture;
        uniforms.u_resolution.value.set(rtB.width, rtB.height);
        uniforms.u_prevFrame.value = rtA.texture;
        screenQuad.material = activeShaderMaterial;
        renderer.setRenderTarget(rtB);
        renderer.render(scene, camera);

        casUpscaleMaterial.uniforms.tDiffuse.value = rtB.texture;
        casUpscaleMaterial.uniforms.u_sharpness.value = Math.min(
          1.0,
          0.52 + state.clarity * 0.22
        );
        screenQuad.material = casUpscaleMaterial;
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);

        const temp = rtA;
        rtA = rtB;
        rtB = temp;
        uniforms.u_prevFrame.value = rtA.texture;
      } else {
        // Single-Pass Direct Render (Bloom, Chromatic Aberration, Vignette, Film Grain & ACES Tone Mapping are inside activeShaderMaterial)
        uniforms.u_resolution.value.set(currentBackbufferW, currentBackbufferH);
        uniforms.u_prevFrame.value = rtA.texture;
        screenQuad.material = activeShaderMaterial;
        renderer.setRenderTarget(null);
        renderer.render(scene, camera);
      }
    };

    const pickAllowedAutoSwitchMode = (
      preferred: number,
      enabledMask: boolean[],
      fallback: number
    ): FractalMode => {
      if (enabledMask[preferred]) {
        return preferred as FractalMode;
      }
      const allowedIndices: number[] = [];
      for (let i = 0; i < FRACTAL_MODE_INFO.length; i++) {
        if (enabledMask[i]) allowedIndices.push(i);
      }
      if (allowedIndices.length === 0) {
        return fallback as FractalMode;
      }
      return allowedIndices[preferred % allowedIndices.length] as FractalMode;
    };

    let lastBarSwitchIndex = -1;

    const syncAutoSwitchForTimestamp = (timeSec: number, durationSec: number) => {
      const state = useStudioStore.getState();
      if (!state.autoChoreographyEnabled || durationSec <= 0) return;

      if (state.autoSwitchTriggerMode === 'every-n-bars') {
        const bpm = Math.max(70, Math.min(190, transientState.estimatedBpm || 124));
        const barDurationSec = (60 / bpm) * (state.autoSwitchBars || 8);
        const barIndex = Math.floor(timeSec / Math.max(2, barDurationSec));
        if (barIndex !== lastBarSwitchIndex) {
          lastBarSwitchIndex = barIndex;
          const allowed: number[] = [];
          for (let i = 0; i < FRACTAL_MODE_INFO.length; i++) {
            if (state.autoSwitchEnabledModes[i]) allowed.push(i);
          }
          if (allowed.length > 0) {
            const nextMode = allowed[barIndex % allowed.length] as FractalMode;
            if (nextMode !== state.fractalMode) {
              state.setFractalMode(nextMode);
            }
          }
        }
        return;
      }

      const activeChoreo = state.choreographies[state.activeChoreographyIndex];
      if (activeChoreo && activeChoreo.timelineKeyframes.length > 0) {
        const progress = (timeSec % durationSec) / durationSec;
        const activeKf = getActiveChoreographyKeyframe(activeChoreo.timelineKeyframes, progress);
        if (activeKf && activeKf.section !== state.activeSectionName) {
          const targetMode = pickAllowedAutoSwitchMode(
            activeKf.fractalMode,
            state.autoSwitchEnabledModes,
            state.fractalMode
          );
          useStudioStore.setState({
            activeSectionName: activeKf.section,
            cameraSpeed: activeKf.speedMultiplier,
            bloomIntensity: activeKf.bloomIntensity,
            bulbPower: activeKf.bulbPower,
            kleinianScale: activeKf.kleinianScale,
            foldLimit: activeKf.foldLimit,
            chaosMode: activeKf.chaosMode,
            ...(typeof activeKf.transcendence === 'number'
              ? { transcendence: activeKf.transcendence }
              : {}),
          });
          if (activeKf.worldBiome) {
            state.setWorldBiomeMode(activeKf.worldBiome);
          }
          if (targetMode !== state.fractalMode) {
            state.setFractalMode(targetMode);
          }
        }
      }
    };

    const executeFractalRenderPass = (dtStep: number, elapsedStep: number) => {
      const state = useStudioStore.getState();

      // 1. Update 60Hz DSP Audio, Silence Gate & Fractal Spike Envelope
      audioEngine.updateFrame(dtStep, elapsedStep);

      // 2. Auto-Choreography Timeline Keyframe Sync (ONLY when Auto-Switch is enabled)
      if (state.autoChoreographyEnabled && state.isPlaying && transientState.duration > 0) {
        syncAutoSwitchForTimestamp(transientState.currentTime, transientState.duration);
      }

      renderShaderWithCurrentUniforms();
    };

    // Offscreen 2D Proxy Canvas (`recCanvas`) for 100% reliable VideoFrame & captureStream creation
    let recCanvas: HTMLCanvasElement | null = null;
    let recCtx: CanvasRenderingContext2D | null = null;

    const ensureProxyRecCanvas = (
      w: number,
      h: number
    ): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D | null } => {
      if (!recCanvas) {
        recCanvas = document.createElement('canvas');
        recCtx = recCanvas.getContext('2d', { alpha: false });
      }
      if (recCanvas.width !== w || recCanvas.height !== h) {
        recCanvas.width = w;
        recCanvas.height = h;
        recCtx = recCanvas.getContext('2d', { alpha: false });
      }
      return { canvas: recCanvas, ctx: recCtx };
    };

    beginOfflineSessionHook = (exportW: number, exportH: number) => {
      isOfflineDeterministicSessionActive = true;
      targetBackbufferW = exportW;
      targetBackbufferH = exportH;
      lastBarSwitchIndex = -1;
      renderer.setPixelRatio(1);
      uniforms.u_exportTurbo.value = isSoftwareGl;
      casUpscaleMaterial.uniforms.u_fastUpscale.value = false;
      syncRenderTargets(true);
      const { canvas: proxyCanvas, ctx: proxyCtx } = ensureProxyRecCanvas(exportW, exportH);
      if (proxyCtx) {
        proxyCtx.drawImage(renderer.domElement, 0, 0, exportW, exportH);
      }
      return proxyCanvas;
    };

    renderExactFrameAtTimeHook = (
      t: number,
      audioDataAtT: PrecomputedAudioFrame,
      targetWidth: number,
      targetHeight: number,
      subFrameBlur: SubFrameMotionBlur = 1
    ): HTMLCanvasElement | null => {
      const state = useStudioStore.getState();
      const totalDur = Math.max(1, state.trackDuration || 180);

      if (
        !isOfflineDeterministicSessionActive ||
        targetBackbufferW !== targetWidth ||
        targetBackbufferH !== targetHeight
      ) {
        isOfflineDeterministicSessionActive = true;
        targetBackbufferW = targetWidth;
        targetBackbufferH = targetHeight;
        renderer.setPixelRatio(1);
        syncRenderTargets(true);
      }

      if (state.autoChoreographyEnabled) {
        syncAutoSwitchForTimestamp(t, totalDur);
      }

      transientState.currentTime = t;
      transientState.bands = audioDataAtT.bands;
      transientState.rmsEnergy = audioDataAtT.rmsEnergy;
      transientState.audioIntensity = audioDataAtT.audioIntensity;
      transientState.fractalSpike = audioDataAtT.fractalSpike;
      transientState.juiceBounce = audioDataAtT.juiceBounce;
      transientState.kickTransient = audioDataAtT.kickTransient;
      transientState.snareTransient = audioDataAtT.snareTransient;
      transientState.hiHatSparkle = audioDataAtT.hiHatSparkle;
      transientState.bpmPhase = audioDataAtT.bpmPhase;
      transientState.pitchHue = audioDataAtT.pitchHue;
      transientState.bassCumulative = audioDataAtT.bassCumulative;
      transientState.midCumulative = audioDataAtT.midCumulative;
      transientState.mirrorPhase = audioDataAtT.mirrorPhase;

      if (transientState.modeMorphProgress < 1.0) {
        const frameDt = 1 / Math.max(24, state.exportFps || 60);
        const morphDur = Math.max(0.5, state.transitionMorphSeconds || 2.0);
        transientState.modeMorphProgress = Math.min(
          1.0,
          transientState.modeMorphProgress + frameDt / morphDur
        );
      }

      const subSteps = Math.max(1, subFrameBlur);
      for (let s = 0; s < subSteps; s++) {
        const subOffset = subSteps > 1 ? (s / subSteps) * (1 / 120) : 0;
        const effectiveTime =
          (Number.isFinite(audioDataAtT.dynamicTime) ? audioDataAtT.dynamicTime : 1.25 + t) +
          subOffset;
        transientState.dynamicTime = effectiveTime;

        // Explicitly write `t` (effectiveTime) and all audio bands directly into ShaderMaterial.uniforms
        const matUniforms = activeShaderMaterial.uniforms;
        matUniforms.u_time.value = effectiveTime;
        matUniforms.u_subBass.value = audioDataAtT.bands.subBass;
        matUniforms.u_bass.value = audioDataAtT.bands.bass;
        matUniforms.u_lowMid.value = audioDataAtT.bands.lowMid;
        matUniforms.u_mid.value = audioDataAtT.bands.mid;
        matUniforms.u_upperMid.value = audioDataAtT.bands.upperMid;
        matUniforms.u_presence.value = audioDataAtT.bands.presence;
        matUniforms.u_brilliance.value = audioDataAtT.bands.brilliance;
        matUniforms.u_bassCumulative.value = audioDataAtT.bassCumulative;
        matUniforms.u_midCumulative.value = audioDataAtT.midCumulative;
        matUniforms.u_juiceBounce.value = audioDataAtT.juiceBounce;
        matUniforms.u_audioIntensity.value = audioDataAtT.audioIntensity;
        matUniforms.u_fractalSpike.value = audioDataAtT.fractalSpike;
        matUniforms.u_kickTransient.value = audioDataAtT.kickTransient;
        matUniforms.u_snareTransient.value = audioDataAtT.snareTransient;
        matUniforms.u_hiHatSparkle.value = audioDataAtT.hiHatSparkle;
        matUniforms.u_bpmPhase.value = audioDataAtT.bpmPhase;
        matUniforms.u_mirrorPhase.value = audioDataAtT.mirrorPhase;
        matUniforms.u_pitchHue.value = audioDataAtT.pitchHue;
        activeShaderMaterial.uniformsNeedUpdate = true;
        casUpscaleMaterial.uniformsNeedUpdate = true;

        renderShaderWithCurrentUniforms();
      }

      const gl = renderer.getContext();
      if (gl && typeof gl.flush === 'function') {
        gl.flush();
      }

      // Copy the rendered WebGL buffer onto the offscreen 2D proxy canvas (`recCanvas`)
      const { canvas: proxyCanvas, ctx: proxyCtx } = ensureProxyRecCanvas(
        targetWidth,
        targetHeight
      );
      if (proxyCtx) {
        proxyCtx.drawImage(renderer.domElement, 0, 0, targetWidth, targetHeight);
      }

      return proxyCanvas;
    };

    endOfflineSessionHook = () => {
      isOfflineDeterministicSessionActive = false;
      explicitVideoQualitySizeActive = false;
      uniforms.u_exportTurbo.value = false;
      casUpscaleMaterial.uniforms.u_fastUpscale.value = false;
      syncRenderTargets(true);
    };

    startDecoupledRenderTargetSession = (
      exportW: number,
      exportH: number,
      recommendedScale = 0.5
    ): DecoupledExportSession => {
      isExportingSessionActive = true;
      targetBackbufferW = exportW;
      targetBackbufferH = exportH;
      pendingWorkerFixedFrames = 0;

      uniforms.u_exportTurbo.value = true;
      casUpscaleMaterial.uniforms.u_fastUpscale.value = true;

      syncRenderTargets(true);
      executeFractalRenderPass(1 / 60, 1.25);

      const exportStream = renderer.domElement.captureStream(60);
      const videoTrack = exportStream.getVideoTracks()[0] as
        | (MediaStreamTrack & { requestFrame?: () => void })
        | undefined;

      let isSessionActive = true;
      let capturedFrames = 1;
      let rVfcDeliveredFrames = 1;
      let rvfcHandle = 0;
      let lastRvfcTime = performance.now();

      const offloadedWorker = createOffloaded60FpsWorker(() => {
        if (!isSessionActive) return;
        pendingWorkerFixedFrames = Math.min(2, pendingWorkerFixedFrames + 1);
      });

      useStudioStore.setState({
        activeRenderScale: recommendedScale,
        activeBackbufferWidth: exportW,
        activeBackbufferHeight: exportH,
        offloadedWorkerActive: Boolean(offloadedWorker),
        rVfcCadenceHz: 60,
        exportedFrameCount: 1,
      });

      const rVfcClockVideo = document.createElement('video');
      rVfcClockVideo.muted = true;
      rVfcClockVideo.playsInline = true;

      try {
        rVfcClockVideo.srcObject = exportStream;
        rVfcClockVideo.play().catch(() => {});
        if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
          const onVideoFrameCallback = (now: number) => {
            if (!isSessionActive) return;
            rVfcDeliveredFrames++;
            const deltaMs = Math.max(4, now - lastRvfcTime);
            lastRvfcTime = now;
            const measuredHz = Math.min(60, Math.max(30, Math.round(1000 / deltaMs)));

            if (videoTrack && typeof videoTrack.requestFrame === 'function') {
              try {
                videoTrack.requestFrame();
              } catch {
                // Ignore
              }
            }

            if (rVfcDeliveredFrames % 15 === 0) {
              useStudioStore.setState({
                rVfcCadenceHz: measuredHz,
                exportedFrameCount: Math.max(capturedFrames, rVfcDeliveredFrames),
              });
            }

            rvfcHandle = rVfcClockVideo.requestVideoFrameCallback(onVideoFrameCallback);
          };
          rvfcHandle = rVfcClockVideo.requestVideoFrameCallback(onVideoFrameCallback);
        }
      } catch {
        // Fallback if rVFC is unavailable
      }

      const stepDeterministicExportFrame = () => {
        if (!isSessionActive) return;
        capturedFrames++;
        if (videoTrack && typeof videoTrack.requestFrame === 'function') {
          try {
            videoTrack.requestFrame();
          } catch {
            // Ignore
          }
        }
        if (capturedFrames % 12 === 0) {
          useStudioStore.setState({
            exportedFrameCount: Math.max(capturedFrames, rVfcDeliveredFrames),
          });
        }
      };

      (renderer.domElement as HTMLCanvasElement & { __onExportFrameStep?: () => void }).__onExportFrameStep =
        stepDeterministicExportFrame;

      return {
        exportCanvas: renderer.domElement,
        exportStream,
        exportRenderTarget: raymarchFbo,
        width: exportW,
        height: exportH,
        getCapturedFrames: () => Math.max(capturedFrames, rVfcDeliveredFrames),
        getDroppedFrames: () => 0,
        stopSession: () => {
          if (!isSessionActive) return;
          isSessionActive = false;
          isExportingSessionActive = false;
          explicitVideoQualitySizeActive = false;
          pendingWorkerFixedFrames = 0;
          delete (renderer.domElement as HTMLCanvasElement & { __onExportFrameStep?: () => void })
            .__onExportFrameStep;

          if (offloadedWorker) {
            offloadedWorker.postMessage('stop');
            offloadedWorker.terminate();
          }

          uniforms.u_exportTurbo.value = false;
          casUpscaleMaterial.uniforms.u_fastUpscale.value = false;

          if (rvfcHandle && 'cancelVideoFrameCallback' in HTMLVideoElement.prototype) {
            rVfcClockVideo.cancelVideoFrameCallback(rvfcHandle);
          }
          rVfcClockVideo.pause();
          rVfcClockVideo.srcObject = null;
          useStudioStore.setState({
            offloadedWorkerActive: false,
          });
          syncRenderTargets(true);
        },
      };
    };

    const resizeObserver = new ResizeObserver(() => {
      if (
        !isOfflineDeterministicSessionActive &&
        !isExportingSessionActive &&
        !explicitVideoQualitySizeActive
      ) {
        syncRenderTargets(true);
      }
    });
    resizeObserver.observe(mountEl);
    syncRenderTargets(true);

    const activeKeys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      activeKeys.add(e.code);
      if (e.code === 'KeyH') {
        useStudioStore.getState().cycleViewMode();
      } else if (e.code === 'Space') {
        e.preventDefault();
        audioEngine.togglePlayPause();
      } else if (e.code === 'Digit0') {
        useStudioStore.getState().setFractalMode(9);
      } else if (e.code.startsWith('Digit')) {
        const num = parseInt(e.code.replace('Digit', ''), 10);
        if (num >= 1 && num <= 9) {
          useStudioStore.getState().setFractalMode((num - 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      activeKeys.delete(e.code);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const onDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (!useStudioStore.getState().gyroEnabled) return;
      const gamma = (e.gamma ?? 0) / 45;
      const beta = ((e.beta ?? 45) - 45) / 45;
      transientState.gyroTiltX = Math.max(-1, Math.min(1, gamma));
      transientState.gyroTiltY = Math.max(-1, Math.min(1, beta));
    };
    window.addEventListener('deviceorientation', onDeviceOrientation);

    let frameId = 0;
    let isDisposed = false;
    let lastTime = performance.now();
    let elapsedTime = 1.25;
    let frameCounter = 0;
    let smoothedFrameMs = 16.0;

    function afterDraw(cb: () => void) {
      if (isDisposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (sync && state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 4);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, isExportingSessionActive ? 20 : 75);
        }
      };
      frameId = window.setTimeout(poll, 4);
    }

    function tick() {
      if (isDisposed) return;
      const now = performance.now();
      const rawDtMs = now - lastTime;
      lastTime = now;
      frameCounter++;

      const state = useStudioStore.getState();

      if (state.gpuHeavyMode !== currentCompiledGpuHeavy && !isCompilingShaderAsync) {
        triggerMultithreadedShaderCompile(state.gpuHeavyMode);
      }

      if (isOfflineDeterministicSessionActive || state.offlineRenderProgress.active) {
        frameId = window.setTimeout(tick, 80);
        return;
      }

      if (state.isPreviewHidden && !isExportingSessionActive) {
        frameId = window.setTimeout(tick, 120);
        return;
      }

      if (isExportingSessionActive && state.exportRenderBackend === 'offloaded-rVFC') {
        const FIXED_60FPS_DT = 1 / 60;
        const stepsToRun = pendingWorkerFixedFrames > 0 ? 1 : 1;
        pendingWorkerFixedFrames = Math.max(0, pendingWorkerFixedFrames - 1);
        for (let s = 0; s < stepsToRun; s++) {
          elapsedTime += FIXED_60FPS_DT;
          executeFractalRenderPass(FIXED_60FPS_DT, elapsedTime);
          const stepHook = (renderer.domElement as HTMLCanvasElement & { __onExportFrameStep?: () => void })
            .__onExportFrameStep;
          if (stepHook) stepHook();
        }
      } else {
        const dt = Math.min(0.1, Math.max(0.001, rawDtMs / 1000));
        elapsedTime += dt;
        smoothedFrameMs = smoothedFrameMs * 0.88 + Math.min(60, rawDtMs) * 0.12;

        if (!isExportingSessionActive && !explicitVideoQualitySizeActive && frameCounter % 18 === 0) {
          const fpsEstimate = Math.min(60, Math.max(15, Math.round(1000 / Math.max(16.6, smoothedFrameMs))));
          let nextScale = activeScale;
          if (state.renderScaleMode === 'auto-60fps') {
            const maxAllowed = isSoftwareGl ? 0.5 : 0.95;
            const minAllowed = isSoftwareGl ? 0.35 : 0.5;
            nextScale = computeDynamicRenderScale(activeScale, smoothedFrameMs, minAllowed, maxAllowed);
          } else {
            nextScale = isSoftwareGl ? Math.min(0.55, parseFloat(state.renderScaleMode)) : parseFloat(state.renderScaleMode);
          }

          if (Math.abs(nextScale - activeScale) >= 0.03) {
            activeScale = nextScale;
            syncRenderTargets(false);
          }
          if (fpsEstimate !== state.liveFps || Math.abs(activeScale - state.activeRenderScale) > 0.01) {
            useStudioStore.setState({
              liveFps: fpsEstimate,
              activeRenderScale: activeScale,
            });
          }
        }

        if (activeKeys.has('ArrowLeft') || activeKeys.has('KeyA')) {
          transientState.cameraOrbitX -= 0.9 * dt;
        }
        if (activeKeys.has('ArrowRight') || activeKeys.has('KeyD')) {
          transientState.cameraOrbitX += 0.9 * dt;
        }
        if (activeKeys.has('ArrowUp') || activeKeys.has('KeyW')) {
          transientState.cameraOrbitY = Math.min(1.2, transientState.cameraOrbitY + 0.8 * dt);
        }
        if (activeKeys.has('ArrowDown') || activeKeys.has('KeyS')) {
          transientState.cameraOrbitY = Math.max(-1.2, transientState.cameraOrbitY - 0.8 * dt);
        }

        executeFractalRenderPass(dt, elapsedTime);
        const stepHook = (renderer.domElement as HTMLCanvasElement & { __onExportFrameStep?: () => void })
          .__onExportFrameStep;
        if (stepHook) stepHook();
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('deviceorientation', onDeviceOrientation);
      quadGeo.dispose();
      shaderMaterialCache.forEach((mat) => mat.dispose());
      shaderMaterialCache.clear();
      casUpscaleMaterial.dispose();
      defaultEmblemTexture.dispose();
      if (customLoadedTexture) customLoadedTexture.dispose();
      raymarchFbo.dispose();
      rtA.dispose();
      rtB.dispose();
      renderer.dispose();
      activeWebGlCanvas = null;
      startDecoupledRenderTargetSession = null;
      setWebGlVideoQualitySize = null;
      beginOfflineSessionHook = null;
      renderExactFrameAtTimeHook = null;
      endOfflineSessionHook = null;
    };
  }, []);

  const aspectRatio = useStudioStore((s) => s.aspectRatio);
  const fractalMode = useStudioStore((s) => s.fractalMode);
  const gpuHeavyMode = useStudioStore((s) => s.gpuHeavyMode);
  const isRecording = useStudioStore((s) => s.isRecording);
  const exportRenderBackend = useStudioStore((s) => s.exportRenderBackend);
  const pausePreviewDuringOffload = useStudioStore((s) => s.pausePreviewDuringOffload);
  const activeBackbufferWidth = useStudioStore((s) => s.activeBackbufferWidth);
  const activeBackbufferHeight = useStudioStore((s) => s.activeBackbufferHeight);
  const exportedFrameCount = useStudioStore((s) => s.exportedFrameCount);
  const rVfcCadenceHz = useStudioStore((s) => s.rVfcCadenceHz);
  const recordingSeconds = useStudioStore((s) => s.recordingSeconds);
  const trackDuration = useStudioStore((s) => s.trackDuration);
  const exportResolutionPreset = useStudioStore((s) => s.exportResolutionPreset);
  const offlineRenderProgress = useStudioStore((s) => s.offlineRenderProgress);
  const lastExportUrl = useStudioStore((s) => s.lastExportUrl);
  const lastExportFilename = useStudioStore((s) => s.lastExportFilename);
  const lastExportBlobSize = useStudioStore((s) => s.lastExportBlobSize);
  const exportCompleteModalOpen = useStudioStore((s) => s.exportCompleteModalOpen);
  const setExportCompleteModalOpen = useStudioStore((s) => s.setExportCompleteModalOpen);

  const isPreviewHidden = useStudioStore((s) => s.isPreviewHidden);
  const togglePreviewHidden = useStudioStore((s) => s.togglePreviewHidden);
  const setIsPreviewHidden = useStudioStore((s) => s.setIsPreviewHidden);
  const cycleFractalMode = useStudioStore((s) => s.cycleFractalMode);
  const triggerBeatBang = useStudioStore((s) => s.triggerBeatBang);
  const aiPsychedelicMutate = useStudioStore((s) => s.aiPsychedelicMutate);
  const randomizeDna = useStudioStore((s) => s.randomizeDna);
  const resetCamera = useStudioStore((s) => s.resetCamera);
  const showXyPads = useStudioStore((s) => s.showXyPads);
  const setShowXyPads = useStudioStore((s) => s.setShowXyPads);
  const viewMode = useStudioStore((s) => s.viewMode);
  const toggleCleanPlayerMode = useStudioStore((s) => s.toggleCleanPlayerMode);

  const showOffloadedCurtain =
    isRecording &&
    exportRenderBackend === 'offloaded-rVFC' &&
    pausePreviewDuringOffload &&
    !offlineRenderProgress.active;

  const viewportFrameClass =
    aspectRatio === '9:16'
      ? 'relative h-full aspect-[9/16] max-w-full shadow-2xl border-x border-white/15 overflow-hidden bg-black'
      : aspectRatio === '1:1'
        ? 'relative h-full aspect-square max-w-full shadow-2xl border border-white/15 rounded-lg overflow-hidden bg-black'
        : 'relative w-full h-full max-h-full shadow-2xl border border-white/10 rounded-lg overflow-hidden bg-black';

  return (
    <div
      ref={containerRef}
      data-testid="fractal-viewport"
      data-fractal-mode={fractalMode}
      data-aspect-ratio={aspectRatio}
      data-gpu-heavy-mode={gpuHeavyMode}
      data-export-backend={exportRenderBackend}
      data-view-mode={viewMode}
      data-preview-hidden={isPreviewHidden}
      className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden select-none"
    >
      <div
        ref={canvasMountRef}
        {...bindGestures()}
        onPointerDown={handlePointerDown}
        onTouchStart={handleTouchStart}
        style={{ touchAction: 'none' }}
        className={`${viewportFrameClass} ${
          isPreviewHidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      />

      {/* Hidden Preview Backdrop Card (Shown when user hides the render preview normally or while rendering video) */}
      {isPreviewHidden && (
        <div
          data-hud-interactive="true"
          data-testid="hidden-preview-placeholder"
          className="absolute inset-0 z-20 bg-zinc-950 flex flex-col items-center justify-center p-3 text-center"
        >
          <div className="flex flex-wrap items-center justify-center gap-2 px-3 py-2 rounded-xl bg-zinc-900/95 border border-cyan-400/40 shadow-xl">
            <EyeOff className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-xs font-semibold text-zinc-200">
              {offlineRenderProgress.active || isRecording
                ? 'Render Preview Hidden — Encoding Video Faster in Background'
                : 'Live Render Preview Hidden (GPU Power Save)'}
            </span>
            <button
              type="button"
              data-testid="restore-hidden-preview-btn"
              onClick={() => setIsPreviewHidden(false)}
              className="px-2.5 py-1 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Show Preview</span>
            </button>
          </div>
        </div>
      )}

      {/* Always-Accessible Top-Right Corner EyeOff / Eye "Hide/Show Preview Window" Button (Works normally AND while rendering video!) */}
      <div
        data-hud-interactive="true"
        className="absolute top-1.5 right-1.5 sm:top-2.5 sm:right-2.5 z-40 flex items-center gap-1.5"
      >
        <button
          type="button"
          data-testid="hud-view-mode-btn"
          onClick={togglePreviewHidden}
          title={
            isPreviewHidden
              ? 'Show Render Preview Window'
              : 'Hide Render Preview Window (Also works while rendering video)'
          }
          className={`min-h-[34px] min-w-[34px] sm:min-h-[38px] px-2.5 py-1 rounded-lg backdrop-blur-md border text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 shadow-xl transition-all cursor-pointer ${
            isPreviewHidden
              ? 'bg-cyan-400 text-zinc-950 border-cyan-300 shadow-cyan-500/20'
              : 'bg-zinc-950/85 hover:bg-zinc-900 text-zinc-100 border-cyan-400/50'
          }`}
        >
          {isPreviewHidden ? (
            <>
              <Eye className="w-3.5 h-3.5 text-zinc-950 shrink-0" />
              <span>Show Preview</span>
            </>
          ) : (
            <>
              <EyeOff className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Hide Preview</span>
            </>
          )}
        </button>
      </div>

      {/* Desktop-Only Quick-Action Bar (Hidden on mobile so the live preview canvas is 100% unobstructed) */}
      {viewMode === 'studio' && !offlineRenderProgress.active && !showOffloadedCurtain && (
        <div
          data-hud-interactive="true"
          data-testid="onscreen-quick-actions"
          className="hidden xl:flex absolute top-2.5 left-2.5 right-36 z-20 flex-wrap items-center justify-start gap-1.5 pointer-events-none"
        >
          <button
            type="button"
            data-testid="quick-action-next-mode"
            onClick={cycleFractalMode}
            className="pointer-events-auto min-h-[34px] px-2.5 py-1 rounded-lg bg-zinc-950/80 hover:bg-zinc-900 backdrop-blur-md border border-white/15 text-xs font-semibold text-white flex items-center gap-1.5 shadow-lg transition-colors"
          >
            <FastForward className="w-3.5 h-3.5 text-amber-400" />
            <span>Next Mode</span>
          </button>

          <button
            type="button"
            data-testid="quick-action-beat-bang"
            onClick={triggerBeatBang}
            className="pointer-events-auto min-h-[34px] px-2.5 py-1 rounded-lg bg-zinc-950/80 hover:bg-zinc-900 backdrop-blur-md border border-amber-400/40 text-xs font-semibold text-amber-300 flex items-center gap-1.5 shadow-lg transition-colors"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Beat Bang</span>
          </button>

          <button
            type="button"
            data-testid="quick-action-ai-mutate"
            onClick={aiPsychedelicMutate}
            className="pointer-events-auto min-h-[34px] px-2.5 py-1 rounded-lg bg-zinc-950/80 hover:bg-zinc-900 backdrop-blur-md border border-cyan-400/40 text-xs font-semibold text-cyan-300 flex items-center gap-1.5 shadow-lg transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI Psychedelic Mutate</span>
          </button>

          <button
            type="button"
            data-testid="quick-action-randomize-dna"
            onClick={randomizeDna}
            className="pointer-events-auto min-h-[34px] px-2.5 py-1 rounded-lg bg-zinc-950/80 hover:bg-zinc-900 backdrop-blur-md border border-white/15 text-xs font-medium text-zinc-200 flex items-center gap-1.5 shadow-lg transition-colors"
          >
            <Shuffle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Randomize DNA</span>
          </button>

          <button
            type="button"
            data-testid="quick-action-reset-camera"
            onClick={resetCamera}
            className="pointer-events-auto min-h-[34px] px-2.5 py-1 rounded-lg bg-zinc-950/80 hover:bg-zinc-900 backdrop-blur-md border border-white/15 text-xs font-medium text-zinc-200 flex items-center gap-1.5 shadow-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-zinc-300" />
            <span>Reset Camera</span>
          </button>

          <button
            type="button"
            data-testid="quick-action-xy-pads"
            onClick={() => setShowXyPads(!showXyPads)}
            className={`pointer-events-auto min-h-[34px] px-2.5 py-1 rounded-lg backdrop-blur-md border text-xs font-semibold flex items-center gap-1.5 shadow-lg transition-colors ${
              showXyPads
                ? 'bg-amber-400 text-zinc-950 border-amber-300'
                : 'bg-zinc-950/80 hover:bg-zinc-900 border-white/15 text-zinc-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>XY Pads</span>
          </button>

          <button
            type="button"
            data-testid="quick-action-clean-player"
            onClick={toggleCleanPlayerMode}
            className="pointer-events-auto min-h-[34px] px-2.5 py-1 rounded-lg bg-zinc-950/80 hover:bg-zinc-900 backdrop-blur-md border border-cyan-400/40 text-xs font-semibold text-cyan-300 flex items-center gap-1.5 shadow-lg transition-colors"
          >
            <EyeOff className="w-3.5 h-3.5 text-cyan-400" />
            <span>Hide Overlays</span>
          </button>
        </div>
      )}

      {/* Deterministic Offline Frame-by-Frame Render Progress Modal Overlay (Fixed z-50 so never clipped on mobile) */}
      {(offlineRenderProgress.active || offlineRenderProgress.phase === 'error') && (
        <div
          data-hud-interactive="true"
          data-testid="offline-render-modal"
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
        >
          <div className="w-full max-w-xl bg-zinc-950/95 border-2 border-emerald-400/60 rounded-2xl p-4 shadow-2xl my-auto">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-400/15 border border-emerald-400/30 text-emerald-300 text-[11px] font-mono">
                <Cpu className="w-3.5 h-3.5 animate-pulse" />
                <span>ZERO-LAG OFFLINE FRAME-BY-FRAME RENDERER</span>
              </div>
              <span className="text-[11px] font-mono text-cyan-300">
                {offlineRenderProgress.encoderName}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-zinc-200 mb-1.5 gap-2">
              <span className="truncate">{offlineRenderProgress.statusLabel}</span>
              <span className="text-emerald-400 font-bold shrink-0">
                {offlineRenderProgress.percent}%
              </span>
            </div>

            <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-white/10 mb-3">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-amber-400 transition-all duration-150"
                style={{ width: `${Math.max(2, offlineRenderProgress.percent)}%` }}
              />
            </div>

            <div className="grid grid-cols-4 gap-2 p-2 bg-zinc-900/90 rounded-lg border border-white/10 font-mono text-[11px] mb-3">
              <div>
                <div className="text-[10px] text-zinc-400">Frame</div>
                <div className="text-white font-semibold">
                  {offlineRenderProgress.currentFrame} / {offlineRenderProgress.totalFrames}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-400">Resolution</div>
                <div className="text-cyan-300 font-semibold">
                  {activeBackbufferWidth}×{activeBackbufferHeight}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-400">Render Speed</div>
                <div className="text-emerald-400 font-semibold">
                  {offlineRenderProgress.fpsSpeed} fps
                </div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-400">ETA</div>
                <div className="text-amber-300 font-semibold">
                  {formatTimestamp(offlineRenderProgress.etaSeconds)}
                </div>
              </div>
            </div>

            {!isPreviewHidden && (
              <div className="mb-3 rounded-lg overflow-hidden border border-emerald-400/30 bg-black/90 flex items-center justify-center">
                <canvas
                  id="offline-export-live-preview-canvas"
                  data-testid="offline-export-live-preview-canvas"
                  className="w-full max-h-36 object-contain block"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                data-testid="render-modal-toggle-preview-btn"
                onClick={togglePreviewHidden}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer ${
                  isPreviewHidden
                    ? 'bg-cyan-400 text-zinc-950 border-cyan-300 font-bold'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-cyan-300 border-cyan-400/40'
                }`}
              >
                {isPreviewHidden ? (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Show Render Preview</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Hide Render Preview</span>
                  </>
                )}
              </button>

              <button
                type="button"
                data-testid="cancel-offline-render-btn"
                onClick={() => {
                  if (offlineRenderProgress.phase === 'error') {
                    useStudioStore.getState().setOfflineRenderProgress({
                      active: false,
                      phase: 'idle',
                    });
                  } else if (externalStopExportHook) {
                    externalStopExportHook();
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>{offlineRenderProgress.phase === 'error' ? 'Dismiss' : 'Cancel'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Behind-the-Scenes Offloaded rVFC Curtain */}
      {showOffloadedCurtain && (
        <div
          data-hud-interactive="true"
          data-testid="offloaded-render-curtain"
          className="absolute inset-0 z-20 bg-zinc-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
        >
          <div className="max-w-md w-full bg-zinc-900 border border-cyan-400/40 rounded-xl p-5 shadow-2xl space-y-3.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-cyan-400/15 border border-cyan-400/30 text-cyan-300 text-xs font-mono">
              <Layers className="w-3.5 h-3.5" />
              <span>BEHIND-THE-SCENES OFFLOADED RENDER ACTIVE</span>
            </div>

            <h3 className="text-base font-bold text-white">
              Rendering {exportResolutionPreset.toUpperCase()} ({activeBackbufferWidth}×{activeBackbufferHeight}) @ 60 FPS Behind the Scenes
            </h3>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Live screen capture is <span className="text-amber-300 font-semibold">disabled</span>. Your video is being rendered in the offloaded <code className="text-cyan-300">WebGLRenderTarget</code> + <code className="text-amber-300">requestVideoFrameCallback</code> loop at a locked <code className="text-emerald-300">16.67ms (1/60s)</code> frame step so UI fluctuations never cause lag.
            </p>

            <div className="grid grid-cols-3 gap-2 p-2.5 bg-zinc-950 rounded-lg border border-white/10 font-mono text-xs">
              <div>
                <div className="text-[10px] text-zinc-400">rVFC Clock</div>
                <div className="text-emerald-400 font-semibold">{rVfcCadenceHz} FPS</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-400">Encoded Frames</div>
                <div className="text-cyan-300 font-semibold">{exportedFrameCount}</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-400">Elapsed</div>
                <div className="text-amber-400 font-semibold">
                  {formatTimestamp(recordingSeconds)} / {formatTimestamp(trackDuration)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => useStudioStore.getState().setPausePreviewDuringOffload(false)}
                className="flex-1 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg border border-white/10 transition-colors"
              >
                Peek Behind-the-Scenes Render
              </button>
              <button
                type="button"
                onClick={() => {
                  if (externalStopExportHook) externalStopExportHook();
                }}
                className="flex-1 py-2 px-3 bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Finish & Download Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prominent Mobile-First "RENDER COMPLETE — SAVE VIDEO TO YOUR PHONE" Modal */}
      {exportCompleteModalOpen &&
        lastExportUrl &&
        lastExportFilename &&
        !offlineRenderProgress.active && (
          <div
            data-hud-interactive="true"
            data-testid="export-complete-modal"
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
          >
            <div className="w-full max-w-md bg-zinc-950 border-2 border-emerald-400/70 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3.5 my-auto">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-400/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300 shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-bold">
                      100% Render Complete
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      Save Video to Your Phone
                    </h3>
                  </div>
                </div>
                <span
                  data-testid="export-complete-filesize"
                  className="px-2 py-1 rounded-md bg-emerald-400/15 border border-emerald-400/40 text-emerald-300 text-xs font-mono font-bold shrink-0"
                >
                  {formatFileSize(lastExportBlobSize)}
                </span>
              </div>

              <div className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/10 text-[11px] font-mono text-zinc-300 truncate">
                {lastExportFilename}
              </div>

              {/* Inline Video Player (Supports native Android/iOS ⋮ -> Download & long-press save) */}
              <video
                data-testid="export-complete-video-preview"
                src={lastExportUrl}
                controls
                playsInline
                autoPlay
                loop
                muted
                className="w-full max-h-48 rounded-xl bg-black border border-white/15 shadow-inner"
              />

              {/* Primary Direct User-Gesture Download & Native Phone Share Sheet Buttons */}
              <div className="flex flex-col gap-2 pt-1">
                <a
                  href={lastExportUrl}
                  download={lastExportFilename}
                  data-testid="modal-download-video-btn"
                  onClick={() => {
                    triggerDirectVideoDownload();
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 active:scale-[0.99] text-zinc-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>Tap to Download Video to Phone ({formatFileSize(lastExportBlobSize)})</span>
                </a>

                <button
                  type="button"
                  data-testid="modal-share-video-btn"
                  onClick={() => {
                    triggerNativePhoneShare();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-zinc-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
                >
                  <Share2 className="w-4 h-4 shrink-0" />
                  <span>Save / Share to Phone (Files · Gallery · Apps)</span>
                </button>
              </div>

              <p className="text-[11px] text-zinc-400 leading-relaxed text-center">
                Tip: You can also tap <span className="text-zinc-200 font-semibold">⋮</span> on the video player above or long-press the video to save directly on Android &amp; iOS.
              </p>

              <button
                type="button"
                data-testid="close-export-complete-modal-btn"
                onClick={() => setExportCompleteModalOpen(false)}
                className="w-full py-2 px-3 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/15 text-xs font-semibold transition-colors"
              >
                Close &amp; Continue Editing (Video stays in Export Tab)
              </button>
            </div>
          </div>
        )}
    </div>
  );
}
