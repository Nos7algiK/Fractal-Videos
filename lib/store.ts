import { create } from 'zustand';
import {
  AcousticSummary,
  AspectRatioMode,
  AutoSwitchTriggerMode,
  CollageJoinMode,
  ControlComplexityMode,
  CosinePalette,
  DivineCreationStage,
  ExportBitratePreset,
  ExportDurationMode,
  ExportFpsPreset,
  ExportRenderBackend,
  ExportResolutionPreset,
  ExportVideoFormat,
  FractalMode,
  HudViewMode,
  Image3DConversionStyle,
  ImageFractalProfile,
  MultiImageBlendMethod,
  MultiImageItem,
  MultiImageTransitionTrigger,
  OfflineRenderProgress,
  PolychoraType,
  PreviewResolutionCap,
  QualityTier,
  RenderedSectionOutput,
  RenderScaleMode,
  SpectrumBarCount,
  StudioInspectorTab,
  StudioPreset,
  SubFrameMotionBlur,
  TextureMappingMode,
  TransientAudioGestureState,
  VideoQualityPreset,
  VisualChoreography,
  WorldBiomeMode,
  ZenoSubMode,
  ZoomDirectionMode,
} from './types';
import {
  BUILTIN_CHOREOGRAPHIES,
  COSINE_PALETTE_PRESETS,
  FACTORY_STUDIO_PRESETS,
} from './presets';

const PRESET_STORAGE_KEY = 'chromafract_studio_presets_v1';

