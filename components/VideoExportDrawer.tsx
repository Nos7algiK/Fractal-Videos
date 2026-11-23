'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Video,
  Download,
  Square,
  CircleDot,
  Smartphone,
  Monitor,
  Sparkles,
  Music,
  Cpu,
  Gauge,
  Upload,
  Layers,
  Zap,
  FileVideo,
  Wand2,
  Maximize2,
  Share2,
  CheckCircle2,
  Eye,
  EyeOff,
  Scissors,
  Play,
  ChevronRight,
} from 'lucide-react';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import {
  Muxer as WebmMuxer,
  ArrayBufferTarget as WebmArrayBufferTarget,
} from 'webm-muxer';
import { transientState, useStudioStore } from '@/lib/store';
import { audioEngine } from '@/lib/audio-engine';
import { buildStandaloneWebGl2FragmentShader } from '@/lib/fractal-shaders';
import { FRACTAL_MODE_INFO } from '@/lib/presets';
import {
  computeRgbaDepthMapInPlace,
  computeZoomDirectionMultiplier,
  extractJitAudioBandsAtTime,
  formatTimestamp,
  getActiveChoreographyKeyframe,
  getExportResolutionDimensions,
  getSongSectionsWithTimeRanges,
  getVideoFormatSpecification,
  resolveExportSegmentRange,
} from '@/lib/dsp-math';
import {
  AspectRatioMode,
  ExportBitratePreset,
  ExportDurationMode,
  ExportFpsPreset,
  ExportResolutionPreset,
  ExportVideoFormat,
  FractalMode,
  PrecomputedAudioFrame,
  PreviewResolutionCap,
  RenderScaleMode,
  SubFrameMotionBlur,
  VideoQualityPreset,
  VisualChoreography,
} from '@/lib/types';
import {
  applyVideoQualityRenderSize,
  createDecoupledExportSession,
  DecoupledExportSession,
  endDeterministicOfflineSession,
  getActiveVisualizerCanvas,
  registerExternalStopExportHook,
} from './FractalCanvas';

// Module-level singleton recording state so switching tabs never interrupts a video export
let activeRecorder: MediaRecorder | null = null;
let activeDecoupledSession: DecoupledExportSession | null = null;
let recordedChunks: Blob[] = [];
let progressTimer: number | null = null;
let activeTargetDurationSec = 180;
let liveCapturedFrameCount = 0;
let liveDroppedFrameCount = 0;
let offlineRenderCancelled = false;
let lastExportedBlob: Blob | null = null;

export function getLastExportedBlob(): Blob | null {
  return lastExportedBlob;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Triggers a direct synchronous browser file download inside an active user tap/click gesture.
 */
export function triggerDirectVideoDownload(): boolean {
  const { lastExportUrl, lastExportFilename } = useStudioStore.getState();
  if (!lastExportUrl || !lastExportFilename || typeof document === 'undefined') {
    return false;
  }
  try {
    const a = document.createElement('a');
    a.href = lastExportUrl;
    a.download = lastExportFilename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 250);
    return true;
  } catch {
    return false;
  }
}

/**
 * Opens the native Android / iOS system Share & Save sheet with the rendered video file
 * so smartphone users in WebViews or mobile browsers can save directly to Gallery / Downloads / Files.
 */
export async function triggerNativePhoneShare(): Promise<{ ok: boolean; message: string }> {
  const { lastExportFilename } = useStudioStore.getState();
  const filename = lastExportFilename || 'ChromaFract-Render.mp4';

  if (
    lastExportedBlob &&
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof File !== 'undefined'
  ) {
    try {
      const videoFile = new File([lastExportedBlob], filename, {
        type: lastExportedBlob.type || 'video/mp4',
      });
      const canShareFiles =
        typeof navigator.canShare === 'function'
          ? navigator.canShare({ files: [videoFile] })
          : true;

      if (canShareFiles) {
        await navigator.share({
          files: [videoFile],
          title: filename,
          text: `Rendered with ChromaFract 4D/3D Studio (${formatFileSize(lastExportedBlob.size)})`,
        });
        return { ok: true, message: `Opened phone Save / Share sheet for ${filename}` };
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { ok: false, message: 'Share sheet closed.' };
      }
    }
  }

  const downloaded = triggerDirectVideoDownload();
  return {
    ok: downloaded,
    message: downloaded
      ? `Downloading ${filename} to your device...`
      : 'Use the video player menu (⋮ -> Download) or Download button.',
  };
}

export function getExportFrameTelemetry(): { captured: number; dropped: number } {
  if (activeDecoupledSession) {
    liveCapturedFrameCount = activeDecoupledSession.getCapturedFrames();
    liveDroppedFrameCount = activeDecoupledSession.getDroppedFrames();
  }
  return { captured: liveCapturedFrameCount, dropped: liveDroppedFrameCount };
}

function detectSupportedMimeType(
  format: ExportVideoFormat,
  preset: ExportResolutionPreset
): {
  recorderMimeType: string;
  blobType: string;
  ext: string;
  formatLabel: string;
} {
  const spec = getVideoFormatSpecification(format);
  if (typeof MediaRecorder === 'undefined') {
    return {
      recorderMimeType: '',
      blobType: spec.blobType,
      ext: spec.ext,
      formatLabel: spec.label,
    };
  }

  for (const candidate of spec.mimeCandidates) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return {
        recorderMimeType: candidate,
        blobType: spec.blobType,
        ext: spec.ext,
        formatLabel: spec.label,
      };
    }
  }

  const fallbackCandidates =
    preset === '4k' || preset === '1440p'
      ? [
          'video/mp4;codecs=avc1.640034,mp4a.40.2',
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/mp4',
          'video/webm',
        ]
      : [
          'video/mp4;codecs=avc1,mp4a.40.2',
          'video/mp4',
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm',
        ];

  for (const fallback of fallbackCandidates) {
    if (MediaRecorder.isTypeSupported(fallback)) {
      return {
        recorderMimeType: fallback,
        blobType: spec.blobType,
        ext: spec.ext,
        formatLabel: spec.label,
      };
    }
  }

  return {
    recorderMimeType: '',
    blobType: spec.blobType,
    ext: spec.ext,
    formatLabel: spec.label,
  };
}

function resolveCurrentStoreSegment() {
  const s = useStudioStore.getState();
  const activeChoreo = s.choreographies[s.activeChoreographyIndex] ?? s.choreographies[0];
  return resolveExportSegmentRange({
    mode: s.exportDurationMode,
    trackDuration: s.trackDuration,
    keyframes: activeChoreo?.timelineKeyframes,
    customStartSec: s.customExportStartSec,
    customEndSec: s.customExportEndSec,
    loopA: s.loopA,
    loopB: s.loopB,
  });
}

const offlineCancelRef = { current: false };

export function stopSynchronizedMusicVideoExport() {
  offlineRenderCancelled = true;
  offlineCancelRef.current = true;
  if (progressTimer !== null) {
    window.clearInterval(progressTimer);
    progressTimer = null;
  }
  audioEngine.restoreLoopingAfterExport();

  if (activeRecorder && activeRecorder.state !== 'inactive') {
    activeRecorder.stop();
  } else {
    if (activeDecoupledSession) {
      activeDecoupledSession.stopSession();
      activeDecoupledSession = null;
    }
    endDeterministicOfflineSession();
    useStudioStore.getState().setRecordingState(false, 0);
    useStudioStore.getState().setOfflineRenderProgress({
      active: false,
      phase: 'idle',
      statusLabel: 'Export stopped',
    });
  }
}

async function createStandaloneGlTextureFromUrl(
  gl: WebGL2RenderingContext,
  textureUnit: number,
  url: string | null
): Promise<WebGLTexture | null> {
  const tex = gl.createTexture();
  if (!tex) return null;
  gl.activeTexture(gl.TEXTURE0 + textureUnit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // Initialize with a procedural 64x64 RGBA texture with depth in alpha
  const size = 64;
  const fallbackData = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = (x - 32) / 32;
      const dy = (y - 32) / 32;
      const r = Math.sqrt(dx * dx + dy * dy);
      const ring = Math.max(0, Math.sin(r * 12.0));
      fallbackData[idx] = Math.round(20 + ring * 210);
      fallbackData[idx + 1] = Math.round(40 + (1 - Math.min(1, r)) * 180);
      fallbackData[idx + 2] = Math.round(80 + ring * 160);
      fallbackData[idx + 3] = Math.round(Math.max(0.1, 1 - r * 0.7) * 255);
    }
  }
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    size,
    size,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    fallbackData
  );

  if (!url || typeof document === 'undefined') {
    return tex;
  }

  await new Promise<void>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = 512;
        c.height = 512;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 512, 512);
          const imgData = ctx.getImageData(0, 0, 512, 512);
          computeRgbaDepthMapInPlace(imgData.data, 512, 512);
          gl.activeTexture(gl.TEXTURE0 + textureUnit);
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            512,
            512,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            imgData.data
          );
        }
      } catch {}
      resolve();
    };
    img.onerror = () => resolve();
    img.src = url;
  });

  return tex;
}

interface StandaloneWebGl2ContextCache {
  glCanvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  quadBuf: WebGLBuffer | null;
  posLoc: number;
  fragmentShaderSource: string;
  intUniformNames: Set<string>;
  uniformLocations: Map<string, WebGLUniformLocation | null>;
}

let cachedStandaloneGl2: StandaloneWebGl2ContextCache | null = null;

function getOrInitStandaloneWebGl2(
  W: number,
  H: number,
  fragmentShaderSource: string
): StandaloneWebGl2ContextCache {
  if (
    cachedStandaloneGl2 &&
    !cachedStandaloneGl2.gl.isContextLost() &&
    cachedStandaloneGl2.fragmentShaderSource === fragmentShaderSource
  ) {
    cachedStandaloneGl2.glCanvas.width = W;
    cachedStandaloneGl2.glCanvas.height = H;
    cachedStandaloneGl2.gl.viewport(0, 0, W, H);
    cachedStandaloneGl2.gl.useProgram(cachedStandaloneGl2.program);
    return cachedStandaloneGl2;
  }

  const glCanvas = cachedStandaloneGl2?.glCanvas || document.createElement('canvas');
  glCanvas.width = W;
  glCanvas.height = H;
  const gl =
    (cachedStandaloneGl2 && !cachedStandaloneGl2.gl.isContextLost()
      ? cachedStandaloneGl2.gl
      : null) ||
    glCanvas.getContext('webgl2', {
      preserveDrawingBuffer: true,
      antialias: false,
      alpha: true,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    });

  if (!gl) throw new Error('WebGL2 not available for export');

  const vsSource = `#version 300 es
    in vec2 position;
    out vec2 vUv;
    void main() {
      vUv = position * 0.5 + 0.5;
      vUv.y = 1.0 - vUv.y; // Flip Y so gl.readPixels matches top-down VideoFrame RGBA memory
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const compileShader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(s));
    }
    return s;
  };

  const normalizedBody = fragmentShaderSource
    .replace(/^#version\s+300\s+es\s*/m, '')
    .replace(/varying\s+vec2\s+vUv\s*;/g, 'in vec2 vUv;\nout vec4 outFragColor;')
    .replace(/\btexture2D\s*\(/g, 'texture(')
    .replace(/\bgl_FragColor\b/g, 'outFragColor');
  const cleanFs = `#version 300 es\nprecision highp float;\nprecision highp int;\n${normalizedBody}`;

  const program = gl.createProgram()!;
  const vs = compileShader(gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl.FRAGMENT_SHADER, cleanFs);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.useProgram(program);

  const intUniformNames = new Set<string>();
  const uniformLocations = new Map<string, WebGLUniformLocation | null>();
  const activeUniformCount = (gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number) || 0;
  for (let uIdx = 0; uIdx < activeUniformCount; uIdx++) {
    const info = gl.getActiveUniform(program, uIdx);
    if (!info) continue;
    const cleanName = info.name.replace(/\[0\]$/, '');
    uniformLocations.set(cleanName, gl.getUniformLocation(program, cleanName));
    if (
      info.type === gl.INT ||
      info.type === gl.BOOL ||
      info.type === gl.SAMPLER_2D
    ) {
      intUniformNames.add(cleanName);
    }
  }

  const quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );
  const posLoc = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  cachedStandaloneGl2 = {
    glCanvas,
    gl,
    program,
    quadBuf,
    posLoc,
    fragmentShaderSource,
    intUniformNames,
    uniformLocations,
  };
  return cachedStandaloneGl2;
}

type ExportPixelFormat = 'RGBX' | 'I420' | 'RGBA';
type ExportContainerKind = 'mp4' | 'webm';

interface NegotiatedVideoEncoderCandidate {
  container: ExportContainerKind;
  muxerVideoCodec: 'avc' | 'V_VP9' | 'V_VP8';
  config: VideoEncoderConfig;
  pixelFormat: ExportPixelFormat;
  width: number;
  height: number;
  fps: number;
  label: string;
}

/**
 * Fast, zero-allocation RGBA (gl.readPixels output) -> planar YUV 4:2:0 (I420) converter
 * using integer BT.601 coefficients with 2x2 chroma subsampling.
 * I420 is universally accepted by every hardware & software H.264 / VP9 / VP8 encoder
 * including Android MediaCodec and OpenH264.
 */
function rgbaToI420(
  rgba: Uint8Array,
  width: number,
  height: number,
  out: Uint8Array
): Uint8Array {
  const frameSize = width * height;
  const halfW = width >> 1;
  const uOffset = frameSize;
  const vOffset = frameSize + (frameSize >> 2);

  for (let y = 0; y < height; y++) {
    const rowStart = y * width;
    const rgbaRow = rowStart << 2;
    for (let x = 0; x < width; x++) {
      const p = rgbaRow + (x << 2);
      const r = rgba[p];
      const g = rgba[p + 1];
      const b = rgba[p + 2];
      out[rowStart + x] = ((66 * r + 129 * g + 25 * b + 128) >> 8) + 16;
    }
  }

  for (let y = 0; y < height; y += 2) {
    const row0 = (y * width) << 2;
    const row1 = ((y + 1) * width) << 2;
    const uvRow = (y >> 1) * halfW;
    for (let x = 0; x < width; x += 2) {
      const p00 = row0 + (x << 2);
      const p01 = p00 + 4;
      const p10 = row1 + (x << 2);
      const p11 = p10 + 4;

      const r = (rgba[p00] + rgba[p01] + rgba[p10] + rgba[p11] + 2) >> 2;
      const g = (rgba[p00 + 1] + rgba[p01 + 1] + rgba[p10 + 1] + rgba[p11 + 1] + 2) >> 2;
      const b = (rgba[p00 + 2] + rgba[p01 + 2] + rgba[p10 + 2] + rgba[p11 + 2] + 2) >> 2;

      const uvIdx = uvRow + (x >> 1);
      out[uOffset + uvIdx] = ((-38 * r - 74 * g + 112 * b + 128) >> 8) + 128;
      out[vOffset + uvIdx] = ((112 * r - 94 * g - 18 * b + 128) >> 8) + 128;
    }
  }

  return out;
}

function computeSafeVideoBitrate(width: number, height: number, fps: number): number {
  const pixels = width * height;
  const fpsBoost = fps > 35 ? 1.25 : 1.0;
  if (pixels >= 3840 * 2160) return Math.round(18_000_000 * fpsBoost);
  if (pixels >= 2560 * 1440) return Math.round(12_000_000 * fpsBoost);
  if (pixels >= 1920 * 1080) return Math.round(8_000_000 * fpsBoost);
  if (pixels >= 1280 * 720) return Math.round(5_000_000 * fpsBoost);
  return Math.round(3_500_000 * fpsBoost);
}

function buildLevelMatchedH264Codecs(width: number, height: number, fps: number): string[] {
  const pixels = width * height;
  const maxDim = Math.max(width, height);
  // Pick H.264 levels that match actual macroblock rate so Android MediaCodec & OpenH264 never reject on level overflow
  if (pixels >= 3840 * 2160 || maxDim >= 3000) {
    return [
      'avc1.640033', // High L5.1
      'avc1.4D4033', // Main L5.1
      'avc1.42E033', // Constrained Baseline L5.1
      'avc1.640034', // High L5.2
      'avc1.640032', // High L5.0
      'avc1.4D4032', // Main L5.0
      'avc1.420032', // Baseline L5.0
    ];
  }
  if (pixels >= 2560 * 1440 || maxDim >= 2200) {
    return [
      'avc1.640032', // High L5.0
      'avc1.4D4032', // Main L5.0
      'avc1.42E032', // Constrained Baseline L5.0
      'avc1.64002A', // High L4.2
      'avc1.4D402A', // Main L4.2
      'avc1.42002A', // Baseline L4.2
    ];
  }
  if (pixels >= 1920 * 1080 || maxDim >= 1500) {
    return fps > 35
      ? [
          'avc1.4D402A', // Main L4.2 (1080p60)
          'avc1.42E02A', // Constrained Baseline L4.2
          'avc1.64002A', // High L4.2
          'avc1.42002A', // Baseline L4.2
          'avc1.4D4028', // Main L4.0
          'avc1.640028', // High L4.0
        ]
      : [
          'avc1.4D4028', // Main L4.0 (1080p30)
          'avc1.42E028', // Constrained Baseline L4.0
          'avc1.640028', // High L4.0
          'avc1.420028', // Baseline L4.0
          'avc1.4D402A', // Main L4.2
          'avc1.64002A', // High L4.2
        ];
  }
  return fps > 35
    ? [
        'avc1.4D4020', // Main L3.2 (720p60 spec)
        'avc1.42E020', // Constrained Baseline L3.2
        'avc1.640020', // High L3.2
        'avc1.4D4028', // Main L4.0
        'avc1.640028', // High L4.0
        'avc1.4D401F', // Main L3.1 fallback
      ]
    : [
        'avc1.4D401F', // Main L3.1 (720p30)
        'avc1.42E01F', // Constrained Baseline L3.1
        'avc1.64001F', // High L3.1
        'avc1.42001F', // Baseline L3.1
        'avc1.4D4028', // Main L4.0
        'avc1.42E01E', // Constrained Baseline L3.0
        'avc1.42001E', // Baseline L3.0
      ];
}

/**
 * Live 1-frame encode + flush probe.
 * VideoEncoder.isConfigSupported() frequently returns false positives on Android MediaCodec
 * and GPU drivers (reporting supported: true, then crashing with "Encoding error." on frame 0).
 * This probe silently tests encoding one real binary VideoFrame before starting the export.
 */
async function probeVideoEncoderCandidate(
  cfg: VideoEncoderConfig,
  pixelFormat: ExportPixelFormat,
  probeBuffers: Map<string, Uint8Array>
): Promise<VideoEncoderConfig | null> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    return null;
  }

  let effectiveConfig: VideoEncoderConfig = cfg;
  try {
    const support = await VideoEncoder.isConfigSupported(cfg);
    if (!support.supported) return null;
    if (support.config) {
      effectiveConfig = {
        ...support.config,
        ...(cfg.avc ? { avc: cfg.avc } : {}),
      };
    }
  } catch {
    return null;
  }

  const w = effectiveConfig.width;
  const h = effectiveConfig.height;
  const fps = effectiveConfig.framerate || 30;
  const bufKey = `${pixelFormat}:${w}x${h}`;
  let testData = probeBuffers.get(bufKey);
  if (!testData) {
    const byteLen = pixelFormat === 'I420' ? (w * h * 3) >> 1 : w * h * 4;
    testData = new Uint8Array(byteLen);
    if (pixelFormat === 'I420') {
      testData.fill(16, 0, w * h);
      testData.fill(128, w * h);
    } else {
      // Fill alpha byte with 255
      for (let i = 3; i < byteLen; i += 4) testData[i] = 255;
    }
    probeBuffers.set(bufKey, testData);
  }

  let producedChunks = 0;
  let probeFailed = false;
  let encoder: VideoEncoder | null = null;
  let testFrame: VideoFrame | null = null;

  try {
    encoder = new VideoEncoder({
      output: () => {
        producedChunks++;
      },
      error: () => {
        // Silent during probing so recoverable codec rejections never pollute console.error
        probeFailed = true;
      },
    });
    encoder.configure(effectiveConfig);

    testFrame = new VideoFrame(testData, {
      format: pixelFormat,
      codedWidth: w,
      codedHeight: h,
      timestamp: 0,
      duration: Math.round(1_000_000 / Math.max(1, fps)),
    });

    if (encoder.state !== 'configured' || probeFailed) {
      return null;
    }

    encoder.encode(testFrame, { keyFrame: true });
    testFrame.close();
    testFrame = null;

    let timedOut = false;
    await Promise.race([
      encoder.flush().catch(() => {
        probeFailed = true;
      }),
      new Promise<void>((resolve) =>
        setTimeout(() => {
          timedOut = true;
          resolve();
        }, 1200)
      ),
    ]);

    if (
      timedOut ||
      probeFailed ||
      producedChunks === 0 ||
      (encoder.state as CodecState) === 'closed'
    ) {
      return null;
    }
    return effectiveConfig;
  } catch {
    return null;
  } finally {
    try {
      if (testFrame) testFrame.close();
    } catch {}
    try {
      if (encoder && encoder.state !== 'closed') encoder.close();
    } catch {}
  }
}

async function negotiateWorkingVideoEncoder({
  requestedWidth,
  requestedHeight,
  requestedFps,
  mode,
}: {
  requestedWidth: number;
  requestedHeight: number;
  requestedFps: number;
  mode: 'default' | 'software-i420' | 'webm-fallback';
}): Promise<NegotiatedVideoEncoderCandidate | null> {
  const probeBuffers = new Map<string, Uint8Array>();

  const makeDimPairs = (baseW: number, baseH: number): Array<{ w: number; h: number }> => {
    const pairs: Array<{ w: number; h: number }> = [];
    const seen = new Set<string>();
    const addPair = (w: number, h: number) => {
      const ew = Math.max(256, Math.floor(w / 2) * 2);
      const eh = Math.max(256, Math.floor(h / 2) * 2);
      const key = `${ew}x${eh}`;
      if (!seen.has(key)) {
        seen.add(key);
        pairs.push({ w: ew, h: eh });
      }
    };
    const addAligned16 = (w: number, h: number) => {
      const aw = Math.max(256, Math.floor(w / 16) * 16);
      const ah = Math.max(256, Math.floor(h / 16) * 16);
      addPair(aw, ah);
    };

    const scales = [1.0, 0.75, 0.5];
    for (const s of scales) {
      if (mode === 'default') {
        addPair(baseW * s, baseH * s);
        addAligned16(baseW * s, baseH * s);
      } else {
        // Software / fallback prefers 16-pixel aligned dimensions first for maximum MediaCodec/OpenH264 stability
        addAligned16(baseW * s, baseH * s);
        addPair(baseW * s, baseH * s);
      }
    }
    return pairs;
  };

  const dimPairs = makeDimPairs(requestedWidth, requestedHeight);
  const fpsCandidates =
    mode === 'default'
      ? requestedFps > 30
        ? [requestedFps, 30]
        : [requestedFps]
      : [Math.min(30, requestedFps)];

  // 1. H.264 MP4 candidates (unless explicitly requesting WebM fallback)
  if (mode !== 'webm-fallback') {
    const hwOrder: HardwareAcceleration[] =
      mode === 'software-i420'
        ? ['prefer-software', 'no-preference']
        : ['no-preference', 'prefer-software', 'prefer-hardware'];
    const pixelFormats: ExportPixelFormat[] =
      mode === 'software-i420' ? ['I420', 'RGBX'] : ['RGBX', 'I420', 'RGBA'];

    for (const { w, h } of dimPairs) {
      for (const testFps of fpsCandidates) {
        const codecs = buildLevelMatchedH264Codecs(w, h, testFps);
        const bitrate = computeSafeVideoBitrate(w, h, testFps);
        for (const hw of hwOrder) {
          let hwLiveFailures = 0;
          for (const codec of codecs) {
            if (hwLiveFailures >= 4) break;
            for (const pixFmt of pixelFormats) {
              const cfg: VideoEncoderConfig = {
                codec,
                width: w,
                height: h,
                bitrate,
                framerate: testFps,
                hardwareAcceleration: hw,
                bitrateMode: 'variable',
                latencyMode: 'quality',
                avc: { format: 'avc' },
              };
              const verified = await probeVideoEncoderCandidate(cfg, pixFmt, probeBuffers);
              if (verified) {
                return {
                  container: 'mp4',
                  muxerVideoCodec: 'avc',
                  config: verified,
                  pixelFormat: pixFmt,
                  width: w,
                  height: h,
                  fps: testFps,
                  label: `WebCodecs H.264 (${codec}, ${hw}, ${pixFmt})`,
                };
              }
              hwLiveFailures++;
            }
          }
        }
      }
    }
  }

  // 2. WebM (VP9 / VP8) fallback candidates — works even on browsers without proprietary H.264 encoders
  const webmSpecs: Array<{ codec: string; muxerCodec: 'V_VP9' | 'V_VP8' }> = [
    { codec: 'vp09.00.31.08', muxerCodec: 'V_VP9' },
    { codec: 'vp09.00.10.08', muxerCodec: 'V_VP9' },
    { codec: 'vp8', muxerCodec: 'V_VP8' },
  ];
  const webmHwOrder: HardwareAcceleration[] = ['no-preference', 'prefer-software'];
  const webmPixelFormats: ExportPixelFormat[] = ['I420', 'RGBX'];

  for (const { w, h } of dimPairs) {
    for (const testFps of fpsCandidates) {
      const bitrate = computeSafeVideoBitrate(w, h, testFps);
      for (const spec of webmSpecs) {
        for (const hw of webmHwOrder) {
          for (const pixFmt of webmPixelFormats) {
            const cfg: VideoEncoderConfig = {
              codec: spec.codec,
              width: w,
              height: h,
              bitrate,
              framerate: testFps,
              hardwareAcceleration: hw,
              bitrateMode: 'variable',
            };
            const verified = await probeVideoEncoderCandidate(cfg, pixFmt, probeBuffers);
            if (verified) {
              return {
                container: 'webm',
                muxerVideoCodec: spec.muxerCodec,
                config: verified,
                pixelFormat: pixFmt,
                width: w,
                height: h,
                fps: testFps,
                label: `WebCodecs WebM (${spec.codec}, ${pixFmt})`,
              };
            }
          }
        }
      }
    }
  }

  return null;
}