function persistCustomPresetsToLocalStorage(allPresets: StudioPreset[]) {
  if (typeof window === 'undefined') return;
  try {
    const customOnly = allPresets.filter((p) => !p.isFactory);
    const favFactoryIds = allPresets.filter((p) => p.isFactory && p.isFavorite).map((p) => p.id);
    window.localStorage.setItem(
      PRESET_STORAGE_KEY,
      JSON.stringify({ customPresets: customOnly, favFactoryIds })
    );
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Non-reactive, high-frequency (60Hz+) mutable state container read directly
 * inside the WebGL animation loop without triggering React re-renders.
 */
export const transientState: TransientAudioGestureState = {
  bands: {
    subBass: 0,
    bass: 0,
    lowMid: 0,
    mid: 0,
    upperMid: 0,
    presence: 0,
    brilliance: 0,
  },
  bassCumulative: 0,
  midCumulative: 0,
  juiceBounce: 1.0,
  rmsEnergy: 0,
  audioIntensity: 0,
  fractalSpike: 0,
  dynamicTime: 1.25,
  kickTransient: 0,
  snareTransient: 0,
  hiHatSparkle: 0,
  bpmPhase: 0,
  mirrorPhase: 0,
  estimatedBpm: 124,
  isBeatBang: false,
  manualBeatFlash: 0,
  dominantFreqHz: 261.63,
  dominantNote: 'C',
  pitchHue: 0,
  cameraOrbitX: 0,
  cameraOrbitY: 0,
  cameraRollZ: 0,
  cameraLateralX: 0,
  cameraLateralY: 0,
  cameraZoomSpeed: 1.0,
  gyroTiltX: 0,
  gyroTiltY: 0,
  xyPad1: [0.35, 0.28], // Geometry & 4D Slice / Julia Constant (c.x, c.y)
  xyPad2: [0.68, 0.45], // [Kaleidoscope/Transcendence Warp, Texture Mix]
  prevFractalMode: 0,
  targetFractalMode: 0,
  modeMorphProgress: 1.0,
  currentTime: 0,
  duration: 180,
  isPlaying: false,
};

function generateDefaultSynthWaveformPeaks(): number[] {
  const peaks: number[] = [];
  for (let i = 0; i < 120; i++) {
    const ratio = i / 120;
    let env = 0.45;
    if (ratio < 0.2) {
      env = 0.32 + (ratio / 0.2) * 0.25;
    } else if (ratio < 0.42) {
      env = 0.52 + ((ratio - 0.2) / 0.22) * 0.38;
    } else if (ratio < 0.68) {
      env = 0.85 + Math.sin(i * 1.7) * 0.14;
    } else if (ratio < 0.86) {
      env = 0.28 + Math.sin(i * 0.8) * 0.12;
    } else {
      env = Math.max(0.18, 0.55 * (1 - (ratio - 0.86) / 0.14));
    }
    const beatPulse = (i % 4 === 0 ? 0.12 : 0) + Math.abs(Math.sin(i * 0.65)) * 0.08;
    peaks.push(Number(Math.min(1.0, Math.max(0.12, env + beatPulse)).toFixed(3)));
  }
  return peaks;
}

export interface StudioReactiveState {
  // Simple vs. Advanced Control Complexity Mode & Zoom Direction
  controlComplexityMode: ControlComplexityMode;
  zoomDirectionMode: ZoomDirectionMode;

  // Preset Manager Vault
  presets: StudioPreset[];
  activePresetId: string | null;

  // Multi-Image AI 3D Fractalizer Queue (Mode 10 & Global Morph)
  multiImages: MultiImageItem[];
  activeImageIndexA: number;
  activeImageIndexB: number;
  imageMorphPhase: number;
  imageTransitionTrigger: MultiImageTransitionTrigger;
  imageBlendMethod: MultiImageBlendMethod;
  img3DStyle: Image3DConversionStyle;
  kifsFoldAngle: number;
  aiImageFractalSummary: string;
  imageDepth3D: number;
  imageFractalizeIterations: number;
  imageMorphTurbulence: number;

  // Tab 1 (modes): 11 Visualizer Modes, Master Mode Switcher & AI Procedural World Genesis v2
  fractalMode: FractalMode;
  manualMorphOverride: number | null; // null = auto smooth morph; 0..1 = manual cross-fade
  worldBiomeMode: WorldBiomeMode;
  worldBiomeMorph: number; // 0.0 = Mountains, 1.0 = Nature/Flora, 2.0 = Cyber-City, 3.0 = Fractal Animals
  transcendence: number; // 0.0 (Grounded Planet) -> 1.0 (4D Kleinian/Mandelbulb Hyper-Cathedral)
  collageJoinMode: CollageJoinMode; // 0 = Smooth smin, 1 = Terraced Stairs, 2 = Chamfer, 3 = Subtraction Cutout

  // Tab 2 (geometry): 4D Hyperspace Polychora, Zeno's Paradox & Fractal Geometry
  polychoraType: PolychoraType; // 0 = 8-Cell, 1 = 5-Cell, 2 = 16-Cell, 3 = 24-Cell, 4 = 120-Cell, 5 = Clifford Torus
  zenoSubMode: ZenoSubMode; // 'all' | 'dichotomy' | 'achilles-droste' | 'frozen-arrow'
  zenoReverseDirection: boolean; // false = Inward Infinite Fall, true = Outward Emergence
  zenoSpeed: number; // 0.1..3.0 (Zeno Dichotomy zoom rate)
  zenoHalvingRate: number; // 0.1..3.0 (3D dyadic 1/2^n octave cascade speed)
  zenoEscherTwist: number; // -2.0..2.0 (Escher-Droste logarithmic spiral twist multiplier)
  zenoArrowParadoxMix: number; // 0.0..1.0 (Zeno Flying Arrow stroboscopic time-slice intensity)
  zenoSliceHz: number; // 2.0..24.0 (Discrete frozen chrono-echo slices per second)
  rot4dXW: number; // -3.14..3.14
  rot4dYW: number; // -3.14..3.14
  rot4dZW: number; // -3.14..3.14
  wCameraDist: number; // 1.4..3.6
  creatureSpeed: number; // 0.2..3.0 (Wing/Fin articulation speed in Mode 3)
  iterationDetail: number; // 4..16
  palette: CosinePalette;
  bulbPower: number;
  kleinianScale: number;
  foldLimit: number;
  tunnelScale: number; // Tunnel Radius
  tunnelCurvature: number; // Wormhole path curvature
  cameraSpeed: number;
  cameraFov: number; // 0.6..2.2

  // Mode 25: Divine Creation (Fiat Lux, Sacred Geometry) & Global Volumetric God Rays Sculptor
  divineCreationStage: DivineCreationStage; // 0 = Auto-Evolve, 1..6 = Locked Stage
  divineGodRaysEnabled: boolean; // Global Volumetric Crepuscular God Rays toggle (works across all 26 modes)
  divineGodRayIntensity: number; // 0.0..1.5 (0% to 150%)
  godRayDensity: number; // 0.2..1.5
  godRayWeight: number; // 0.05..1.0
  godRayDecay: number; // 0.92..0.99
  godRayExposure: number; // 0.1..2.0
  sacredHaloEnabled: boolean; // Global Golden-Ratio & Sacred Geometry Halo Overlay toggle
  sacredFiligreeMix: number; // 0.0..1.0 (0% to 100%)
  aiManifestCreationArcEnabled: boolean; // AI "Manifest Creation" Choreography arc toggle

  // Tab 3 (audio): Bass Nation & Hyper-Audio Reactivity Matrix
  reactivityGain: number; // 0.0..3.0 (0% to 300%)
  peakExponent: number; // 0.8..2.6
  bounceIntensity: number; // 0.0..2.5
  spikeSensitivity: number; // 0.0..3.0
  cameraShakeIntensity: number; // 0.0..2.0 (Sub-Bass directional camera shake)
  subBassKickGain: number; // 0.0..2.5 (20-60Hz)
  bassMorphGain: number; // 0.0..2.5 (60-250Hz)
  lowMidGain: number; // 0.0..2.5 (250-500Hz)
  midTwistGain: number; // 0.0..2.5 (500-2kHz)
  upperMidGain: number; // 0.0..2.5 (2-4kHz)
  trebleSparkleGain: number; // 0.0..2.5 (4-6kHz)
  brillianceGain: number; // 0.0..2.5 (6-20kHz)
  beatShockwaveEnabled: boolean;
  snareKaleidoJumpEnabled: boolean;
  pitchSynesthesiaEnabled: boolean;
  bpmCameraSurgeEnabled: boolean;

  // Tab 4 (fx): Psychedelic FX, High-Clarity Grading, Volumetric Clouds & Color Mastering
  clarity: number; // 0.0..2.0 (0% to 200% Clarity & Edge Contrast Booster u_clarity)
  metaBrightness: number; // 0.5..1.8
  metaContrast: number; // 0.5..1.8
  metaGamma: number; // 0.6..1.6
  metaSaturation: number; // 0.0..2.0
  metaHueSpeed: number; // 0.0..2.0
  colorInvert: boolean;
  kaleidoSlices: number; // 1..24 (1 = off)
  mirrorX: boolean;
  mirrorY: boolean;
  fbmWarpStrength: number; // 0.0..1.5
  feedbackTrailLength: number; // 0.5..0.96
  cloudDensity: number; // 0.0..2.0 (Beer-Lambert Volumetric Cloud / Fog Density)
  bloomIntensity: number;
  chromaticAberration: number;
  vignetteDarkness: number;
  filmGrain: number;
  glitchActive: boolean;
  chaosMode: boolean;

  // GPU-Heavy Mode (Forces GLSL highp float/int & Multi-Threaded KHR_parallel_shader_compile)
  gpuHeavyMode: boolean;
  parallelCompileSupported: boolean;
  shaderCompileStatus: 'ready' | 'compiling-multithreaded';

  // Tab 5 (image): Custom Image / Bass Emblem Studio
  userTextureUrl: string | null;
  userTextureName: string | null;
  userTextureAspect: number;
  textureMappingMode: TextureMappingMode;
  emblemSize: number; // 0.2..0.75
  spectrumBarCount: SpectrumBarCount; // 32 | 64 | 128
  textureMix: number;
  textureScale: number;
  trapScale: number;
  imageSpinSpeed: number;
  imageBeatPulse: number;

  // Audio Track, Waveform Scrubber, A/B Loop & Master Mode Switcher State
  audioTrackName: string;
  audioSourceType: 'synth' | 'file';
  isPlaying: boolean;
  audioVolume: number;
  waveformPeaks: number[];
  loopA: number | null;
  loopB: number | null;
  abLoopActive: boolean;
  autoChoreographyEnabled: boolean; // false = LOCK SINGLE MODE (Whole Video), true = AUTO-SWITCH PER SONG PART
  autoSwitchTriggerMode: AutoSwitchTriggerMode; // 'song-sections' | 'every-n-bars' | 'ai-storyboard'
  autoSwitchBars: 4 | 8 | 16;
  transitionMorphSeconds: number; // 0.5..8.0 seconds crossfade duration
  autoSwitchEnabledModes: boolean[]; // length 11 inclusion mask for Auto-Switch rotation
  activeSectionName: string;
  acousticSummary: AcousticSummary | null;

  // AI Choreography Presets
  choreographies: VisualChoreography[];
  activeChoreographyIndex: number;
  aiPromptInput: string;
  isGeneratingAi: boolean;
  aiError: string | null;

  // 3-State View / HUD Mode & Studio Workspace Layout
  viewMode: HudViewMode; // 'studio' | 'clean-player' | 'zen-fullscreen'
  zenMode: boolean; // true when viewMode === 'zen-fullscreen'
  aspectRatio: AspectRatioMode;
  previewResolutionCap: PreviewResolutionCap;
  renderScaleMode: RenderScaleMode;
  qualityTier: QualityTier;
  showXyPads: boolean;
  activeDrawer: 'none' | 'ai' | 'shader' | 'texture' | 'export';
  activeInspectorTab: StudioInspectorTab;
  gyroEnabled: boolean;
  gpuRendererName: string;
  liveFps: number;
  activeRenderScale: number;
  activeBackbufferWidth: number;
  activeBackbufferHeight: number;

  // Tab 6 (export): Zero-Lag Offline Video Render & Export Studio
  exportRenderBackend: ExportRenderBackend;
  pausePreviewDuringOffload: boolean;
  isPreviewHidden: boolean;
  offloadedWorkerActive: boolean;
  rVfcCadenceHz: number;
  exportedFrameCount: number;
  exportVideoFormat: ExportVideoFormat;
  videoQuality: VideoQualityPreset;
  exportResolutionPreset: ExportResolutionPreset;
  exportFps: ExportFpsPreset;
  exportBitrateMbps: ExportBitratePreset;
  subFrameMotionBlur: SubFrameMotionBlur;
  exportDurationMode: ExportDurationMode;
  customExportStartSec: number;
  customExportEndSec: number;
  renderedSectionsHistory: RenderedSectionOutput[];
  trackDuration: number;
  isRecording: boolean;
  recordingSeconds: number;
  recordingMimeType: string;
  offlineRenderProgress: OfflineRenderProgress;
  lastExportUrl: string | null;
  lastExportFilename: string | null;
  lastExportBlobSize: number;
  exportCompleteModalOpen: boolean;

  // Actions
  selectSongSectionForExport: (
    mode: ExportDurationMode,
    startSec: number,
    endSec: number
  ) => void;
  recordRenderedSectionOutput: (record: RenderedSectionOutput) => void;
  setControlComplexityMode: (mode: ControlComplexityMode) => void;
  setZoomDirectionMode: (mode: ZoomDirectionMode) => void;

  // Simple Mode 9 High-Impact Macro Actions
  setMacroReactivity: (percent: number) => void;
  setMacroSpeed: (percent: number) => void;
  setMacroScreenShake: (percent: number) => void;
  setMacroClarity: (percent: number) => void;
  setMacroTrippySymmetry: (percent: number) => void;
  setMacroDepth3DGlow: (percent: number) => void;
  setMacroImageFractalMix: (percent: number) => void;

  // Preset Manager Vault Actions
  hydratePresetsFromStorage: () => void;
  saveNewPreset: (
    name: string,
    category?: StudioPreset['category'],
    thumbnailDataUrl?: string
  ) => StudioPreset;
  loadPreset: (presetId: string) => void;
  deletePreset: (presetId: string) => void;
  toggleFavoritePreset: (presetId: string) => void;
  renamePreset: (presetId: string, newName: string) => void;
  duplicatePreset: (presetId: string) => void;
  importPresetsJson: (jsonStr: string) => boolean;

  // Multi-Image AI 3D Fractalizer Actions
  addMultiImages: (items: MultiImageItem[]) => void;
  removeMultiImage: (id: string) => void;
  moveMultiImage: (id: string, direction: 'left' | 'right') => void;
  triggerNextImageTransition: () => void;
  setImageMorphPhase: (phase: number) => void;
  setImageTransitionTrigger: (trigger: MultiImageTransitionTrigger) => void;
  setImageBlendMethod: (method: MultiImageBlendMethod) => void;
  setImg3DStyle: (style: Image3DConversionStyle) => void;
  applyAiImageFractalProfile: (profile: ImageFractalProfile) => void;

  setFractalMode: (mode: FractalMode) => void;
  cycleFractalMode: () => void;
  setWorldBiomeMode: (biome: WorldBiomeMode) => void;
  setZenoSubMode: (subMode: ZenoSubMode) => void;
  toggleAutoSwitchModeIncluded: (mode: FractalMode) => void;
  setShaderParam: <K extends keyof StudioReactiveState>(
    key: K,
    value: StudioReactiveState[K]
  ) => void;
  setGpuHeavyMode: (enabled: boolean) => void;
  setVideoQuality: (quality: VideoQualityPreset) => void;
  setExportVideoFormat: (format: ExportVideoFormat) => void;
  setExportRenderBackend: (backend: ExportRenderBackend) => void;
  setPausePreviewDuringOffload: (pause: boolean) => void;
  setIsPreviewHidden: (hidden: boolean) => void;
  togglePreviewHidden: () => void;
  setOfflineRenderProgress: (progress: Partial<OfflineRenderProgress>) => void;
  setPalette: (palette: CosinePalette) => void;
  applyChoreography: (choreo: VisualChoreography, addToList?: boolean) => void;
  selectChoreographyIndex: (index: number) => void;
  setUserTexture: (url: string | null, name: string | null, aspect: number) => void;
  setAudioStatus: (
    playing: boolean,
    trackName?: string,
    sourceType?: 'synth' | 'file'
  ) => void;
  setAcousticSummary: (summary: AcousticSummary) => void;
  setAspectRatio: (ratio: AspectRatioMode) => void;
  setQualityTier: (tier: QualityTier) => void;
  setViewMode: (mode: HudViewMode) => void;
  cycleViewMode: () => void;
  toggleCleanPlayerMode: () => void;
  setZenMode: (zen: boolean) => void;
  setShowXyPads: (show: boolean) => void;
  setActiveDrawer: (drawer: 'none' | 'ai' | 'shader' | 'texture' | 'export') => void;
  setActiveInspectorTab: (tab: StudioInspectorTab) => void;
  triggerBeatBang: () => void;
  randomizeDna: () => void;
  aiPsychedelicMutate: () => void;
  resetCamera: () => void;
  toggleAbLoop: () => void;
  clearAbLoop: () => void;
  setRecordingState: (recording: boolean, seconds?: number, mimeType?: string) => void;
  setLastExport: (url: string | null, filename: string | null, blobSize?: number) => void;
  setExportCompleteModalOpen: (open: boolean) => void;
}

const initialChoreo = BUILTIN_CHOREOGRAPHIES[0];

export const useStudioStore = create<StudioReactiveState>((set, get) => ({
  controlComplexityMode: 'simple',
  zoomDirectionMode: 'inward',

  presets: [...FACTORY_STUDIO_PRESETS],
  activePresetId: FACTORY_STUDIO_PRESETS[0].id,

  multiImages: [],
  activeImageIndexA: 0,
  activeImageIndexB: 1,
  imageMorphPhase: 0.0,
  imageTransitionTrigger: 'smooth-time',
  imageBlendMethod: 'liquid-fbm',
  img3DStyle: 0,
  kifsFoldAngle: 0.58,
  aiImageFractalSummary:
    'Ready: Upload 1–12+ images to automatically convert them into raymarched 3D fractals.',
  imageDepth3D: 0.72,
  imageFractalizeIterations: 6,
  imageMorphTurbulence: 0.55,

  fractalMode: initialChoreo.fractalMode,
  manualMorphOverride: null,
  worldBiomeMode: 'auto',
  worldBiomeMorph: 0.0,
  transcendence: initialChoreo.transcendence ?? 0.18,
  collageJoinMode: 0,

  polychoraType: 0,
  zenoSubMode: 'all',
  zenoReverseDirection: false,
  zenoSpeed: 1.15,
  zenoHalvingRate: 0.85,
  zenoEscherTwist: 1.0,
  zenoArrowParadoxMix: 0.35,
  zenoSliceHz: 8.0,
  rot4dXW: 0.65,
  rot4dYW: 0.48,
  rot4dZW: 0.32,
  wCameraDist: 2.25,
  creatureSpeed: 1.35,
  iterationDetail: 10,
  palette: initialChoreo.palette,
  bulbPower: initialChoreo.bulbPower,
  kleinianScale: initialChoreo.kleinianScale,
  foldLimit: initialChoreo.foldLimit,
  tunnelScale: 2.15,
  tunnelCurvature: 1.0,
  cameraSpeed: initialChoreo.cameraSpeed,
  cameraFov: 1.25,

  divineCreationStage: 0,
  divineGodRaysEnabled: false,
  divineGodRayIntensity: 1.0,
  godRayDensity: 0.94,
  godRayWeight: 0.52,
  godRayDecay: 0.96,
  godRayExposure: 1.15,
  sacredHaloEnabled: false,
  sacredFiligreeMix: 0.5,
  aiManifestCreationArcEnabled: false,

  reactivityGain: 1.35,
  peakExponent: 1.45,
  bounceIntensity: 1.15,
  spikeSensitivity: 1.5,
  cameraShakeIntensity: 0.85,
  subBassKickGain: 1.25,
  bassMorphGain: 1.2,
  lowMidGain: 1.1,
  midTwistGain: 1.15,
  upperMidGain: 1.1,
  trebleSparkleGain: 1.2,
  brillianceGain: 1.15,
  beatShockwaveEnabled: true,
  snareKaleidoJumpEnabled: true,
  pitchSynesthesiaEnabled: true,
  bpmCameraSurgeEnabled: true,

  clarity: 1.25,
  metaBrightness: 1.05,
  metaContrast: 1.08,
  metaGamma: 0.95,
  metaSaturation: 1.15,
  metaHueSpeed: 0.25,
  colorInvert: false,
  kaleidoSlices: 1,
  mirrorX: false,
  mirrorY: false,
  fbmWarpStrength: 0.35,
  feedbackTrailLength: 0.82,
  cloudDensity: 0.75,
  bloomIntensity: initialChoreo.bloomIntensity,
  chromaticAberration: initialChoreo.chromaticAberration,
  vignetteDarkness: 0.55,
  filmGrain: 0.1,
  glitchActive: false,
  chaosMode: initialChoreo.chaosMode,

  gpuHeavyMode: true,
  parallelCompileSupported: true,
  shaderCompileStatus: 'ready',

  userTextureUrl: null,
  userTextureName: null,
  userTextureAspect: 1.0,
  textureMappingMode: 'center-emblem',
  emblemSize: 0.38,
  spectrumBarCount: 64,
  textureMix: 0.65,
  textureScale: 1.25,
  trapScale: 0.85,
  imageSpinSpeed: 0.4,
  imageBeatPulse: 0.65,

  audioTrackName: 'Built-in Synesthetic Bass Odyssey (124 BPM)',
  audioSourceType: 'synth',
  isPlaying: false,
  audioVolume: 0.8,
  waveformPeaks: generateDefaultSynthWaveformPeaks(),
  loopA: null,
  loopB: null,
  abLoopActive: false,
  autoChoreographyEnabled: false, // Default: LOCK SINGLE MODE (Whole Video)
  autoSwitchTriggerMode: 'song-sections',
  autoSwitchBars: 8,
  transitionMorphSeconds: 2.0,
  autoSwitchEnabledModes: new Array(26).fill(true),
  activeSectionName: 'Intro',
  acousticSummary: {
    trackName: 'Built-in Synesthetic Bass Odyssey (124 BPM)',
    durationSeconds: 180,
    meanRms: 0.38,
    peakRms: 0.92,
    spectralCentroidHz: 1420,
    bassToMidRatio: 1.64,
    subBassEnergy: 0.72,
    highFreqBrilliance: 0.48,
    dynamicRangeDb: 14.2,
    estimatedBpm: 124,
    dominantKey: 'C Minor',
    dominantPitchHue: 0.0,
    transientDensity: 4.2,
    featureVector28D: [
      0.38, 0.92, 0.72, 0.68, 0.45, 0.52, 0.49, 0.44, 0.48, 1.64,
      0.62, 0.58, 0.14, 0.22, 0.81, 0.35, 0.47, 0.66, 0.73, 0.29,
      0.51, 0.64, 0.39, 0.77, 0.42, 0.59, 0.84, 0.31,
    ],
  },

  choreographies: BUILTIN_CHOREOGRAPHIES,
  activeChoreographyIndex: 0,
  aiPromptInput:
    '4D Tesseract hypercube morphing into bioluminescent fractal mountains, cyber-city skyscrapers, and soaring fractal phoenix on the bass drop',
  isGeneratingAi: false,
  aiError: null,

  viewMode: 'studio',
  zenMode: false,
  aspectRatio: '16:9',
  previewResolutionCap: '1080p',
  renderScaleMode: 'auto-60fps',
  qualityTier: 'balanced',
  showXyPads: false,
  activeDrawer: 'none',
  activeInspectorTab: 'modes',
  gyroEnabled: false,
  gpuRendererName: 'WebGL2 Hardware GPU',
  liveFps: 60,
  activeRenderScale: 0.75,
  activeBackbufferWidth: 1920,
  activeBackbufferHeight: 1080,

  exportRenderBackend: 'offline-deterministic',
  pausePreviewDuringOffload: true,
  isPreviewHidden: false,
  offloadedWorkerActive: false,
  rVfcCadenceHz: 60,
  exportedFrameCount: 0,
  exportVideoFormat: 'mp4-h264',
  videoQuality: '1080p',
  exportResolutionPreset: '1080p',
  exportFps: 60,
  exportBitrateMbps: 25,
  subFrameMotionBlur: 1,
  exportDurationMode: 'section-intro',
  customExportStartSec: 0,
  customExportEndSec: 36,
  renderedSectionsHistory: [],
  trackDuration: 180,
  isRecording: false,
  recordingSeconds: 0,
  recordingMimeType: 'video/mp4',
  offlineRenderProgress: {
    active: false,
    phase: 'idle',
    currentFrame: 0,
    totalFrames: 0,
    percent: 0,
    etaSeconds: 0,
    fpsSpeed: 0,
    statusLabel: 'Ready for Zero-Lag Offline Render',
    encoderName: 'WebCodecs H.264 + mp4-muxer',
  },
  lastExportUrl: null,
  lastExportFilename: null,
  lastExportBlobSize: 0,
  exportCompleteModalOpen: false,

  setControlComplexityMode: (controlComplexityMode) =>
    set({ controlComplexityMode, viewMode: 'studio', zenMode: false }),

  setZoomDirectionMode: (zoomDirectionMode) =>
    set({
      zoomDirectionMode,
      zenoReverseDirection: zoomDirectionMode === 'outward',
    }),

  // Simple Mode 8 High-Impact Macro Actions
  setMacroReactivity: (percent) => {
    const gain = Number(Math.max(0, Math.min(3.0, percent / 100)).toFixed(2));
    set({
      reactivityGain: gain,
      spikeSensitivity: Number(Math.max(0.2, Math.min(3.0, gain * 1.1)).toFixed(2)),
    });
  },

  setMacroSpeed: (percent) => {
    const spd = Number(Math.max(0, Math.min(3.0, percent / 100)).toFixed(2));
    set({
      cameraSpeed: spd,
      zenoSpeed: Number(Math.max(0.15, spd * 0.95).toFixed(2)),
      creatureSpeed: Number(Math.max(0.2, spd * 1.1).toFixed(2)),
    });
  },

  setMacroScreenShake: (percent) => {
    const norm = Math.max(0, Math.min(1.0, percent / 100));
    set({
      cameraShakeIntensity: Number((norm * 2.0).toFixed(2)),
      bounceIntensity: Number((0.4 + norm * 1.6).toFixed(2)),
    });
  },

  setMacroClarity: (percent) => {
    const c = Number(Math.max(0, Math.min(2.0, percent / 100)).toFixed(2));
    set({
      clarity: c,
    });
  },

  setMacroTrippySymmetry: (percent) => {
    const norm = Math.max(0, Math.min(1.0, percent / 100));
    const slices = norm < 0.06 ? 1 : Math.round(2 + norm * 22);
    set({
      kaleidoSlices: slices,
      feedbackTrailLength: Number((0.52 + norm * 0.42).toFixed(2)),
      transcendence: Number((0.15 + norm * 0.85).toFixed(2)),
      chaosMode: norm > 0.72,
    });
  },

  setMacroDepth3DGlow: (percent) => {
    const norm = Math.max(0, Math.min(1.0, percent / 100));
    set({
      imageDepth3D: Number((0.15 + norm * 1.25).toFixed(2)),
      bloomIntensity: Number((0.6 + norm * 1.8).toFixed(2)),
      cloudDensity: Number((0.2 + norm * 1.5).toFixed(2)),
    });
  },

  setMacroImageFractalMix: (percent) => {
    const norm = Math.max(0, Math.min(1.0, percent / 100));
    set({
      textureMix: Number(norm.toFixed(2)),
      imageFractalizeIterations: Math.max(1, Math.round(1 + norm * 9)),
    });
  },

  // Preset Manager Vault Actions
  hydratePresetsFromStorage: () => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(PRESET_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        customPresets?: StudioPreset[];
        favFactoryIds?: string[];
      };
      const favSet = new Set(parsed.favFactoryIds || []);
      const factoryMerged = FACTORY_STUDIO_PRESETS.map((fp) =>
        favSet.has(fp.id) ? { ...fp, isFavorite: true } : fp
      );
      const customList = Array.isArray(parsed.customPresets) ? parsed.customPresets : [];
      set({ presets: [...customList, ...factoryMerged] });
    } catch {
      // Ignore corrupt localStorage
    }
  },

  saveNewPreset: (name, category = 'User Custom', thumbnailDataUrl) => {
    const s = get();
    const cleanName =
      name.trim() || `Custom Setup ${s.presets.filter((p) => !p.isFactory).length + 1}`;
    const newPreset: StudioPreset = {
      id: `user-preset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: cleanName,
      category,
      description: `Saved custom setup on Mode ${s.fractalMode + 1} (${
        s.autoChoreographyEnabled ? 'Auto-Switch' : 'Locked Mode'
      })`,
      isFactory: false,
      isFavorite: true,
      createdAt: Date.now(),
      thumbnailDataUrl,
      snapshot: {
        fractalMode: s.fractalMode,
        autoChoreographyEnabled: s.autoChoreographyEnabled,
        zoomDirectionMode: s.zoomDirectionMode,
        palette: {
          a: [...s.palette.a] as [number, number, number],
          b: [...s.palette.b] as [number, number, number],
          c: [...s.palette.c] as [number, number, number],
          d: [...s.palette.d] as [number, number, number],
        },
        reactivityGain: s.reactivityGain,
        cameraSpeed: s.cameraSpeed,
        cameraShakeIntensity: s.cameraShakeIntensity,
        kaleidoSlices: s.kaleidoSlices,
        feedbackTrailLength: s.feedbackTrailLength,
        bloomIntensity: s.bloomIntensity,
        cloudDensity: s.cloudDensity,
        textureMix: s.textureMix,
        imageDepth3D: s.imageDepth3D,
        imageFractalizeIterations: s.imageFractalizeIterations,
        imageMorphTurbulence: s.imageMorphTurbulence,
        imageBlendMethod: s.imageBlendMethod,
        polychoraType: s.polychoraType,
        rot4dXW: s.rot4dXW,
        rot4dYW: s.rot4dYW,
        rot4dZW: s.rot4dZW,
        wCameraDist: s.wCameraDist,
        zenoSpeed: s.zenoSpeed,
        zenoHalvingRate: s.zenoHalvingRate,
        zenoEscherTwist: s.zenoEscherTwist,
        zenoArrowParadoxMix: s.zenoArrowParadoxMix,
        zenoSliceHz: s.zenoSliceHz,
        worldBiomeMode: s.worldBiomeMode,
        transcendence: s.transcendence,
        bulbPower: s.bulbPower,
        kleinianScale: s.kleinianScale,
        foldLimit: s.foldLimit,
        emblemSize: s.emblemSize,
        spectrumBarCount: s.spectrumBarCount,
        chaosMode: s.chaosMode,
        pitchSynesthesiaEnabled: s.pitchSynesthesiaEnabled,
        clarity: s.clarity,
        img3DStyle: s.img3DStyle,
        divineCreationStage: s.divineCreationStage,
        divineGodRaysEnabled: s.divineGodRaysEnabled,
        divineGodRayIntensity: s.divineGodRayIntensity,
        godRayDensity: s.godRayDensity,
        godRayWeight: s.godRayWeight,
        godRayDecay: s.godRayDecay,
        godRayExposure: s.godRayExposure,
        sacredHaloEnabled: s.sacredHaloEnabled,
        sacredFiligreeMix: s.sacredFiligreeMix,
        aiManifestCreationArcEnabled: s.aiManifestCreationArcEnabled,
      },
    };
    const nextPresets = [newPreset, ...s.presets];
    persistCustomPresetsToLocalStorage(nextPresets);
    set({ presets: nextPresets, activePresetId: newPreset.id });
    return newPreset;
  },

  loadPreset: (presetId) => {
    const s = get();
    const target = s.presets.find((p) => p.id === presetId);
    if (!target || !target.snapshot) return;
    const snap = target.snapshot;
    const safeMode = Math.max(0, Math.min(25, snap.fractalMode)) as FractalMode;
    if (s.fractalMode !== safeMode) {
      transientState.prevFractalMode = s.fractalMode;
      transientState.targetFractalMode = safeMode;
      transientState.modeMorphProgress = 0.0;
    }

    set({
      activePresetId: target.id,
      fractalMode: safeMode,
      autoChoreographyEnabled: snap.autoChoreographyEnabled,
      zoomDirectionMode: snap.zoomDirectionMode || 'inward',
      zenoReverseDirection: snap.zoomDirectionMode === 'outward',
      palette: {
        a: [...snap.palette.a] as [number, number, number],
        b: [...snap.palette.b] as [number, number, number],
        c: [...snap.palette.c] as [number, number, number],
        d: [...snap.palette.d] as [number, number, number],
      },
      reactivityGain: snap.reactivityGain,
      cameraSpeed: snap.cameraSpeed,
      cameraShakeIntensity: snap.cameraShakeIntensity,
      kaleidoSlices: snap.kaleidoSlices,
      feedbackTrailLength: snap.feedbackTrailLength,
      bloomIntensity: snap.bloomIntensity,
      cloudDensity: snap.cloudDensity,
      textureMix: snap.textureMix,
      imageDepth3D: snap.imageDepth3D,
      imageFractalizeIterations: snap.imageFractalizeIterations,
      imageMorphTurbulence: snap.imageMorphTurbulence,
      imageBlendMethod: snap.imageBlendMethod,
      polychoraType: snap.polychoraType,
      rot4dXW: snap.rot4dXW,
      rot4dYW: snap.rot4dYW,
      rot4dZW: snap.rot4dZW,
      wCameraDist: snap.wCameraDist,
      zenoSpeed: snap.zenoSpeed,
      zenoHalvingRate: snap.zenoHalvingRate,
      zenoEscherTwist: snap.zenoEscherTwist,
      zenoArrowParadoxMix: snap.zenoArrowParadoxMix,
      zenoSliceHz: snap.zenoSliceHz,
      worldBiomeMode: snap.worldBiomeMode,
      transcendence: snap.transcendence,
      bulbPower: snap.bulbPower,
      kleinianScale: snap.kleinianScale,
      foldLimit: snap.foldLimit,
      emblemSize: snap.emblemSize,
      spectrumBarCount: snap.spectrumBarCount,
      chaosMode: snap.chaosMode,
      pitchSynesthesiaEnabled: snap.pitchSynesthesiaEnabled,
      clarity: typeof snap.clarity === 'number' ? snap.clarity : 1.25,
      img3DStyle: typeof snap.img3DStyle === 'number' ? snap.img3DStyle : s.img3DStyle,
      divineCreationStage:
        typeof snap.divineCreationStage === 'number'
          ? snap.divineCreationStage
          : s.divineCreationStage,
      divineGodRaysEnabled:
        typeof snap.divineGodRaysEnabled === 'boolean'
          ? snap.divineGodRaysEnabled
          : safeMode === 25,
      divineGodRayIntensity:
        typeof snap.divineGodRayIntensity === 'number'
          ? snap.divineGodRayIntensity
          : s.divineGodRayIntensity,
      godRayDensity:
        typeof snap.godRayDensity === 'number' ? snap.godRayDensity : s.godRayDensity,
      godRayWeight:
        typeof snap.godRayWeight === 'number' ? snap.godRayWeight : s.godRayWeight,
      godRayDecay:
        typeof snap.godRayDecay === 'number' ? snap.godRayDecay : s.godRayDecay,
      godRayExposure:
        typeof snap.godRayExposure === 'number' ? snap.godRayExposure : s.godRayExposure,
      sacredHaloEnabled:
        typeof snap.sacredHaloEnabled === 'boolean'
          ? snap.sacredHaloEnabled
          : s.sacredHaloEnabled,
      sacredFiligreeMix:
        typeof snap.sacredFiligreeMix === 'number'
          ? snap.sacredFiligreeMix
          : s.sacredFiligreeMix,
      aiManifestCreationArcEnabled:
        typeof snap.aiManifestCreationArcEnabled === 'boolean'
          ? snap.aiManifestCreationArcEnabled
          : s.aiManifestCreationArcEnabled,
    });
  },

  deletePreset: (presetId) =>
    set((state) => {
      const next = state.presets.filter((p) => p.id !== presetId || p.isFactory);
      persistCustomPresetsToLocalStorage(next);
      return {
        presets: next,
        activePresetId:
          state.activePresetId === presetId ? next[0]?.id ?? null : state.activePresetId,
      };
    }),

  toggleFavoritePreset: (presetId) =>
    set((state) => {
      const next = state.presets.map((p) =>
        p.id === presetId ? { ...p, isFavorite: !p.isFavorite } : p
      );
      persistCustomPresetsToLocalStorage(next);
      return { presets: next };
    }),

  renamePreset: (presetId, newName) =>
    set((state) => {
      const clean = newName.trim();
      if (!clean) return state;
      const next = state.presets.map((p) => (p.id === presetId ? { ...p, name: clean } : p));
      persistCustomPresetsToLocalStorage(next);
      return { presets: next };
    }),

  duplicatePreset: (presetId) =>
    set((state) => {
      const src = state.presets.find((p) => p.id === presetId);
      if (!src) return state;
      const copy: StudioPreset = {
        ...src,
        id: `user-preset-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: `${src.name} (Copy)`,
        category: 'User Custom',
        isFactory: false,
        createdAt: Date.now(),
        snapshot: { ...src.snapshot },
      };
      const next = [copy, ...state.presets];
      persistCustomPresetsToLocalStorage(next);
      return { presets: next, activePresetId: copy.id };
    }),

  importPresetsJson: (jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr);
      const list: StudioPreset[] = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object' && Array.isArray(parsed.presets)
        ? parsed.presets
        : [parsed];
      const valid = list.filter(
        (item) => item && typeof item.name === 'string' && item.snapshot
      );
      if (valid.length === 0) return false;
      const sanitized = valid.map((item, idx) => ({
        ...item,
        id: `imported-${Date.now()}-${idx}`,
        isFactory: false,
        createdAt: Date.now(),
      }));
      set((state) => {
        const next = [...sanitized, ...state.presets];
        persistCustomPresetsToLocalStorage(next);
        return { presets: next, activePresetId: sanitized[0].id };
      });
      return true;
    } catch {
      return false;
    }
  },

  // Multi-Image AI 3D Fractalizer Actions
  addMultiImages: (items) =>
    set((state) => {
      const combined = [...state.multiImages, ...items].slice(0, 16);
      const first = combined[0] || null;
      if (state.fractalMode !== 10) {
        transientState.prevFractalMode = state.fractalMode;
        transientState.targetFractalMode = 10;
        transientState.modeMorphProgress = 0.0;
      }
      return {
        fractalMode: 10,
        multiImages: combined,
        userTextureUrl: first ? first.url : state.userTextureUrl,
        userTextureName: first ? first.name : state.userTextureName,
        userTextureAspect: first ? first.aspect : state.userTextureAspect,
        activeImageIndexA: 0,
        activeImageIndexB: combined.length > 1 ? 1 : 0,
      };
    }),

  removeMultiImage: (id) =>
    set((state) => {
      const next = state.multiImages.filter((img) => img.id !== id);
      const first = next[0] || null;
      return {
        multiImages: next,
        userTextureUrl: first ? first.url : null,
        userTextureName: first ? first.name : null,
        userTextureAspect: first ? first.aspect : 1.0,
        activeImageIndexA: 0,
        activeImageIndexB: next.length > 1 ? 1 : 0,
      };
    }),

  moveMultiImage: (id, direction) =>
    set((state) => {
      const idx = state.multiImages.findIndex((img) => img.id === id);
      if (idx === -1) return state;
      const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= state.multiImages.length) return state;
      const next = [...state.multiImages];
      const [moved] = next.splice(idx, 1);
      next.splice(targetIdx, 0, moved);
      const first = next[0] || null;
      return {
        multiImages: next,
        userTextureUrl: first ? first.url : state.userTextureUrl,
        userTextureName: first ? first.name : state.userTextureName,
        userTextureAspect: first ? first.aspect : state.userTextureAspect,
      };
    }),

  triggerNextImageTransition: () =>
    set((state) => {
      const count = Math.max(2, state.multiImages.length);
      const nextA = (state.activeImageIndexA + 1) % count;
      const nextB = (nextA + 1) % count;
      return {
        activeImageIndexA: nextA,
        activeImageIndexB: nextB,
        imageMorphPhase: 0.0,
      };
    }),

  setImageMorphPhase: (imageMorphPhase) =>
    set({ imageMorphPhase: Math.max(0, Math.min(1, imageMorphPhase)) }),

  setImageTransitionTrigger: (imageTransitionTrigger) => set({ imageTransitionTrigger }),
  setImageBlendMethod: (imageBlendMethod) => set({ imageBlendMethod }),
  setImg3DStyle: (img3DStyle) => set({ img3DStyle, fractalMode: 10 }),

  applyAiImageFractalProfile: (profile) => {
    const current = get().fractalMode;
    if (current !== 10) {
      transientState.prevFractalMode = current;
      transientState.targetFractalMode = 10;
      transientState.modeMorphProgress = 0.0;
    }
    set((state) => ({
      fractalMode: 10,
      palette: profile.palette ?? state.palette,
      img3DStyle:
        typeof profile.img3DStyle === 'number'
          ? (Math.max(0, Math.min(3, Math.round(profile.img3DStyle))) as Image3DConversionStyle)
          : state.img3DStyle,
      kifsFoldAngle:
        typeof profile.kifsFoldAngle === 'number' ? profile.kifsFoldAngle : state.kifsFoldAngle,
      bulbPower: typeof profile.bulbPower === 'number' ? profile.bulbPower : state.bulbPower,
      aiImageFractalSummary:
        profile.summary ||
        'AI Vision 3D Fractal DNA synthesized and applied to live WebGL2 engine.',
      imageBlendMethod: profile.imageBlendMethod ?? state.imageBlendMethod,
      imageDepth3D: profile.imageDepth3D ?? state.imageDepth3D,
      imageFractalizeIterations:
        profile.imageFractalizeIterations ?? state.imageFractalizeIterations,
      imageMorphTurbulence: profile.imageMorphTurbulence ?? state.imageMorphTurbulence,
      trapScale: profile.trapScale ?? state.trapScale,
      textureMix: Math.max(0.82, state.textureMix),
    }));
  },

  setFractalMode: (mode: FractalMode) => {
    const current = get().fractalMode;
    if (current !== mode) {
      transientState.prevFractalMode = current;
      transientState.targetFractalMode = mode;
      transientState.modeMorphProgress = 0.0;
    }
    set({ fractalMode: mode, manualMorphOverride: null });
  },

  cycleFractalMode: () => {
    const next = ((get().fractalMode + 1) % 26) as FractalMode;
    get().setFractalMode(next);
  },

  setWorldBiomeMode: (worldBiomeMode: WorldBiomeMode) => {
    const morphMap: Record<WorldBiomeMode, number> = {
      auto: get().worldBiomeMorph,
      mountains: 0.0,
      nature: 1.0,
      'cyber-city': 2.0,
      animals: 3.0,
    };
    set({
      worldBiomeMode,
      worldBiomeMorph: morphMap[worldBiomeMode],
    });
  },

  setZenoSubMode: (zenoSubMode: ZenoSubMode) => {
    if (zenoSubMode === 'dichotomy') {
      set({
        zenoSubMode,
        zenoHalvingRate: 1.35,
        zenoEscherTwist: 0.0,
        zenoArrowParadoxMix: 0.0,
      });
    } else if (zenoSubMode === 'achilles-droste') {
      set({
        zenoSubMode,
        zenoHalvingRate: 0.95,
        zenoEscherTwist: 1.45,
        zenoArrowParadoxMix: 0.0,
      });
    } else if (zenoSubMode === 'frozen-arrow') {
      set({
        zenoSubMode,
        zenoHalvingRate: 0.85,
        zenoEscherTwist: 0.55,
        zenoArrowParadoxMix: 0.85,
        zenoSliceHz: 12.0,
      });
    } else {
      set({
        zenoSubMode: 'all',
        zenoHalvingRate: 0.85,
        zenoEscherTwist: 1.0,
        zenoArrowParadoxMix: 0.35,
        zenoSliceHz: 8.0,
      });
    }
  },

  toggleAutoSwitchModeIncluded: (mode: FractalMode) => {
    const currentMask = [...get().autoSwitchEnabledModes];
    currentMask[mode] = !currentMask[mode];
    if (!currentMask.some(Boolean)) {
      currentMask[mode] = true;
    }
    set({ autoSwitchEnabledModes: currentMask });
  },

  setShaderParam: (key, value) => {
    set({ [key]: value } as Partial<StudioReactiveState>);
  },

  setGpuHeavyMode: (gpuHeavyMode: boolean) => {
    set({
      gpuHeavyMode,
      qualityTier: gpuHeavyMode ? 'ultra' : 'balanced',
    });
  },

  setVideoQuality: (videoQuality: VideoQualityPreset) => {
    const defaultBitrate: ExportBitratePreset =
      videoQuality === '4k' ? 50 : videoQuality === '720p' ? 12 : 25;
    set({
      videoQuality,
      exportResolutionPreset: videoQuality,
      exportBitrateMbps: defaultBitrate,
    });
  },

  setExportVideoFormat: (exportVideoFormat: ExportVideoFormat) => {
    set({ exportVideoFormat });
  },

  setExportRenderBackend: (exportRenderBackend: ExportRenderBackend) => {
    set({ exportRenderBackend });
  },

  setPausePreviewDuringOffload: (pausePreviewDuringOffload: boolean) => {
    set({ pausePreviewDuringOffload });
  },

  setIsPreviewHidden: (isPreviewHidden: boolean) => {
    set({ isPreviewHidden });
  },

  togglePreviewHidden: () => {
    set((state) => ({ isPreviewHidden: !state.isPreviewHidden }));
  },

  setOfflineRenderProgress: (progress: Partial<OfflineRenderProgress>) => {
    set((state) => ({
      offlineRenderProgress: {
        ...state.offlineRenderProgress,
        ...progress,
      },
    }));
  },

  setPalette: (palette) => set({ palette }),

  applyChoreography: (choreo, addToList = false) => {
    const currentMode = get().fractalMode;
    if (currentMode !== choreo.fractalMode) {
      transientState.prevFractalMode = currentMode;
      transientState.targetFractalMode = choreo.fractalMode;
      transientState.modeMorphProgress = 0.0;
    }
    const biomeMode = choreo.worldBiome ?? 'auto';
    const nextTranscendence = choreo.transcendence ?? get().transcendence;
    if (addToList) {
      const updated = [choreo, ...get().choreographies];
      set({
        choreographies: updated,
        activeChoreographyIndex: 0,
        fractalMode: choreo.fractalMode,
        worldBiomeMode: biomeMode,
        transcendence: nextTranscendence,
        palette: choreo.palette,
        bulbPower: choreo.bulbPower,
        kleinianScale: choreo.kleinianScale,
        foldLimit: choreo.foldLimit,
        bloomIntensity: choreo.bloomIntensity,
        chromaticAberration: choreo.chromaticAberration,
        cameraSpeed: choreo.cameraSpeed,
        chaosMode: choreo.chaosMode,
      });
    } else {
      set({
        fractalMode: choreo.fractalMode,
        worldBiomeMode: biomeMode,
        transcendence: nextTranscendence,
        palette: choreo.palette,
        bulbPower: choreo.bulbPower,
        kleinianScale: choreo.kleinianScale,
        foldLimit: choreo.foldLimit,
        bloomIntensity: choreo.bloomIntensity,
        chromaticAberration: choreo.chromaticAberration,
        cameraSpeed: choreo.cameraSpeed,
        chaosMode: choreo.chaosMode,
      });
    }
  },

  selectChoreographyIndex: (index) => {
    const list = get().choreographies;
    const target = list[index];
    if (!target) return;
    set({ activeChoreographyIndex: index });
    get().applyChoreography(target, false);
  },

  setUserTexture: (url, name, aspect) => {
    set((state) => {
      if (!url) {
        return {
          userTextureUrl: null,
          userTextureName: null,
          userTextureAspect: 1.0,
          multiImages: [],
        };
      }
      const item: MultiImageItem = {
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: name || 'Uploaded Image',
        url,
        aspect: aspect || 1.0,
      };
      const existing = state.multiImages.filter((m) => m.url !== url);
      return {
        userTextureUrl: url,
        userTextureName: name,
        userTextureAspect: aspect || 1.0,
        multiImages: [item, ...existing].slice(0, 16),
      };
    });
  },

  setAudioStatus: (playing, trackName, sourceType) => {
    transientState.isPlaying = playing;
    set((state) => ({
      isPlaying: playing,
      audioTrackName: trackName ?? state.audioTrackName,
      audioSourceType: sourceType ?? state.audioSourceType,
    }));
  },

  setAcousticSummary: (summary) => set({ acousticSummary: summary }),

  setAspectRatio: (aspectRatio) => set({ aspectRatio }),

  setQualityTier: (qualityTier) => set({ qualityTier }),

  setViewMode: (viewMode: HudViewMode) =>
    set({
      viewMode,
      zenMode: viewMode === 'zen-fullscreen',
      showXyPads: viewMode === 'studio' ? get().showXyPads : false,
    }),

  cycleViewMode: () => {
    const curr = get().viewMode;
    const next: HudViewMode =
      curr === 'studio'
        ? 'clean-player'
        : curr === 'clean-player'
        ? 'zen-fullscreen'
        : 'studio';
    get().setViewMode(next);
  },

  toggleCleanPlayerMode: () => {
    const curr = get().viewMode;
    const next: HudViewMode = curr === 'studio' ? 'clean-player' : 'studio';
    get().setViewMode(next);
  },

  setZenMode: (zenMode) =>
    set({
      zenMode,
      viewMode: zenMode ? 'zen-fullscreen' : 'studio',
    }),

  setShowXyPads: (showXyPads) =>
    set({
      showXyPads,
    }),

  setActiveDrawer: (drawer) =>
    set((state) => ({
      activeDrawer: state.activeDrawer === drawer ? 'none' : drawer,
      activeInspectorTab:
        drawer === 'none'
          ? state.activeInspectorTab
          : drawer === 'shader'
          ? 'modes'
          : drawer === 'texture'
          ? 'image'
          : (drawer as StudioInspectorTab),
    })),

  setActiveInspectorTab: (tab) =>
    set({
      activeInspectorTab: tab,
      controlComplexityMode: 'advanced',
      showXyPads: tab === 'xypads' ? true : get().showXyPads,
    }),

  triggerBeatBang: () => {
    transientState.isBeatBang = true;
    transientState.manualBeatFlash = 1.0;
    transientState.kickTransient = 1.0;
    transientState.snareTransient = 1.0;
    transientState.hiHatSparkle = 1.25;
    transientState.fractalSpike = 2.6;
    transientState.audioIntensity = 1.35;
    transientState.mirrorPhase = (transientState.mirrorPhase + 1) % 4;
    set({ glitchActive: true });
    setTimeout(() => {
      transientState.isBeatBang = false;
      set({ glitchActive: false });
    }, 380);
  },

  randomizeDna: () => {
    const rand = (min: number, max: number) =>
      Number((min + Math.random() * (max - min)).toFixed(2));
    const randomPreset =
      COSINE_PALETTE_PRESETS[Math.floor(Math.random() * COSINE_PALETTE_PRESETS.length)];
    transientState.xyPad1 = [rand(-0.85, 0.85), rand(-0.85, 0.85)];
    transientState.xyPad2 = [rand(0.2, 0.9), rand(0.25, 0.85)];
    set({
      polychoraType: Math.floor(Math.random() * 6) as PolychoraType,
      rot4dXW: rand(-1.8, 1.8),
      rot4dYW: rand(-1.8, 1.8),
      rot4dZW: rand(-1.8, 1.8),
      wCameraDist: rand(1.75, 2.85),
      transcendence: rand(0.05, 0.85),
      bulbPower: rand(6.0, 12.5),
      kleinianScale: rand(1.28, 1.64),
      foldLimit: rand(0.82, 1.35),
      tunnelCurvature: rand(0.4, 1.75),
      creatureSpeed: rand(0.75, 2.4),
      palette: randomPreset.palette,
    });
  },

  aiPsychedelicMutate: () => {
    const rand = (min: number, max: number) =>
      Number((min + Math.random() * (max - min)).toFixed(2));
    const currentMode = get().fractalMode;
    const candidateModes: FractalMode[] = [
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
    ];
    const nextMode =
      candidateModes[(currentMode + 1 + Math.floor(Math.random() * 7)) % candidateModes.length];
    const biomes: WorldBiomeMode[] = ['auto', 'mountains', 'nature', 'cyber-city', 'animals'];
    const nextBiome = biomes[Math.floor(Math.random() * biomes.length)];
    const randomPalette =
      COSINE_PALETTE_PRESETS[Math.floor(Math.random() * COSINE_PALETTE_PRESETS.length)].palette;

    transientState.prevFractalMode = currentMode;
    transientState.targetFractalMode = nextMode;
    transientState.modeMorphProgress = 0.0;
    transientState.kickTransient = 0.95;
    transientState.fractalSpike = 2.1;
    transientState.xyPad1 = [rand(-0.75, 0.75), rand(-0.75, 0.75)];

    const kaleidoChoices = [1, 4, 6, 8, 12, 16];
    const nextKaleido =
      nextMode === 1
        ? kaleidoChoices[1 + Math.floor(Math.random() * (kaleidoChoices.length - 1))]
        : kaleidoChoices[Math.floor(Math.random() * 3)];

    set({
      fractalMode: nextMode,
      polychoraType: Math.floor(Math.random() * 6) as PolychoraType,
      worldBiomeMode: nextBiome,
      worldBiomeMorph:
        nextBiome === 'mountains'
          ? 0
          : nextBiome === 'nature'
          ? 1
          : nextBiome === 'cyber-city'
          ? 2
          : 3,
      transcendence: rand(0.15, 0.88),
      palette: randomPalette,
      rot4dXW: rand(-2.1, 2.1),
      rot4dYW: rand(-2.1, 2.1),
      rot4dZW: rand(-2.1, 2.1),
      kaleidoSlices: nextKaleido,
      chaosMode: Math.random() > 0.35,
      bloomIntensity: rand(1.3, 1.95),
      fbmWarpStrength: rand(0.25, 0.85),
    });
  },

  resetCamera: () => {
    transientState.cameraOrbitX = 0;
    transientState.cameraOrbitY = 0;
    transientState.cameraRollZ = 0;
    transientState.cameraLateralX = 0;
    transientState.cameraLateralY = 0;
    transientState.cameraZoomSpeed = 1.0;
    set({
      cameraFov: 1.25,
      cameraSpeed: 1.2,
      rot4dXW: 0.65,
      rot4dYW: 0.48,
      rot4dZW: 0.32,
      wCameraDist: 2.25,
      transcendence: 0.18,
      zoomDirectionMode: 'inward',
      zenoReverseDirection: false,
    });
  },

  toggleAbLoop: () => {
    const { loopA, loopB, abLoopActive, trackDuration } = get();
    const nowSec = Number(Math.max(0, transientState.currentTime).toFixed(2));
    const maxDur = Math.max(10, trackDuration || 180);

    if (loopA === null) {
      set({ loopA: nowSec, loopB: null, abLoopActive: false });
    } else if (loopB === null && !abLoopActive) {
      const endSec = nowSec > loopA + 1.0 ? nowSec : Math.min(maxDur, loopA + 8.0);
      set({ loopB: Number(endSec.toFixed(2)), abLoopActive: true });
    } else {
      set({ loopA: null, loopB: null, abLoopActive: false });
    }
  },

  clearAbLoop: () => set({ loopA: null, loopB: null, abLoopActive: false }),

  setRecordingState: (recording, seconds = 0, mimeType = 'video/mp4') =>
    set({
      isRecording: recording,
      recordingSeconds: seconds,
      recordingMimeType: mimeType,
    }),

  setLastExport: (url, filename, blobSize = 0) =>
    set({
      lastExportUrl: url,
      lastExportFilename: filename,
      lastExportBlobSize: blobSize,
      exportCompleteModalOpen: Boolean(url && filename),
    }),

  setExportCompleteModalOpen: (open) =>
    set({
      exportCompleteModalOpen: open,
    }),

  selectSongSectionForExport: (mode, startSec, endSec) =>
    set({
      exportDurationMode: mode,
      customExportStartSec: Number(Math.max(0, startSec).toFixed(2)),
      customExportEndSec: Number(Math.max(startSec + 1, endSec).toFixed(2)),
    }),

  recordRenderedSectionOutput: (record) =>
    set((state) => {
      const filtered = state.renderedSectionsHistory.filter((r) => r.modeId !== record.modeId);
      return {
        renderedSectionsHistory: [record, ...filtered].slice(0, 12),
      };
    }),
}));