async function preEncodeAudioForContainer(
  audioBuffer: AudioBuffer | null,
  container: ExportContainerKind,
  shouldCancelRef: { current: boolean }
): Promise<{
  chunks: Array<{ chunk: EncodedAudioChunk; meta?: EncodedAudioChunkMetadata }>;
  valid: boolean;
}> {
  const encodedAudioChunks: Array<{
    chunk: EncodedAudioChunk;
    meta?: EncodedAudioChunkMetadata;
  }> = [];

  if (!audioBuffer || typeof window === 'undefined' || !('AudioEncoder' in window)) {
    return { chunks: encodedAudioChunks, valid: false };
  }

  const audioCodec = container === 'webm' ? 'opus' : 'mp4a.40.2';
  const audioBitrate = container === 'webm' ? 128_000 : 192_000;

  try {
    const aRes = await AudioEncoder.isConfigSupported({
      codec: audioCodec,
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: audioBuffer.numberOfChannels,
      bitrate: audioBitrate,
    });
    if (!aRes.supported) {
      return { chunks: encodedAudioChunks, valid: false };
    }

    let audioEncoderFailed = false;
    const audioEncoder = new AudioEncoder({
      output: (chunk, meta) => {
        encodedAudioChunks.push({ chunk, meta });
      },
      error: (err) => {
        console.warn('AudioEncoder warning (falling back to video-only track):', err);
        audioEncoderFailed = true;
      },
    });
    audioEncoder.configure({
      codec: audioCodec,
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: audioBuffer.numberOfChannels,
      bitrate: audioBitrate,
    });

    const numCh = audioBuffer.numberOfChannels;
    const totalSamples = audioBuffer.length;
    const chunkSize = 4096;
    let audioChunkCounter = 0;

    for (let offset = 0; offset < totalSamples; offset += chunkSize) {
      if (shouldCancelRef.current || audioEncoderFailed) break;
      const len = Math.min(chunkSize, totalSamples - offset);
      const planar = new Float32Array(len * numCh);
      for (let ch = 0; ch < numCh; ch++) {
        planar.set(audioBuffer.getChannelData(ch).subarray(offset, offset + len), ch * len);
      }
      const ad = new AudioData({
        format: 'f32-planar',
        sampleRate: audioBuffer.sampleRate,
        numberOfFrames: len,
        numberOfChannels: numCh,
        timestamp: Math.round((offset * 1_000_000) / audioBuffer.sampleRate),
        data: planar,
      });
      if (audioEncoder.state === 'configured') {
        audioEncoder.encode(ad);
      }
      ad.close();

      audioChunkCounter++;
      if (audioChunkCounter % 24 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    if (!audioEncoderFailed && audioEncoder.state === 'configured') {
      await Promise.race([
        audioEncoder.flush().catch(() => {
          audioEncoderFailed = true;
        }),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    }
    try {
      if (audioEncoder.state !== 'closed') audioEncoder.close();
    } catch {}

    return {
      chunks: encodedAudioChunks,
      valid: !audioEncoderFailed && encodedAudioChunks.length > 0,
    };
  } catch (audioErr) {
    console.warn('Audio encoding skipped, continuing with video track:', audioErr);
    return { chunks: [], valid: false };
  }
}

/**
 * Standalone Raw WebGL2 + `gl.readPixels()` -> Binary `Uint8Array` `VideoFrame` Exporter:
 * 1. Completely isolated from React Three Fiber / Three.js `<Canvas>`.
 * 2. Live 1-frame probes each WebCodecs `VideoEncoder` candidate (H.264 RGBX/I420 -> Software I420 -> WebM VP9/VP8)
 *    before encoding starts so false-positive `isConfigSupported()` configs never throw `Encoding error.`.
 * 3. Renders each frame `frameIdx`, forces synchronous hardware GPU pixel readback via `gl.readPixels()`,
 *    paints a live verification preview via `putImageData`, and constructs `new VideoFrame(buffer, ...)`
 *    directly from raw binary memory.
 * 4. If a hardware encoder fails mid-render, automatically retries with Software I420 / WebM without failing.
 */
export async function renderOfflineVideoGuaranteed({
  fragmentShaderSource,
  audioBuffer,
  width,
  height,
  fps,
  startOffsetSec = 0,
  getUniformsForTime,
  previewCanvasRef,
  onProgress,
  shouldCancelRef,
}: {
  fragmentShaderSource: string;
  audioBuffer: AudioBuffer | null;
  width: number;
  height: number;
  fps: number;
  startOffsetSec?: number;
  getUniformsForTime: (
    t: number,
    dt: number,
    audioBands: PrecomputedAudioFrame
  ) => Record<string, number | boolean | number[]>;
  previewCanvasRef?: HTMLCanvasElement | null;
  onProgress: (percent: number, frame: number, totalFrames: number) => void;
  shouldCancelRef: { current: boolean };
}): Promise<Blob> {
  const reqW = width % 2 === 0 ? width : width - 1;
  const reqH = height % 2 === 0 ? height : height - 1;

  const attemptModes: Array<'default' | 'software-i420' | 'webm-fallback'> = [
    'default',
    'software-i420',
    'webm-fallback',
  ];

  let lastError: Error | null = null;

  for (let attemptIdx = 0; attemptIdx < attemptModes.length; attemptIdx++) {
    if (shouldCancelRef.current) break;

    const attemptMode = attemptModes[attemptIdx];
    const candidate = await negotiateWorkingVideoEncoder({
      requestedWidth: reqW,
      requestedHeight: reqH,
      requestedFps: fps,
      mode: attemptMode,
    });

    if (!candidate) {
      continue;
    }

    const W = candidate.width;
    const H = candidate.height;
    const effectiveFps = candidate.fps;
    const durationSec = audioBuffer ? audioBuffer.duration : 10;
    const totalFrames = Math.max(1, Math.floor(durationSec * effectiveFps));
    const keyframeInterval = Math.max(1, Math.round(effectiveFps));

    // Update store badge with the verified encoder being used
    useStudioStore.getState().setOfflineRenderProgress({
      encoderName: `Standalone WebGL2 + gl.readPixels + ${candidate.label}`,
    });

    // 2. Get or initialize cached standalone WebGL2 context & compiled shader program
    const glCache = getOrInitStandaloneWebGl2(W, H, fragmentShaderSource);
    const { gl, program, quadBuf, posLoc, intUniformNames, uniformLocations } = glCache;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // Bind user textures (TEXTURE0 = u_userTexture, TEXTURE1 = u_userTextureB) & optical feedback (TEXTURE2 = u_prevFrame)
    const storeState = useStudioStore.getState();
    const itemA = storeState.multiImages[storeState.activeImageIndexA] || null;
    const itemB =
      storeState.multiImages.length > 1
        ? storeState.multiImages[storeState.activeImageIndexB % storeState.multiImages.length]
        : null;
    const urlA = itemA ? itemA.url : storeState.userTextureUrl;
    const urlB = itemB ? itemB.url : null;

    const texUserA = await createStandaloneGlTextureFromUrl(gl, 0, urlA);
    const texUserB = await createStandaloneGlTextureFromUrl(gl, 1, urlB);

    const texPrevFrame = gl.createTexture();
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, texPrevFrame);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    const getLoc = (name: string): WebGLUniformLocation | null => {
      if (uniformLocations.has(name)) {
        return uniformLocations.get(name) ?? null;
      }
      const loc = gl.getUniformLocation(program, name);
      uniformLocations.set(name, loc);
      return loc;
    };

    const uUserTexLoc = getLoc('u_userTexture');
    if (uUserTexLoc) gl.uniform1i(uUserTexLoc, 0);
    const uUserTexBLoc = getLoc('u_userTextureB');
    if (uUserTexBLoc) gl.uniform1i(uUserTexBLoc, 1);
    const uPrevFrameLoc = getLoc('u_prevFrame');
    if (uPrevFrameLoc) gl.uniform1i(uPrevFrameLoc, 2);

    // 3. Fault-Tolerant Audio Pre-Encoding matched to container (AAC for MP4, Opus for WebM)
    const { chunks: encodedAudioChunks, valid: hasValidEncodedAudio } =
      await preEncodeAudioForContainer(audioBuffer, candidate.container, shouldCancelRef);

    // Build container-appropriate muxer
    const mp4Muxer =
      candidate.container === 'mp4'
        ? new Muxer({
            target: new ArrayBufferTarget(),
            video: { codec: 'avc', width: W, height: H },
            ...(hasValidEncodedAudio && audioBuffer
              ? {
                  audio: {
                    codec: 'aac',
                    sampleRate: audioBuffer.sampleRate,
                    numberOfChannels: audioBuffer.numberOfChannels,
                  },
                }
              : {}),
            fastStart: 'in-memory',
            firstTimestampBehavior: 'offset',
          })
        : null;

    const webmMuxer =
      candidate.container === 'webm'
        ? new WebmMuxer({
            target: new WebmArrayBufferTarget(),
            video: {
              codec: candidate.muxerVideoCodec,
              width: W,
              height: H,
              frameRate: effectiveFps,
            },
            ...(hasValidEncodedAudio && audioBuffer
              ? {
                  audio: {
                    codec: 'A_OPUS',
                    sampleRate: audioBuffer.sampleRate,
                    numberOfChannels: audioBuffer.numberOfChannels,
                  },
                }
              : {}),
            firstTimestampBehavior: 'offset',
          })
        : null;

    if (hasValidEncodedAudio) {
      for (const item of encodedAudioChunks) {
        try {
          if (mp4Muxer) mp4Muxer.addAudioChunk(item.chunk, item.meta);
          else if (webmMuxer) webmMuxer.addAudioChunk(item.chunk, item.meta);
        } catch {}
      }
    }

    let videoEncoderError: Error | null = null;
    let encodedVideoChunksCount = 0;

    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => {
        encodedVideoChunksCount++;
        try {
          if (mp4Muxer) mp4Muxer.addVideoChunk(chunk, meta);
          else if (webmMuxer) webmMuxer.addVideoChunk(chunk, meta);
        } catch (muxErr) {
          videoEncoderError =
            muxErr instanceof Error ? muxErr : new Error(String(muxErr));
        }
      },
      error: (err) => {
        const isLastAttempt = attemptIdx === attemptModes.length - 1;
        if (isLastAttempt) {
          console.error('VideoEncoder error:', err);
        } else {
          console.warn(
            `VideoEncoder ${candidate.label} encountered error, retrying with safer fallback:`,
            err
          );
        }
        videoEncoderError = err instanceof Error ? err : new Error(String(err));
      },
    });

    try {
      videoEncoder.configure(candidate.config);
    } catch (cfgErr) {
      videoEncoderError = cfgErr instanceof Error ? cfgErr : new Error(String(cfgErr));
    }

    // 4. Pre-allocate raw RGBA readback buffer + optional planar I420 conversion buffer
    const pixelBuffer = new Uint8Array(W * H * 4);
    const i420Buffer =
      candidate.pixelFormat === 'I420' ? new Uint8Array((W * H * 3) >> 1) : null;
    const dt = 1.0 / effectiveFps;
    const pcmData = audioBuffer ? audioBuffer.getChannelData(0) : null;
    const sampleRate = audioBuffer ? audioBuffer.sampleRate : 44100;

    // Setup live verification preview canvas in the modal
    let previewCtx: CanvasRenderingContext2D | null = null;
    const targetPreviewCanvas =
      previewCanvasRef ||
      (typeof document !== 'undefined'
        ? (document.getElementById('offline-export-live-preview-canvas') as HTMLCanvasElement | null)
        : null);
    if (targetPreviewCanvas) {
      targetPreviewCanvas.width = W;
      targetPreviewCanvas.height = H;
      previewCtx = targetPreviewCanvas.getContext('2d');
    }

    // 5. Deterministic Frame-by-Frame Loop
    const safeStartOffset = Math.max(0, Number.isFinite(startOffsetSec) ? startOffsetSec : 0);
    for (let frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
      if (shouldCancelRef.current || videoEncoderError || videoEncoder.state !== 'configured') {
        break;
      }

      const localClipTime = frameIdx * dt;
      const songTimeSec = safeStartOffset + localClipTime;

      // Extract Just-In-Time (JIT) audio bands from the sliced section PCM samples at localClipTime
      const audioBands = extractJitAudioBandsAtTime(
        pcmData,
        sampleRate,
        localClipTime,
        dt,
        frameIdx,
        {
          reactivityGain: storeState.reactivityGain,
          peakExponent: storeState.peakExponent,
          bounceIntensity: storeState.bounceIntensity,
          spikeSensitivity: storeState.spikeSensitivity,
          estimatedBpm: transientState.estimatedBpm || 124,
          cameraSpeed: storeState.cameraSpeed,
        }
      );

      // Offset dynamicTime and cumulative registers by safeStartOffset so section renders match exact song position
      const sectionAudioBands: PrecomputedAudioFrame = {
        ...audioBands,
        timeSec: songTimeSec,
        dynamicTime: audioBands.dynamicTime + safeStartOffset * 1.15,
        bassCumulative: audioBands.bassCumulative + safeStartOffset * 1.45,
        midCumulative: audioBands.midCumulative + safeStartOffset * 0.92,
      };

      // Get all uniform values for exact song timestamp songTimeSec
      const uniformsMap = getUniformsForTime(songTimeSec, dt, sectionAudioBands);

      gl.viewport(0, 0, W, H);
      gl.useProgram(program);

      // Explicitly bind resolution & time
      const uResLoc = getLoc('u_resolution');
      if (uResLoc) gl.uniform2f(uResLoc, W, H);
      const uTimeLoc = getLoc('u_time');
      if (uTimeLoc) gl.uniform1f(uTimeLoc, sectionAudioBands.dynamicTime);

      // Bind all other uniforms directly on the raw WebGL2 context using cached uniform locations
      for (const [uName, uVal] of Object.entries(uniformsMap)) {
        const loc = getLoc(uName);
        if (!loc) continue;
        if (typeof uVal === 'number') {
          if (intUniformNames.has(uName)) {
            gl.uniform1i(loc, Math.round(uVal));
          } else {
            gl.uniform1f(loc, uVal);
          }
        } else if (typeof uVal === 'boolean') {
          gl.uniform1i(loc, uVal ? 1 : 0);
        } else if (Array.isArray(uVal)) {
          if (uVal.length === 2) gl.uniform2f(loc, uVal[0], uVal[1]);
          else if (uVal.length === 3) gl.uniform3f(loc, uVal[0], uVal[1], uVal[2]);
          else if (uVal.length === 4) gl.uniform4f(loc, uVal[0], uVal[1], uVal[2], uVal[3]);
        }
      }

      // Draw the frame
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // CRITICAL FIX: gl.readPixels() forces the GPU to finish the frame and copy exact RGBA bytes!
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuffer);

      // Copy current frame RGBA bytes into u_prevFrame texture (TEXTURE2) for optical feedback modes
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, texPrevFrame);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixelBuffer);

      // Construct VideoFrame directly from raw binary memory (RGBX / I420 / RGBA) bypassing canvas caching!
      const timestampUs = Math.round((frameIdx * 1_000_000) / effectiveFps);
      const durationUs = Math.round(1_000_000 / effectiveFps);

      const framePayload =
        candidate.pixelFormat === 'I420' && i420Buffer
          ? rgbaToI420(pixelBuffer, W, H, i420Buffer)
          : pixelBuffer;

      let videoFrame: VideoFrame | null = null;
      try {
        videoFrame = new VideoFrame(framePayload, {
          format: candidate.pixelFormat,
          codedWidth: W,
          codedHeight: H,
          timestamp: timestampUs,
          duration: durationUs,
        });
        if (videoEncoder.state === 'configured' && !videoEncoderError) {
          videoEncoder.encode(videoFrame, { keyFrame: frameIdx % keyframeInterval === 0 });
        }
      } catch (encErr) {
        videoEncoderError = encErr instanceof Error ? encErr : new Error(String(encErr));
      } finally {
        try {
          if (videoFrame) videoFrame.close();
        } catch {}
      }

      if (videoEncoderError) break;

      // Update live preview canvas in modal every 3 frames so user visually sees the animation moving!
      if ((frameIdx === 0 || frameIdx % 3 === 0) && !useStudioStore.getState().isPreviewHidden) {
        if ((!previewCtx || !previewCtx.canvas.isConnected) && typeof document !== 'undefined') {
          const liveEl = document.getElementById(
            'offline-export-live-preview-canvas'
          ) as HTMLCanvasElement | null;
          if (liveEl) {
            liveEl.width = W;
            liveEl.height = H;
            previewCtx = liveEl.getContext('2d');
          }
        }
        if (previewCtx) {
          const imgData = new ImageData(new Uint8ClampedArray(pixelBuffer.buffer), W, H);
          previewCtx.putImageData(imgData, 0, 0);
        }
      }

      // Tight backpressure throttle (<= 2 queued frames) prevents Android MediaCodec slot exhaustion
      let waitTicks = 0;
      while (
        !videoEncoderError &&
        videoEncoder.state === 'configured' &&
        videoEncoder.encodeQueueSize >= 2 &&
        waitTicks < 150
      ) {
        await new Promise((r) => setTimeout(r, 8));
        waitTicks++;
      }

      // Update progress UI & yield to main thread every frame so browser UI & encoder callbacks never starve
      if (frameIdx === 0 || frameIdx % 2 === 0 || frameIdx === totalFrames - 1) {
        onProgress(Math.round(((frameIdx + 1) / totalFrames) * 100), frameIdx + 1, totalFrames);
      }
      await new Promise((r) => setTimeout(r, 2));
    }

    // Flush & finalize if no error occurred
    if (!videoEncoderError && !shouldCancelRef.current && videoEncoder.state === 'configured') {
      await Promise.race([
        videoEncoder.flush().catch((flushErr) => {
          videoEncoderError =
            flushErr instanceof Error ? flushErr : new Error(String(flushErr));
        }),
        new Promise((r) => setTimeout(r, 6000)),
      ]);
    }

    try {
      if (videoEncoder.state !== 'closed') videoEncoder.close();
    } catch {}

    // Clean up per-run textures while keeping the compiled shader program & WebGL2 context cached
    if (texUserA) gl.deleteTexture(texUserA);
    if (texUserB) gl.deleteTexture(texUserB);
    if (texPrevFrame) gl.deleteTexture(texPrevFrame);

    if (shouldCancelRef.current) {
      return new Blob([], { type: candidate.container === 'webm' ? 'video/webm' : 'video/mp4' });
    }

    if (!videoEncoderError && encodedVideoChunksCount > 0) {
      if (mp4Muxer) {
        mp4Muxer.finalize();
        const { buffer } = mp4Muxer.target as ArrayBufferTarget;
        return new Blob([buffer], { type: 'video/mp4' });
      }
      if (webmMuxer) {
        webmMuxer.finalize();
        const { buffer } = webmMuxer.target as WebmArrayBufferTarget;
        return new Blob([buffer], { type: 'video/webm' });
      }
    }

    lastError =
      videoEncoderError ||
      new Error(`VideoEncoder (${candidate.label}) produced 0 encoded video chunks`);
  }

  throw (
    lastError ||
    new Error('No supported VideoEncoder (H.264 / VP9 / VP8) config succeeded on this browser')
  );
}

export async function runDeterministicOfflineVideoExport(): Promise<{
  ok: boolean;
  message: string;
}> {
  const state = useStudioStore.getState();
  offlineRenderCancelled = false;
  offlineCancelRef.current = false;
  audioEngine.pause();

  const rawDims = getExportResolutionDimensions(state.aspectRatio, state.exportResolutionPreset);
  const width = rawDims.width - (rawDims.width % 2);
  const height = rawDims.height - (rawDims.height % 2);
  const exportFps = state.exportFps || 60;
  const resolvedSegment = resolveCurrentStoreSegment();
  const startOffsetSec = resolvedSegment.startSec;
  const durationSec = resolvedSegment.durationSec;
  const totalFrames = Math.max(1, Math.floor(durationSec * exportFps));

  if (resolvedSegment.sectionName) {
    useStudioStore.setState({ activeSectionName: resolvedSegment.sectionName });
  }

  state.setLastExport(null, null);
  state.setRecordingState(true, 0, 'video/mp4');
  useStudioStore.setState({
    activeBackbufferWidth: width,
    activeBackbufferHeight: height,
  });
  state.setOfflineRenderProgress({
    active: true,
    phase: 'analyzing-audio',
    currentFrame: 0,
    totalFrames,
    percent: 1,
    etaSeconds: Math.ceil(totalFrames / 30),
    fpsSpeed: 0,
    statusLabel: `Slicing "${resolvedSegment.label}" (${formatTimestamp(startOffsetSec)} → ${formatTimestamp(resolvedSegment.endSec)}) at ${width}×${height}...`,
    encoderName: 'Standalone WebGL2 + gl.readPixels + WebCodecs H.264',
  });

  // Yield 50ms so React renders the full-screen modal & pauses the live preview loop before heavy WebGL work
  await new Promise((r) => setTimeout(r, 50));

  try {
    const audioBuffer = await audioEngine.getOrSynthesizeOfflineWebAudioBuffer(
      durationSec,
      startOffsetSec
    );
    const lockedModeForExport = state.autoChoreographyEnabled ? null : state.fractalMode;
    const fragmentShaderSource = buildStandaloneWebGl2FragmentShader(
      state.gpuHeavyMode,
      lockedModeForExport
    );
    const startTimeMs = performance.now();
    let lastBarSwitchIndex = -1;

    const getUniformsForTime = (
      t: number,
      _dt: number,
      audioBands: PrecomputedAudioFrame
    ): Record<string, number | boolean | number[]> => {
      const s = useStudioStore.getState();
      const totalDur = Math.max(1, s.trackDuration || durationSec || 180);

      // Sync Auto-Switch Choreography if enabled
      if (s.autoChoreographyEnabled) {
        if (s.autoSwitchTriggerMode === 'every-n-bars') {
          const bpm = Math.max(70, Math.min(190, transientState.estimatedBpm || 124));
          const barDurationSec = (60 / bpm) * (s.autoSwitchBars || 8);
          const barIndex = Math.floor(t / Math.max(2, barDurationSec));
          if (barIndex !== lastBarSwitchIndex) {
            lastBarSwitchIndex = barIndex;
            const allowed: number[] = [];
            for (let idx = 0; idx < FRACTAL_MODE_INFO.length; idx++) {
              if (s.autoSwitchEnabledModes[idx]) allowed.push(idx);
            }
            if (allowed.length > 0) {
              const nextMode = allowed[barIndex % allowed.length] as FractalMode;
              if (nextMode !== s.fractalMode) {
                s.setFractalMode(nextMode);
              }
            }
          }
        } else {
          const activeChoreo = s.choreographies[s.activeChoreographyIndex];
          if (activeChoreo && activeChoreo.timelineKeyframes.length > 0) {
            const progress = (t % totalDur) / totalDur;
            const activeKf = getActiveChoreographyKeyframe(
              activeChoreo.timelineKeyframes,
              progress
            );
            if (activeKf && activeKf.section !== s.activeSectionName) {
              useStudioStore.setState({
                activeSectionName: activeKf.section,
                cameraSpeed: activeKf.speedMultiplier,
                bloomIntensity: activeKf.bloomIntensity,
                bulbPower: activeKf.bulbPower,
                kleinianScale: activeKf.kleinianScale,
                foldLimit: activeKf.foldLimit,
                chaosMode: activeKf.chaosMode,
              });
            }
          }
        }
      }

      const current = useStudioStore.getState();
      const itemA = current.multiImages[current.activeImageIndexA] || null;
      const itemB =
        current.multiImages.length > 1
          ? current.multiImages[current.activeImageIndexB % current.multiImages.length]
          : null;
      const hasTexture = Boolean(itemA?.url || current.userTextureUrl);

      let computedMorphT = current.imageMorphPhase;
      if (current.imageTransitionTrigger === 'smooth-time') {
        computedMorphT = 0.5 + 0.5 * Math.sin(audioBands.dynamicTime * 0.45);
      } else if (current.imageTransitionTrigger === 'bass-drops') {
        computedMorphT = Math.min(
          1.0,
          (audioBands.bassCumulative * 0.25 + audioBands.kickTransient * 0.35) % 1.0
        );
      } else if (current.imageTransitionTrigger === 'every-n-bars') {
        computedMorphT = audioBands.bpmPhase;
      }

      const textureMappingModeInt =
        current.textureMappingMode === 'orbit-trap'
          ? 0
          : current.textureMappingMode === 'triplanar'
            ? 1
            : current.textureMappingMode === 'both'
              ? 2
              : current.textureMappingMode === 'zeno-droste'
                ? 4
                : 3;

      const imageBlendMethodInt =
        current.imageBlendMethod === 'crystal-shatter'
          ? 1
          : current.imageBlendMethod === 'droste-nest'
            ? 2
            : current.imageBlendMethod === 'kaleido-trap'
              ? 3
              : 0;

      return {
        u_time: audioBands.dynamicTime,
        u_fractalMode: current.fractalMode,
        u_prevFractalMode: current.fractalMode,
        u_morph: 1.0,
        u_maxSteps: current.gpuHeavyMode ? 112 : 84,
        u_iterationDetail: current.iterationDetail,
        u_exportTurbo: false,
        u_gpuHeavyMode: current.gpuHeavyMode,

        u_polychoraType: current.polychoraType,
        u_zenoSpeed: current.zenoReverseDirection ? -current.zenoSpeed : current.zenoSpeed,
        u_halvingRate: current.zenoHalvingRate,
        u_escherTwist: current.zenoEscherTwist,
        u_arrowParadoxMix: current.zenoArrowParadoxMix,
        u_sliceHz: current.zenoSliceHz,
        u_rot4dXW: current.rot4dXW,
        u_rot4dYW: current.rot4dYW,
        u_rot4dZW: current.rot4dZW,
        u_wCameraDist: current.wCameraDist,
        u_worldBiome: current.worldBiomeMode === 'auto' ? -1.0 : current.worldBiomeMorph,
        u_transcendence: current.transcendence,
        u_collageJoinMode: current.collageJoinMode,
        u_cloudDensity: current.cloudDensity,
        u_creatureSpeed: current.creatureSpeed,
        u_cameraShake: current.cameraShakeIntensity,
        u_feedbackTrail: current.feedbackTrailLength,
        u_emblemSize: current.emblemSize,
        u_spectrumBars: current.spectrumBarCount,

        u_subBass: audioBands.bands.subBass,
        u_bass: audioBands.bands.bass,
        u_lowMid: audioBands.bands.lowMid,
        u_mid: audioBands.bands.mid,
        u_upperMid: audioBands.bands.upperMid,
        u_presence: audioBands.bands.presence,
        u_brilliance: audioBands.bands.brilliance,
        u_bassCumulative: audioBands.bassCumulative,
        u_midCumulative: audioBands.midCumulative,
        u_juiceBounce: audioBands.juiceBounce,
        u_audioIntensity: audioBands.audioIntensity,
        u_fractalSpike: audioBands.fractalSpike,
        u_kickTransient: audioBands.kickTransient,
        u_snareTransient: audioBands.snareTransient,
        u_hiHatSparkle: audioBands.hiHatSparkle,
        u_bpmPhase: audioBands.bpmPhase,
        u_mirrorPhase: audioBands.mirrorPhase,
        u_pitchHue: audioBands.pitchHue,
        u_beatShockwave: current.beatShockwaveEnabled,

        u_speed: current.cameraSpeed * transientState.cameraZoomSpeed,
        u_scale: current.tunnelScale,
        u_tunnelCurvature: current.tunnelCurvature,
        u_cameraFov: current.cameraFov,
        u_bulbPower: current.bulbPower,
        u_kleinianScale: current.kleinianScale,
        u_foldLimit: current.foldLimit,
        u_chaosMode: current.chaosMode,

        u_palA: [...current.palette.a],
        u_palB: [...current.palette.b],
        u_palC: [...current.palette.c],
        u_palD: [...current.palette.d],

        u_cameraOrbit: [
          transientState.cameraOrbitX + transientState.gyroTiltX * 0.6,
          transientState.cameraOrbitY + transientState.gyroTiltY * 0.6,
        ],
        u_cameraRoll: transientState.cameraRollZ,
        u_cameraLateral: [transientState.cameraLateralX, transientState.cameraLateralY],
        u_cameraZoom: transientState.cameraZoomSpeed,
        u_xyPad1: [transientState.xyPad1[0], transientState.xyPad1[1]],
        u_xyPad2: [transientState.xyPad2[0], transientState.xyPad2[1]],

        u_clarity: current.clarity,
        u_kaleidoSlices: current.kaleidoSlices,
        u_mirrorX: current.mirrorX,
        u_mirrorY: current.mirrorY,
        u_fbmWarp: current.fbmWarpStrength,
        u_metaBrightness: current.metaBrightness,
        u_metaContrast: current.metaContrast,
        u_metaGamma: current.metaGamma,
        u_metaSaturation: current.metaSaturation,
        u_metaHueSpeed: current.metaHueSpeed,
        u_colorInvert: current.colorInvert,

        u_hasTexture: hasTexture,
        u_textureMappingMode: textureMappingModeInt,
        u_textureMix: current.textureMix,
        u_textureAspect: itemA ? itemA.aspect : current.userTextureAspect,
        u_textureAspectB: itemB ? itemB.aspect : 1.0,
        u_textureScale: current.textureScale,
        u_trapScale: current.trapScale,
        u_imageSpinSpeed: current.imageSpinSpeed,
        u_imageBeatPulse: current.imageBeatPulse,
        u_imageMorphT: computedMorphT,
        u_imageDepth3D: current.imageDepth3D,
        u_imgFractalIter: current.imageFractalizeIterations,
        u_morphTurbulence: current.imageMorphTurbulence,
        u_imageBlendMethod: imageBlendMethodInt,
        u_img3DStyle: current.img3DStyle,
        u_kifsFoldAngle: current.kifsFoldAngle,
        u_zoomDirection: computeZoomDirectionMultiplier(
          current.zoomDirectionMode,
          audioBands.bpmPhase
        ),

        u_bloomIntensity: current.bloomIntensity,
        u_chromaticAberration: current.chromaticAberration,
        u_vignetteDarkness: current.vignetteDarkness,
        u_filmGrain: current.filmGrain,
        u_glitchActive: current.glitchActive,

        u_divineStage: current.divineCreationStage,
        u_divineGodRays: current.divineGodRaysEnabled,
        u_godRayIntensity: current.divineGodRayIntensity,
        u_godRayDensity: current.godRayDensity,
        u_godRayWeight: current.godRayWeight,
        u_godRayDecay: current.godRayDecay,
        u_godRayExposure: current.godRayExposure,
        u_sacredHaloEnabled: current.sacredHaloEnabled,
        u_sacredFiligreeMix: current.sacredFiligreeMix,
      };
    };

    const previewCanvasEl =
      typeof document !== 'undefined'
        ? (document.getElementById('offline-export-live-preview-canvas') as HTMLCanvasElement | null)
        : null;

    const finalBlob = await renderOfflineVideoGuaranteed({
      fragmentShaderSource,
      audioBuffer,
      width,
      height,
      fps: exportFps,
      startOffsetSec,
      getUniformsForTime,
      previewCanvasRef: previewCanvasEl,
      shouldCancelRef: offlineCancelRef,
      onProgress: (percent, frame, total) => {
        const elapsedSec = Math.max(0.05, (performance.now() - startTimeMs) / 1000);
        const fpsSpeed = Math.round((frame / elapsedSec) * 10) / 10;
        const remainingFrames = total - frame;
        const etaSeconds = Math.max(0, Math.ceil(remainingFrames / Math.max(1, fpsSpeed)));

        useStudioStore.setState({
          recordingSeconds: Math.round(frame / exportFps),
          exportedFrameCount: frame,
        });
        useStudioStore.getState().setOfflineRenderProgress({
          active: true,
          phase: 'rendering-frames',
          currentFrame: frame,
          totalFrames: total,
          percent: Math.min(99, Math.max(1, percent)),
          etaSeconds,
          fpsSpeed,
          statusLabel: `Rendering ${resolvedSegment.shortTag} · Frame ${frame} / ${total} (${width}×${height})`,
          encoderName: 'Standalone WebGL2 + gl.readPixels + WebCodecs H.264',
        });
      },
    });

    if (offlineRenderCancelled || offlineCancelRef.current) {
      state.setRecordingState(false, 0);
      state.setOfflineRenderProgress({ active: false, phase: 'cancelled' });
      return { ok: false, message: 'Offline render cancelled by user.' };
    }

    lastExportedBlob = finalBlob;
    const url = URL.createObjectURL(finalBlob);
    const currentState = useStudioStore.getState();
    const ratioTag =
      currentState.aspectRatio === '9:16'
        ? 'Shorts-9x16'
        : currentState.aspectRatio === '1:1'
          ? 'Square-1x1'
          : 'YouTube-16x9';
    const cleanTrack = currentState.audioTrackName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .slice(0, 24);
    const isWebmOutput = finalBlob.type.includes('webm');
    const finalExt = isWebmOutput
      ? 'webm'
      : currentState.exportVideoFormat === 'mov-h264'
        ? 'mov'
        : 'mp4';
    const filename = `${cleanTrack || 'ChromaFract'}-${resolvedSegment.shortTag}-${currentState.exportResolutionPreset.toUpperCase()}-${width}x${height}-${exportFps}FPS-${ratioTag}.${finalExt}`;

    currentState.setLastExport(url, filename, finalBlob.size);
    currentState.recordRenderedSectionOutput({
      modeId: resolvedSegment.mode,
      label: resolvedSegment.label,
      url,
      filename,
      blobSize: finalBlob.size,
      startSec: resolvedSegment.startSec,
      endSec: resolvedSegment.endSec,
      durationSec: resolvedSegment.durationSec,
      completedAt: Date.now(),
    });
    currentState.setRecordingState(false, 0, isWebmOutput ? 'video/webm' : 'video/mp4');
    currentState.setOfflineRenderProgress({
      active: false,
      phase: 'complete',
      currentFrame: totalFrames,
      totalFrames,
      percent: 100,
      etaSeconds: 0,
      statusLabel: `Completed ${resolvedSegment.label} (${totalFrames} frames · ${formatFileSize(finalBlob.size)})! Tap below to save to your phone.`,
    });

    triggerDirectVideoDownload();

    return {
      ok: true,
      message: `Render complete: ${filename} (${formatFileSize(finalBlob.size)} · ${totalFrames} frames). Tap Save/Download to save to your phone!`,
    };
  } catch (err) {
    useStudioStore.getState().setRecordingState(false, 0);
    useStudioStore.getState().setOfflineRenderProgress({
      active: false,
      phase: 'error',
      statusLabel: err instanceof Error ? err.message : 'Offline render error',
    });
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Offline render failed.',
    };
  }
}

export function startSynchronizedMusicVideoExport(
  overridePreset?: ExportResolutionPreset,
  overrideDurationMode?: ExportDurationMode,
  overrideFormat?: ExportVideoFormat
): { ok: boolean; message: string } {
  const state = useStudioStore.getState();
  if (overridePreset) {
    state.setShaderParam('exportResolutionPreset', overridePreset);
    if (
      overridePreset === '720p' ||
      overridePreset === '1080p' ||
      overridePreset === '1440p' ||
      overridePreset === '4k'
    ) {
      state.setVideoQuality(overridePreset);
    }
  }
  if (overrideDurationMode) state.setShaderParam('exportDurationMode', overrideDurationMode);
  if (overrideFormat) state.setExportVideoFormat(overrideFormat);

  const updatedState = useStudioStore.getState();
  if (updatedState.exportRenderBackend === 'offline-deterministic') {
    runDeterministicOfflineVideoExport();
    return {
      ok: true,
      message: 'Started Zero-Lag Deterministic Offline Frame-by-Frame Renderer...',
    };
  }

  const displayCanvas = getActiveVisualizerCanvas();
  if (!displayCanvas) {
    return { ok: false, message: 'WebGL canvas is not ready for capture.' };
  }

  const preset = updatedState.exportResolutionPreset;
  const durationMode = updatedState.exportDurationMode;
  const videoFormat = updatedState.exportVideoFormat;

  const { width, height, recommendedRaymarchScale, label } =
    getExportResolutionDimensions(updatedState.aspectRatio, preset);

  if (activeDecoupledSession) {
    activeDecoupledSession.stopSession();
    activeDecoupledSession = null;
  }

  const decoupledSession = createDecoupledExportSession(
    width,
    height,
    recommendedRaymarchScale
  );
  activeDecoupledSession = decoupledSession;
  liveCapturedFrameCount = 0;
  liveDroppedFrameCount = 0;

  const targetCaptureCanvas = decoupledSession ? decoupledSession.exportCanvas : displayCanvas;

  const resolvedSegment = resolveCurrentStoreSegment();
  let targetSec = resolvedSegment.durationSec;
  if (durationMode === 'full-song') {
    targetSec = audioEngine.startFullSongExportPlayback(() => {
      stopSynchronizedMusicVideoExport();
    });
  } else {
    audioEngine.seekToTime(resolvedSegment.startSec);
    targetSec = resolvedSegment.durationSec;
    if (!useStudioStore.getState().isPlaying) {
      audioEngine.togglePlayPause();
    }
  }
  activeTargetDurationSec = Math.max(1, targetSec);

  try {
    const videoStream = decoupledSession
      ? decoupledSession.exportStream
      : targetCaptureCanvas.captureStream(updatedState.exportFps || 60);
    const audioStream = audioEngine.getAudioStream();
    const tracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];
    if (audioStream) {
      tracks.push(...audioStream.getAudioTracks());
    }
    const combinedStream = new MediaStream(tracks);

    const { recorderMimeType, blobType, ext, formatLabel } = detectSupportedMimeType(
      videoFormat,
      preset
    );
    const options: MediaRecorderOptions = {
      videoBitsPerSecond: (updatedState.exportBitrateMbps || 25) * 1_000_000,
      audioBitsPerSecond: 192_000,
    };
    if (recorderMimeType) options.mimeType = recorderMimeType;

    const recorder = new MediaRecorder(combinedStream, options);
    recordedChunks = [];

    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        recordedChunks.push(ev.data);
      }
    };

    recorder.onstop = () => {
      if (activeDecoupledSession) {
        activeDecoupledSession.stopSession();
        activeDecoupledSession = null;
      }
      audioEngine.restoreLoopingAfterExport();

      const finalMime = blobType || recorderMimeType || 'video/mp4';
      const blob = new Blob(recordedChunks, { type: finalMime });
      lastExportedBlob = blob;
      const url = URL.createObjectURL(blob);
      const currentState = useStudioStore.getState();
      const activeFormatSpec = getVideoFormatSpecification(currentState.exportVideoFormat);
      const finalExt = activeFormatSpec.ext || ext;
      const resTag = `${currentState.exportResolutionPreset.toUpperCase()}-${width}x${height}-${currentState.exportFps}FPS`;
      const ratioTag =
        currentState.aspectRatio === '9:16'
          ? 'Shorts-9x16'
          : currentState.aspectRatio === '1:1'
            ? 'Square-1x1'
            : 'YouTube-16x9';
      const cleanTrack = currentState.audioTrackName
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .slice(0, 24);
      const seg = resolveCurrentStoreSegment();
      const filename = `${cleanTrack || 'ChromaFract'}-${seg.shortTag}-${resTag}-${ratioTag}.${finalExt}`;

      currentState.setLastExport(url, filename, blob.size);
      currentState.recordRenderedSectionOutput({
        modeId: seg.mode,
        label: seg.label,
        url,
        filename,
        blobSize: blob.size,
        startSec: seg.startSec,
        endSec: seg.endSec,
        durationSec: seg.durationSec,
        completedAt: Date.now(),
      });
      currentState.setRecordingState(false, 0, finalMime);

      triggerDirectVideoDownload();
    };

    recorder.start(1000);
    activeRecorder = recorder;
    updatedState.setLastExport(null, null);
    updatedState.setRecordingState(true, 0, blobType || recorderMimeType || 'video/mp4');

    let elapsed = 0;
    if (progressTimer !== null) window.clearInterval(progressTimer);
    progressTimer = window.setInterval(() => {
      elapsed += 1;
      if (activeDecoupledSession) {
        liveCapturedFrameCount = activeDecoupledSession.getCapturedFrames();
        liveDroppedFrameCount = activeDecoupledSession.getDroppedFrames();
      }
      useStudioStore.setState({
        recordingSeconds: elapsed,
        exportedFrameCount: liveCapturedFrameCount,
      });
      if (elapsed >= activeTargetDurationSec) {
        stopSynchronizedMusicVideoExport();
      }
    }, 1000);

    return {
      ok: true,
      message: `Live Clip Capture active (${label} · ${formatLabel})...`,
    };
  } catch (err) {
    if (activeDecoupledSession) {
      activeDecoupledSession.stopSession();
      activeDecoupledSession = null;
    }
    audioEngine.restoreLoopingAfterExport();
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'MediaRecorder initialization failed.',
    };
  }
}

export default function VideoExportDrawer() {
  const activeInspectorTab = useStudioStore((s) => s.activeInspectorTab);
  const aspectRatio = useStudioStore((s) => s.aspectRatio);
  const setAspectRatio = useStudioStore((s) => s.setAspectRatio);
  const exportRenderBackend = useStudioStore((s) => s.exportRenderBackend);
  const setExportRenderBackend = useStudioStore((s) => s.setExportRenderBackend);
  const exportVideoFormat = useStudioStore((s) => s.exportVideoFormat);
  const setExportVideoFormat = useStudioStore((s) => s.setExportVideoFormat);
  const videoQuality = useStudioStore((s) => s.videoQuality);
  const exportResolutionPreset = useStudioStore((s) => s.exportResolutionPreset);
  const exportFps = useStudioStore((s) => s.exportFps);
  const exportBitrateMbps = useStudioStore((s) => s.exportBitrateMbps);
  const subFrameMotionBlur = useStudioStore((s) => s.subFrameMotionBlur);
  const previewResolutionCap = useStudioStore((s) => s.previewResolutionCap);
  const renderScaleMode = useStudioStore((s) => s.renderScaleMode);
  const activeRenderScale = useStudioStore((s) => s.activeRenderScale);
  const activeBackbufferWidth = useStudioStore((s) => s.activeBackbufferWidth);
  const activeBackbufferHeight = useStudioStore((s) => s.activeBackbufferHeight);
  const liveFps = useStudioStore((s) => s.liveFps);
  const gpuRendererName = useStudioStore((s) => s.gpuRendererName);
  const gpuHeavyMode = useStudioStore((s) => s.gpuHeavyMode);
  const setGpuHeavyMode = useStudioStore((s) => s.setGpuHeavyMode);
  const shaderCompileStatus = useStudioStore((s) => s.shaderCompileStatus);
  const exportDurationMode = useStudioStore((s) => s.exportDurationMode);
  const customExportStartSec = useStudioStore((s) => s.customExportStartSec);
  const customExportEndSec = useStudioStore((s) => s.customExportEndSec);
  const renderedSectionsHistory = useStudioStore((s) => s.renderedSectionsHistory);
  const selectSongSectionForExport = useStudioStore((s) => s.selectSongSectionForExport);
  const loopA = useStudioStore((s) => s.loopA);
  const loopB = useStudioStore((s) => s.loopB);
  const trackDuration = useStudioStore((s) => s.trackDuration);
  const audioTrackName = useStudioStore((s) => s.audioTrackName);
  const activeSectionName = useStudioStore((s) => s.activeSectionName);
  const choreographies = useStudioStore((s) => s.choreographies);
  const activeChoreographyIndex = useStudioStore((s) => s.activeChoreographyIndex);
  const isRecording = useStudioStore((s) => s.isRecording);
  const recordingSeconds = useStudioStore((s) => s.recordingSeconds);
  const offlineRenderProgress = useStudioStore((s) => s.offlineRenderProgress);
  const lastExportUrl = useStudioStore((s) => s.lastExportUrl);
  const lastExportFilename = useStudioStore((s) => s.lastExportFilename);
  const lastExportBlobSize = useStudioStore((s) => s.lastExportBlobSize);
  const setExportCompleteModalOpen = useStudioStore((s) => s.setExportCompleteModalOpen);
  const isPreviewHidden = useStudioStore((s) => s.isPreviewHidden);
  const togglePreviewHidden = useStudioStore((s) => s.togglePreviewHidden);
  const aiPromptInput = useStudioStore((s) => s.aiPromptInput);
  const isGeneratingAi = useStudioStore((s) => s.isGeneratingAi);
  const acousticSummary = useStudioStore((s) => s.acousticSummary);
  const applyChoreography = useStudioStore((s) => s.applyChoreography);
  const aiPsychedelicMutate = useStudioStore((s) => s.aiPsychedelicMutate);
  const randomizeDna = useStudioStore((s) => s.randomizeDna);
  const setShaderParam = useStudioStore((s) => s.setShaderParam);
  const fractalMode = useStudioStore((s) => s.fractalMode);
  const autoChoreographyEnabled = useStudioStore((s) => s.autoChoreographyEnabled);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    registerExternalStopExportHook(stopSynchronizedMusicVideoExport);
  }, []);

  if (activeInspectorTab !== 'export') return null;

  const activeChoreo = choreographies[activeChoreographyIndex] ?? choreographies[0];
  const songSections = getSongSectionsWithTimeRanges(
    activeChoreo?.timelineKeyframes,
    trackDuration
  );
  const activeSegment = resolveExportSegmentRange({
    mode: exportDurationMode,
    trackDuration,
    keyframes: activeChoreo?.timelineKeyframes,
    customStartSec: customExportStartSec,
    customEndSec: customExportEndSec,
    loopA,
    loopB,
  });

  const resSpec = getExportResolutionDimensions(aspectRatio, exportResolutionPreset);
  const formatSpec = getVideoFormatSpecification(exportVideoFormat);
  const targetDurationSec = activeSegment.durationSec;
  const targetFrameCount = Math.max(1, Math.floor(targetDurationSec * (exportFps || 60)));

  const progressPct = offlineRenderProgress.active
    ? offlineRenderProgress.percent
    : Math.min(100, Math.round((recordingSeconds / Math.max(1, targetDurationSec)) * 100));

  const isOfflineMode = exportRenderBackend === 'offline-deterministic';

  const handleSelectVideoQuality = (quality: VideoQualityPreset) => {
    const applied = applyVideoQualityRenderSize(quality);
    if (applied) {
      setStatusMessage(
        `Video Quality set to ${quality.toUpperCase()} (${applied.width}×${applied.height})`
      );
    }
  };

  const handleSelectVideoFormat = (format: ExportVideoFormat) => {
    setExportVideoFormat(format);
    const spec = getVideoFormatSpecification(format);
    setStatusMessage(`Export Format set to ${spec.label} (${spec.badge})`);
  };

  const handleStartExport = () => {
    const res = startSynchronizedMusicVideoExport();
    setStatusMessage(res.message);
  };

  const handleStartQuickLiveRecord = () => {
    setExportRenderBackend('offloaded-rVFC');
    setTimeout(() => {
      const res = startSynchronizedMusicVideoExport();
      setStatusMessage(res.message);
    }, 10);
  };

  const handleStopExport = () => {
    stopSynchronizedMusicVideoExport();
    setStatusMessage(`Export stopped.`);
  };

  const handleUploadMusic = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setStatusMessage(`Loading track "${file.name}"...`);
    await audioEngine.loadAudioFile(file);
    setStatusMessage(`Loaded track: ${file.name}`);
  };

  const handleGenerateAiChoreography = async (lockSingleMode = false) => {
    if (!aiPromptInput.trim() || isGeneratingAi) return;
    setShaderParam('isGeneratingAi', true);
    setShaderParam('aiError', null);
    try {
      const currentMode = useStudioStore.getState().fractalMode;
      const res = await fetch('/api/ai-choreograph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPromptInput,
          acousticSummary,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate AI choreography');
      const choreo = data.choreography as VisualChoreography;
      if (lockSingleMode) {
        applyChoreography({ ...choreo, fractalMode: currentMode }, true);
        setShaderParam('autoChoreographyEnabled', false);
        setStatusMessage(`AI Tuned Single Mode (#${currentMode + 1}) with "${choreo.name}"`);
      } else {
        applyChoreography(choreo, true);
        setShaderParam('autoChoreographyEnabled', true);
        setStatusMessage(`AI Choreographed Full Song Storyboard: "${choreo.name}"`);
      }
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'AI Choreography error');
    } finally {
      setShaderParam('isGeneratingAi', false);
    }
  };

  const videoFormatOptions: {
    id: ExportVideoFormat;
    title: string;
    badge: string;
    subtitle: string;
  }[] = [
    {
      id: 'mp4-h264',
      title: 'MP4 (H.264 / AAC)',
      badge: '.MP4',
      subtitle: 'Hardware WebCodecs + mp4-muxer',
    },
    {
      id: 'webm-vp9',
      title: 'WebM (VP9 / Opus)',
      badge: '.WEBM',
      subtitle: '4K60 Open Mastering',
    },
    {
      id: 'webm-vp8',
      title: 'WebM (VP8)',
      badge: '.WEBM',
      subtitle: 'Fast Real-Time Capture',
    },
    {
      id: 'mov-h264',
      title: 'MOV (QuickTime)',
      badge: '.MOV',
      subtitle: 'Apple / Final Cut Pro',
    },
  ];

  const videoQualityOptions: {
    id: VideoQualityPreset;
    title: string;
  }[] = [
    { id: '720p', title: '720p HD' },
    { id: '1080p', title: '1080p FHD' },
    { id: '1440p', title: '1440p QHD' },
    { id: '4k', title: '4K UHD' },
  ];

  return (
    <div
      data-hud-interactive="true"
      aria-label="Zero-Lag Offline Video Render and Export Studio"
      className="space-y-3 text-zinc-100"
    >
      <div>
        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
          <Video className="w-4 h-4 text-emerald-400" />
          Zero-Lag Offline Video Render & Export Studio
        </h2>
        <p className="text-xs text-zinc-400 mt-0.5">
          Pre-computes the 7-band audio FFT timeline and renders frame-by-frame (<code className="text-emerald-300">gl.finish()</code> + <code className="text-cyan-300">WebCodecs</code> + <code className="text-amber-300">mp4-muxer</code>) with zero dropped frames on Android & Desktop.
        </p>
      </div>

      {/* Render Engine Mode Selector: Deterministic Offline Render vs Quick Live Clip Record */}
      <div
        data-testid="offloaded-render-card"
        className="bg-zinc-900 border-2 border-emerald-400/60 rounded-xl p-3 space-y-2.5 shadow-lg"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
            <Cpu className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>ZERO-LAG RENDER ENGINE ARCHITECTURE</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-emerald-400/20 border border-emerald-400/40 text-[10px] font-mono text-emerald-200">
            0 DROPPED FRAMES
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={isRecording}
            data-testid="backend-offline-deterministic"
            onClick={() => setExportRenderBackend('offline-deterministic')}
            className={`p-2.5 rounded-lg border text-left transition-colors ${
              isOfflineMode
                ? 'bg-emerald-950/60 border-emerald-400 text-white'
                : 'bg-zinc-950/60 border-white/10 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className="text-xs font-semibold flex items-center justify-between">
              <span>Offline Frame-by-Frame</span>
              <span className="text-[9px] font-mono text-emerald-300">WEB-CODECS</span>
            </div>
            <div className="text-[10px] text-zinc-300 mt-0.5">
              Deterministic <code className="text-emerald-300">mp4-muxer</code> + <code className="text-cyan-300">gl.finish()</code>
            </div>
          </button>

          <button
            type="button"
            disabled={isRecording}
            data-testid="backend-offloaded-rvfc"
            onClick={() => setExportRenderBackend('offloaded-rVFC')}
            className={`p-2.5 rounded-lg border text-left transition-colors ${
              !isOfflineMode
                ? 'bg-cyan-950/60 border-cyan-400 text-white'
                : 'bg-zinc-950/60 border-white/10 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <div className="text-xs font-semibold flex items-center justify-between">
              <span>Quick Live Clip Record</span>
              <span className="text-[9px] font-mono text-cyan-300">LIVE VJ</span>
            </div>
            <div className="text-[10px] text-zinc-300 mt-0.5">
              Real-time <code className="text-cyan-300">MediaRecorder</code> + <code className="text-amber-300">rVFC</code>
            </div>
          </button>
        </div>
      </div>

      {/* Active Audio Track & Upload */}
      <div className="bg-zinc-900/90 border border-amber-400/35 rounded-lg p-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-white flex items-center gap-1.5">
            <Music className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Active Audio Track</span>
          </div>
          <div className="text-[11px] font-mono text-zinc-300 truncate mt-0.5" title={audioTrackName}>
            {audioTrackName} ({formatTimestamp(trackDuration)})
          </div>
        </div>
        <label
          data-testid="export-upload-audio-label"
          className="relative overflow-hidden px-3 py-2 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-xs rounded-lg flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload Audio</span>
          <input
            ref={musicInputRef}
            type="file"
            accept=".mp3,.wav,.ogg,.flac,.m4a,.aac,.mp4,audio/*"
            onChange={handleUploadMusic}
            className="sr-only"
          />
        </label>
      </div>

      {/* Aspect Ratio Selector: 16:9 YouTube, 9:16 Shorts/TikTok, 1:1 Square */}
      <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-zinc-200">1. Aspect Ratio Framing</span>
          <span className="font-mono text-cyan-300">{aspectRatio}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { id: '16:9', title: '16:9 YouTube', sub: 'Landscape', icon: Monitor },
              { id: '9:16', title: '9:16 Shorts', sub: 'Vertical', icon: Smartphone },
              { id: '1:1', title: '1:1 Square', sub: 'Album / Feed', icon: Maximize2 },
            ] as { id: AspectRatioMode; title: string; sub: string; icon: typeof Monitor }[]
          ).map((item) => {
            const Icon = item.icon;
            const active = aspectRatio === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={isRecording}
                data-testid={`aspect-ratio-${item.id}`}
                onClick={() => setAspectRatio(item.id)}
                className={`p-2 rounded-lg border text-left flex items-center gap-2 transition-colors ${
                  active
                    ? 'bg-zinc-800 border-amber-400 text-white'
                    : 'bg-zinc-950/60 border-white/10 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Icon className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">{item.title}</div>
                  <div className="text-[10px] font-mono text-zinc-400 truncate">{item.sub}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Export Resolution Selector (720p, 1080p, 1440p, 4K) + FPS (30/60) + Bitrate (12/25/50 Mbps) + Sub-Frame Motion Blur */}
      <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-3 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-zinc-200">2. Export Resolution, FPS & Bitrate</span>
          <span
            data-testid="webgl-render-size-badge"
            className="font-mono tabular-nums text-amber-400"
          >
            {resSpec.width}×{resSpec.height} · {exportFps} FPS · {exportBitrateMbps} Mbps
          </span>
        </div>

        <div
          role="group"
          aria-label="Video Quality Selection"
          className="grid grid-cols-4 gap-1.5"
        >
          {videoQualityOptions.map((opt) => {
            const isSelected = exportResolutionPreset === opt.id;
            const dims = getExportResolutionDimensions(aspectRatio, opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                disabled={isRecording}
                data-testid={`video-quality-${opt.id}`}
                onClick={() => handleSelectVideoQuality(opt.id)}
                className={`p-2 rounded-lg border text-left transition-colors ${
                  isSelected
                    ? 'bg-zinc-800 border-amber-400 text-white'
                    : 'bg-zinc-950/60 border-white/10 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="text-xs font-semibold">{opt.id.toUpperCase()}</div>
                <div className="text-[10px] font-mono tabular-nums text-zinc-300 mt-0.5">
                  {dims.width}×{dims.height}
                </div>
                <div className="text-[9px] text-zinc-400 truncate">{opt.title}</div>
              </button>
            );
          })}
        </div>

        {/* Framerate (30 / 60 FPS), Bitrate (12 / 25 / 50 Mbps), and Motion Blur (1x / 2x / 4x) */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div>
            <div className="text-[10px] font-mono text-zinc-400 mb-1">Framerate</div>
            <div className="grid grid-cols-2 gap-1">
              {([30, 60] as ExportFpsPreset[]).map((fps) => (
                <button
                  key={fps}
                  type="button"
                  disabled={isRecording}
                  onClick={() => setShaderParam('exportFps', fps)}
                  className={`py-1 rounded border text-[11px] font-mono ${
                    exportFps === fps
                      ? 'bg-zinc-800 border-cyan-400 text-cyan-300 font-semibold'
                      : 'bg-zinc-950 border-white/10 text-zinc-400'
                  }`}
                >
                  {fps} FPS
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono text-zinc-400 mb-1">Bitrate (Mbps)</div>
            <div className="grid grid-cols-3 gap-1">
              {([12, 25, 50] as ExportBitratePreset[]).map((mbps) => (
                <button
                  key={mbps}
                  type="button"
                  disabled={isRecording}
                  onClick={() => setShaderParam('exportBitrateMbps', mbps)}
                  className={`py-1 rounded border text-[11px] font-mono ${
                    exportBitrateMbps === mbps
                      ? 'bg-zinc-800 border-amber-400 text-amber-300 font-semibold'
                      : 'bg-zinc-950 border-white/10 text-zinc-400'
                  }`}
                >
                  {mbps}M
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono text-zinc-400 mb-1">Motion Blur</div>
            <div className="grid grid-cols-3 gap-1">
              {([1, 2, 4] as SubFrameMotionBlur[]).map((blur) => (
                <button
                  key={blur}
                  type="button"
                  disabled={isRecording}
                  onClick={() => setShaderParam('subFrameMotionBlur', blur)}
                  className={`py-1 rounded border text-[11px] font-mono ${
                    subFrameMotionBlur === blur
                      ? 'bg-zinc-800 border-emerald-400 text-emerald-300 font-semibold'
                      : 'bg-zinc-950 border-white/10 text-zinc-400'
                  }`}
                >
                  {blur}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Video Format Container Selector */}
      <div
        data-testid="video-format-selector"
        className="bg-zinc-900/90 border border-white/10 rounded-lg p-3 space-y-2"
      >
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-zinc-200 flex items-center gap-1.5">
            <FileVideo className="w-3.5 h-3.5 text-amber-400" />
            <span>3. Video Container & Hardware Codec</span>
          </span>
          <span
            data-testid="active-video-format-badge"
            className="font-mono text-amber-400 font-semibold"
          >
            {formatSpec.label} ({formatSpec.badge})
          </span>
        </div>

        <div
          role="group"
          aria-label="Video Format Selection"
          className="grid grid-cols-2 gap-2"
        >
          {videoFormatOptions.map((fmt) => {
            const isSelected = exportVideoFormat === fmt.id;
            return (
              <button
                key={fmt.id}
                type="button"
                disabled={isRecording}
                data-testid={`video-format-${fmt.id}`}
                onClick={() => handleSelectVideoFormat(fmt.id)}
                className={`p-2 rounded-lg border text-left transition-colors ${
                  isSelected
                    ? 'bg-zinc-800 border-amber-400 text-white'
                    : 'bg-zinc-950/60 border-white/10 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="text-xs font-semibold flex items-center justify-between">
                  <span>{fmt.title}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-400/15 text-amber-300 border border-amber-400/30">
                    {fmt.badge}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                  {fmt.subtitle}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Render by Song Section (Part-by-Part Safe Rendering: Intro, Buildup, Drop, Breakdown, Outro) */}
      <div
        data-testid="song-section-render-panel"
        className="bg-zinc-900/95 border-2 border-amber-400/50 rounded-xl p-3 space-y-3 shadow-lg"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-1.5">
              <Scissors className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>4. Render by Song Section (Safe Part-by-Part Export)</span>
            </div>
            <p className="text-[11px] text-zinc-300 mt-0.5">
              Render each part of your song individually (<strong className="text-amber-300">Intro → Buildup → Drop → Breakdown → Outro</strong>) so you never risk losing a multi-hour full-song render. Files are numbered <code className="text-cyan-300">Part1..Part5</code> for easy stitching.
            </p>
          </div>
          <span
            data-testid="active-render-segment-badge"
            className="px-2 py-0.5 rounded bg-amber-400/20 border border-amber-400/45 text-[10px] font-mono font-bold text-amber-200 shrink-0"
          >
            {formatTimestamp(activeSegment.startSec)} → {formatTimestamp(activeSegment.endSec)} ({Math.round(activeSegment.durationSec)}s)
          </span>
        </div>

        {/* Inline Live Render Progress Banner right inside Section 4 */}
        {(isRecording || offlineRenderProgress.active) && (
          <div
            data-testid="drawer-section-render-active-banner"
            className="p-2.5 rounded-xl bg-amber-500/20 border-2 border-amber-400 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-amber-200 flex items-center gap-1.5 truncate">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
                <span className="truncate">
                  {offlineRenderProgress.statusLabel || `Rendering ${activeSegment.label}...`}
                </span>
              </span>
              <button
                type="button"
                data-testid="drawer-section-stop-render-btn"
                onClick={() => stopSynchronizedMusicVideoExport()}
                className="px-2.5 py-1 rounded bg-red-500/30 hover:bg-red-500/50 border border-red-400 text-red-100 font-bold text-[10px] shrink-0 cursor-pointer"
              >
                Stop Render
              </button>
            </div>
            <div className="w-full h-2.5 rounded-full bg-zinc-950 overflow-hidden border border-white/15">
              <div
                className="h-full bg-gradient-to-r from-amber-400 via-emerald-400 to-cyan-400 transition-all duration-150"
                style={{ width: `${Math.max(4, offlineRenderProgress.percent)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-200">
              <span>
                Frame {offlineRenderProgress.currentFrame} / {offlineRenderProgress.totalFrames} ({offlineRenderProgress.percent}%)
              </span>
              <span className="text-emerald-300">
                {offlineRenderProgress.fpsSpeed > 0
                  ? `${offlineRenderProgress.fpsSpeed} fps · ETA ${offlineRenderProgress.etaSeconds}s`
                  : 'Encoding frames...'}
              </span>
            </div>
          </div>
        )}

        {/* 5 Song Section Cards: Intro, Buildup, Drop, Breakdown, Outro */}
        <div
          role="group"
          aria-label="Individual Song Sections to Render"
          className="space-y-1.5"
        >
          {songSections.map((sec) => {
            const isSelected = exportDurationMode === sec.modeId;
            const renderedRecord = renderedSectionsHistory.find((r) => r.modeId === sec.modeId);
            const secFrames = Math.max(1, Math.floor(sec.durationSec * (exportFps || 60)));
            const modeLabel = autoChoreographyEnabled
              ? FRACTAL_MODE_INFO[sec.fractalMode]?.shortName ?? `Mode ${sec.fractalMode + 1}`
              : FRACTAL_MODE_INFO[fractalMode]?.shortName ?? `Mode ${fractalMode + 1}`;

            return (
              <div
                key={sec.modeId}
                data-testid={`song-section-card-${sec.section.toLowerCase()}`}
                className={`p-2.5 rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-400 text-white shadow-md'
                    : renderedRecord
                      ? 'bg-emerald-950/30 border-emerald-400/50 text-zinc-100'
                      : 'bg-zinc-950/70 border-white/10 text-zinc-300 hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <button
                    type="button"
                    disabled={isRecording}
                    data-testid={`select-section-${sec.section.toLowerCase()}-btn`}
                    onClick={() => {
                      selectSongSectionForExport(sec.modeId, sec.startSec, sec.endSec);
                      audioEngine.seekToTime(sec.startSec);
                      setStatusMessage(
                        `Selected Part ${sec.index + 1}: ${sec.section} (${formatTimestamp(sec.startSec)} → ${formatTimestamp(sec.endSec)} · ${Math.round(sec.durationSec)}s · ${secFrames} frames)`
                      );
                    }}
                    className="flex-1 min-w-[150px] text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded bg-amber-400 text-zinc-950 font-mono font-bold text-[10px]">
                        PART {sec.index + 1}
                      </span>
                      <span className="text-xs font-bold text-white">{sec.section}</span>
                      <span className="text-[11px] font-mono text-amber-300 tabular-nums">
                        {formatTimestamp(sec.startSec)} → {formatTimestamp(sec.endSec)}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">
                        ({Math.round(sec.durationSec)}s · {secFrames} frames)
                      </span>
                      {renderedRecord && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-400/20 border border-emerald-400/50 text-emerald-300 font-mono font-bold text-[9px]">
                          ✓ RENDERED
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1.5 truncate">
                      <span className="text-cyan-300 font-mono">{modeLabel}</span>
                      <span>·</span>
                      <span className="truncate">{sec.description}</span>
                    </div>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={isRecording}
                      title={`Preview ${sec.section} at ${formatTimestamp(sec.startSec)}`}
                      onClick={() => {
                        audioEngine.seekToTime(sec.startSec);
                        if (!useStudioStore.getState().isPlaying) {
                          audioEngine.togglePlayPause();
                        }
                      }}
                      className="px-2 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-[10px] font-semibold text-zinc-200 flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-2.5 h-2.5 fill-current text-amber-400" />
                      <span>Preview</span>
                    </button>

                    <button
                      type="button"
                      disabled={isRecording}
                      data-testid={`render-section-${sec.section.toLowerCase()}-btn`}
                      onClick={() => {
                        selectSongSectionForExport(sec.modeId, sec.startSec, sec.endSec);
                        const res = startSynchronizedMusicVideoExport(
                          exportResolutionPreset,
                          sec.modeId,
                          exportVideoFormat
                        );
                        setStatusMessage(res.message);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-zinc-950 font-bold text-[11px] flex items-center gap-1 shadow-sm cursor-pointer"
                    >
                      <CircleDot className="w-3 h-3" />
                      <span>Render {sec.section}</span>
                    </button>
                  </div>
                </div>

                {renderedRecord && (
                  <div className="mt-2 pt-1.5 border-t border-emerald-400/30 flex items-center justify-between gap-2 text-[10px]">
                    <span className="font-mono text-emerald-200 truncate">
                      Ready: {renderedRecord.filename} ({formatFileSize(renderedRecord.blobSize)})
                    </span>
                    <a
                      href={renderedRecord.url}
                      download={renderedRecord.filename}
                      className="px-2 py-0.5 rounded bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-bold shrink-0 flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>Save Part {sec.index + 1}</span>
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Fine-Tune Start / End Timestamps for Custom Section or Trimming Any Song Part */}
        <div
          data-testid="custom-section-trim-controls"
          className="p-2.5 rounded-lg bg-zinc-950/90 border border-white/10 space-y-2"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-zinc-200">
              Fine-Tune Section Start &amp; End Timestamps (Custom Trim)
            </span>
            <div className="flex items-center gap-1">
              {loopA !== null && loopB !== null && loopB > loopA + 0.5 && (
                <button
                  type="button"
                  disabled={isRecording}
                  data-testid="use-ab-loop-for-export-btn"
                  onClick={() => {
                    selectSongSectionForExport('ab-loop', loopA, loopB);
                    setStatusMessage(
                      `Using Timeline A/B Loop (${formatTimestamp(loopA)} → ${formatTimestamp(loopB)})`
                    );
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border cursor-pointer ${
                    exportDurationMode === 'ab-loop'
                      ? 'bg-cyan-400 text-zinc-950 border-cyan-300'
                      : 'bg-cyan-950/60 text-cyan-300 border-cyan-400/40 hover:bg-cyan-900/60'
                  }`}
                >
                  Use Timeline A/B Loop ({formatTimestamp(loopA)}–{formatTimestamp(loopB)})
                </button>
              )}
              <button
                type="button"
                disabled={isRecording}
                data-testid="duration-custom-range"
                onClick={() => {
                  selectSongSectionForExport(
                    'custom-range',
                    activeSegment.startSec,
                    activeSegment.endSec
                  );
                }}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border cursor-pointer ${
                  exportDurationMode === 'custom-range'
                    ? 'bg-amber-400 text-zinc-950 border-amber-300'
                    : 'bg-zinc-900 text-zinc-300 border-white/15 hover:text-white'
                }`}
              >
                Custom Range Mode
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Start Timestamp Slider & Nudge */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <label htmlFor="export-trim-start-input" className="text-zinc-400">
                  Start Time: <strong className="text-amber-300">{formatTimestamp(activeSegment.startSec)}</strong> ({Math.round(activeSegment.startSec)}s)
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={isRecording}
                    onClick={() => {
                      const nextStart = Math.max(0, activeSegment.startSec - 1);
                      selectSongSectionForExport('custom-range', nextStart, Math.max(nextStart + 2, activeSegment.endSec));
                    }}
                    className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                  >
                    -1s
                  </button>
                  <button
                    type="button"
                    disabled={isRecording}
                    onClick={() => {
                      const nextStart = Math.min(trackDuration - 2, activeSegment.startSec + 1);
                      selectSongSectionForExport('custom-range', nextStart, Math.max(nextStart + 2, activeSegment.endSec));
                    }}
                    className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                  >
                    +1s
                  </button>
                </div>
              </div>
              <input
                id="export-trim-start-input"
                type="range"
                aria-label="Section Start Time in Seconds"
                disabled={isRecording}
                min={0}
                max={Math.max(1, Math.floor(trackDuration) - 2)}
                step={1}
                value={Math.round(activeSegment.startSec)}
                onChange={(e) => {
                  const nextStart = Number(e.target.value);
                  const nextEnd = Math.max(nextStart + 2, activeSegment.endSec);
                  selectSongSectionForExport('custom-range', nextStart, nextEnd);
                }}
                className="w-full h-1.5 rounded-lg appearance-none bg-zinc-800 accent-amber-400 cursor-pointer"
              />
            </div>

            {/* End Timestamp Slider & Nudge */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <label htmlFor="export-trim-end-input" className="text-zinc-400">
                  End Time: <strong className="text-cyan-300">{formatTimestamp(activeSegment.endSec)}</strong> ({Math.round(activeSegment.endSec)}s)
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={isRecording}
                    onClick={() => {
                      const nextEnd = Math.max(activeSegment.startSec + 2, activeSegment.endSec - 1);
                      selectSongSectionForExport('custom-range', activeSegment.startSec, nextEnd);
                    }}
                    className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                  >
                    -1s
                  </button>
                  <button
                    type="button"
                    disabled={isRecording}
                    onClick={() => {
                      const nextEnd = Math.min(trackDuration, activeSegment.endSec + 1);
                      selectSongSectionForExport('custom-range', activeSegment.startSec, nextEnd);
                    }}
                    className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                  >
                    +1s
                  </button>
                </div>
              </div>
              <input
                id="export-trim-end-input"
                type="range"
                aria-label="Section End Time in Seconds"
                disabled={isRecording}
                min={Math.min(Math.floor(trackDuration), Math.round(activeSegment.startSec) + 2)}
                max={Math.max(5, Math.floor(trackDuration))}
                step={1}
                value={Math.round(activeSegment.endSec)}
                onChange={(e) => {
                  const nextEnd = Number(e.target.value);
                  selectSongSectionForExport('custom-range', activeSegment.startSec, nextEnd);
                }}
                className="w-full h-1.5 rounded-lg appearance-none bg-zinc-800 accent-cyan-400 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Quick Clip & Full Song Presets */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-mono text-zinc-400">
            Or Choose Quick Clip / Full Track Duration:
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {(
              [
                { id: '5s-test', label: '5s Fast Test', sub: '300 frames' },
                { id: '15s-clip', label: '15s Shorts', sub: '900 frames' },
                { id: '30s', label: '30s Clip', sub: '1800 frames' },
                { id: 'full-song', label: 'Full Song', sub: `00:00→${formatTimestamp(trackDuration)}` },
              ] as { id: ExportDurationMode; label: string; sub: string }[]
            ).map((d) => (
              <button
                key={d.id}
                type="button"
                disabled={isRecording}
                data-testid={`duration-${d.id}`}
                onClick={() => setShaderParam('exportDurationMode', d.id)}
                className={`py-1.5 px-2 rounded-lg border text-left transition-colors ${
                  exportDurationMode === d.id
                    ? 'bg-zinc-800 border-amber-400 text-white'
                    : 'bg-zinc-950/60 border-white/10 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="text-[11px] font-semibold truncate">{d.label}</div>
                <div className="text-[9px] font-mono text-zinc-400 truncate">{d.sub}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-white/10">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-amber-400 transition-all duration-200"
            style={{ width: `${isRecording ? progressPct : lastExportUrl ? 100 : 0}%` }}
          />
        </div>

        {/* Active Render Target Summary Banner */}
        <div
          data-testid="active-render-target-summary"
          className="px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-emerald-400/35 flex items-center justify-between gap-2 text-[11px] font-mono"
        >
          <span className="text-emerald-300 font-semibold truncate">
            Target: {activeSegment.label}
          </span>
          <span className="text-zinc-300 shrink-0">
            {targetFrameCount} frames @ {exportFps} FPS
          </span>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          {!isRecording ? (
            <>
              <button
                type="button"
                data-testid="start-offline-render-btn"
                onClick={handleStartExport}
                className="w-full py-2.5 px-4 bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <CircleDot className="w-4 h-4 shrink-0" />
                <span>
                  {isOfflineMode
                    ? `Render ${activeSegment.label} (${exportResolutionPreset.toUpperCase()} ${exportFps}FPS ${formatSpec.badge})`
                    : `Live Capture ${activeSegment.label} (${exportResolutionPreset.toUpperCase()} ${exportFps}FPS)`}
                </span>
              </button>

              {/* Quick "Select Next Unrendered Song Section" helper button */}
              {songSections.some(
                (sec) => !renderedSectionsHistory.some((r) => r.modeId === sec.modeId)
              ) && (
                <button
                  type="button"
                  data-testid="select-next-unrendered-section-btn"
                  onClick={() => {
                    const nextUnrendered =
                      songSections.find(
                        (sec) =>
                          sec.index >
                            (songSections.find((s) => s.modeId === exportDurationMode)?.index ?? -1) &&
                          !renderedSectionsHistory.some((r) => r.modeId === sec.modeId)
                      ) ??
                      songSections.find(
                        (sec) => !renderedSectionsHistory.some((r) => r.modeId === sec.modeId)
                      );
                    if (nextUnrendered) {
                      selectSongSectionForExport(
                        nextUnrendered.modeId,
                        nextUnrendered.startSec,
                        nextUnrendered.endSec
                      );
                      audioEngine.seekToTime(nextUnrendered.startSec);
                      setStatusMessage(
                        `Queued Next Section: Part ${nextUnrendered.index + 1} · ${nextUnrendered.section} (${formatTimestamp(nextUnrendered.startSec)} → ${formatTimestamp(nextUnrendered.endSec)})`
                      );
                    }
                  }}
                  className="w-full py-1.5 px-3 bg-amber-400/15 hover:bg-amber-400/25 text-amber-200 font-semibold text-[11px] rounded-lg border border-amber-400/40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Queue Next Song Section</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}

              {isOfflineMode && (
                <button
                  type="button"
                  onClick={handleStartQuickLiveRecord}
                  className="w-full py-1.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-[11px] rounded-lg border border-white/10 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Quick Live Clip Record ({activeSegment.label})</span>
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={handleStopExport}
              className="w-full py-2.5 px-4 bg-rose-500 hover:bg-rose-400 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop / Cancel Active Section Render</span>
            </button>
          )}

          <button
            type="button"
            data-testid="export-drawer-toggle-preview-btn"
            onClick={togglePreviewHidden}
            className={`w-full py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
              isPreviewHidden
                ? 'bg-cyan-400 text-zinc-950 border-cyan-300 font-bold'
                : 'bg-zinc-950 hover:bg-zinc-800 text-cyan-300 border-cyan-400/40'
            }`}
          >
            {isPreviewHidden ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Show Render Preview Window</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Hide Render Preview (Faster Background Render)</span>
              </>
            )}
          </button>

          {lastExportUrl && lastExportFilename && (
            <div
              data-testid="drawer-completed-export-card"
              className="mt-1 p-3 rounded-xl bg-emerald-950/35 border border-emerald-400/50 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-emerald-300 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Video Ready to Save ({formatFileSize(lastExportBlobSize)})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setExportCompleteModalOpen(true)}
                  className="px-2 py-0.5 rounded bg-emerald-400/15 hover:bg-emerald-400/25 border border-emerald-400/30 text-[10px] font-mono text-emerald-200"
                >
                  Open Save Dialog
                </button>
              </div>

              <div className="text-[11px] font-mono text-zinc-300 truncate">{lastExportFilename}</div>

              <video
                src={lastExportUrl}
                controls
                playsInline
                className="w-full max-h-40 rounded-lg bg-black border border-white/15"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <a
                  href={lastExportUrl}
                  download={lastExportFilename}
                  data-testid="download-exported-video-link"
                  onClick={() => {
                    setStatusMessage(`Downloading ${lastExportFilename} (${formatFileSize(lastExportBlobSize)})...`);
                  }}
                  className="w-full py-2.5 px-3.5 bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-md"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>Download Video File</span>
                </a>

                <button
                  type="button"
                  data-testid="share-exported-video-btn"
                  onClick={async () => {
                    const res = await triggerNativePhoneShare();
                    setStatusMessage(res.message);
                  }}
                  className="w-full py-2.5 px-3.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-md"
                >
                  <Share2 className="w-4 h-4 shrink-0" />
                  <span>Save / Share to Phone</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {statusMessage && (
          <p data-testid="export-status-message" className="text-xs text-amber-300 font-mono">
            {statusMessage}
          </p>
        )}
      </div>

      {/* Integrated AI Art Director ("Auto-Choreograph to Track" + One-Tap "AI Psychedelic Mutate") */}
      <div className="bg-zinc-900/90 border border-cyan-400/30 rounded-lg p-3 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-white flex items-center gap-1.5">
            <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI Synesthetic World & Fractal Director (Gemini)</span>
          </span>
          <span className="text-[10px] font-mono text-cyan-300">{activeChoreo.name}</span>
        </div>
        <div className="space-y-1.5">
          <input
            type="text"
            value={aiPromptInput}
            onChange={(e) => setShaderParam('aiPromptInput', e.target.value)}
            placeholder="Describe world or vibe (e.g. Bioluminescent fractal forest with glowing phoenix birds)..."
            className="w-full bg-zinc-950 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-500"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            <button
              type="button"
              disabled={isGeneratingAi}
              data-testid="ai-tune-single-mode-btn"
              onClick={() => handleGenerateAiChoreography(true)}
              className="py-1.5 px-3 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-zinc-950 font-semibold text-xs rounded-lg transition-colors"
            >
              {isGeneratingAi ? 'Tuning...' : 'AI Tune Single Mode'}
            </button>
            <button
              type="button"
              disabled={isGeneratingAi}
              data-testid="ai-choreograph-full-song-btn"
              onClick={() => handleGenerateAiChoreography(false)}
              className="py-1.5 px-3 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 text-zinc-950 font-semibold text-xs rounded-lg transition-colors"
            >
              {isGeneratingAi ? 'Choreographing...' : 'AI Choreograph Full Song'}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <button
            type="button"
            data-testid="export-tab-ai-mutate-btn"
            onClick={() => {
              aiPsychedelicMutate();
              setStatusMessage('AI Psychedelic Mutate applied (4D + Kaleidoscope + DMT Palette)');
            }}
            className="py-1.5 px-2.5 rounded-lg bg-fuchsia-500/20 hover:bg-fuchsia-500/30 border border-fuchsia-400/50 text-fuchsia-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-fuchsia-300" />
            <span>AI Psychedelic Mutate</span>
          </button>
          <button
            type="button"
            data-testid="export-tab-randomize-dna-btn"
            onClick={() => {
              randomizeDna();
              setStatusMessage('Randomized Fractal DNA & 4D Slice');
            }}
            className="py-1.5 px-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-white/15 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Randomize DNA</span>
          </button>
        </div>
      </div>

      {/* GPU-Heavy Mode & Live Preview Auto-FPS DRS Controls */}
      <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>GPU-Heavy Mode</span>
              <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-cyan-400/15 text-cyan-300 border border-cyan-400/30">
                {gpuHeavyMode ? 'highp 32-bit' : 'mediump 16-bit'}
              </span>
            </div>
            <div className="text-[10px] text-zinc-400 mt-0.5">
              Forces GLSL <code className="text-cyan-300">highp</code> precision & multi-threaded shader compilation.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={gpuHeavyMode}
            aria-label="GPU-Heavy Mode"
            data-testid="gpu-heavy-mode-toggle"
            onClick={() => setGpuHeavyMode(!gpuHeavyMode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono shrink-0 border transition-colors ${
              gpuHeavyMode
                ? 'bg-cyan-400 text-zinc-950 border-cyan-300'
                : 'bg-zinc-950 text-zinc-400 border-white/15 hover:text-white'
            }`}
          >
            {gpuHeavyMode ? 'ON (highp)' : 'OFF'}
          </button>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-zinc-200 flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" />
            Live Preview Auto-FPS DRS
          </span>
          <span className="font-mono tabular-nums text-cyan-400">
            {liveFps} FPS · {Math.round(activeRenderScale * 100)}% FBO ({activeBackbufferWidth}×{activeBackbufferHeight})
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(['1080p', '720p'] as PreviewResolutionCap[]).map((cap) => (
            <button
              key={cap}
              type="button"
              onClick={() => setShaderParam('previewResolutionCap', cap)}
              className={`py-1 px-2.5 rounded border text-xs font-medium text-left transition-colors ${
                previewResolutionCap === cap
                  ? 'bg-zinc-800 border-cyan-400 text-white'
                  : 'bg-zinc-950/60 border-white/10 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Preview Cap: <span className="font-mono">{cap}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {(
            [
              { id: 'auto-60fps', label: 'Auto DRS' },
              { id: '0.5', label: '50% Fast' },
              { id: '0.75', label: '75% Bal' },
              { id: '1.0', label: '100% Native' },
            ] as { id: RenderScaleMode; label: string }[]
          ).map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setShaderParam('renderScaleMode', mode.id)}
              className={`py-1 px-2 rounded border text-[11px] font-medium text-center transition-colors ${
                renderScaleMode === mode.id
                  ? 'bg-zinc-800 border-amber-400 text-white'
                  : 'bg-zinc-950/60 border-white/10 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1.5 border-t border-white/10 font-mono">
          <span className="flex items-center gap-1.5 truncate">
            <Cpu className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">{gpuRendererName}</span>
          </span>
          <span className="flex items-center gap-1 text-emerald-400 shrink-0">
            <Layers className="w-3 h-3" />
            <span>
              {shaderCompileStatus === 'compiling-multithreaded'
                ? 'Compiling Shader...'
                : 'WebCodecs + highp Ready'}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
