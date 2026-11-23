export type FractalMode =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23
  | 24
  | 25;

export type ModeCategoryFilter =
  | 'All (26)'
  | 'Fractals & 4D'
  | 'Surreal & Visionary'
  | 'Cosmic & Physics'
  | 'Organic & Liquid'
  | 'Audio & Optical';

// Mode 25: Divine Creation — 6-Stage Creation Progression
// 0 = Auto-Evolve across all 6 stages over song timeline
// 1 = Stage 1: Fiat Lux & Vesica Piscis
// 2 = Stage 2: Seed & Flower of Life
// 3 = Stage 3: Fruit of Life & Metatron's Cube
// 4 = Stage 4: All 5 Platonic Solids & Platonic-Solid IFS
// 5 = Stage 5: Counter-Rotating 3D Merkaba & Sri Yantra Halo
// 6 = Stage 6: Living Golden-Ratio Cosmos (Golden Spirals & 137.5° Phyllotaxis)
export type DivineCreationStage = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type ControlComplexityMode = 'simple' | 'advanced';

export type ZoomDirectionMode = 'inward' | 'outward' | 'pendulum';

export type MultiImageTransitionTrigger = 'smooth-time' | 'bass-drops' | 'every-n-bars' | 'manual';

export type MultiImageBlendMethod = 'liquid-fbm' | 'crystal-shatter' | 'droste-nest' | 'kaleido-trap';

export type Image3DConversionStyle = 0 | 1 | 2 | 3;

export interface MultiImageItem {
  id: string;
  name: string;
  url: string;
  aspect: number;
  isBuiltin?: boolean;
}

export interface ImageFractalProfile {
  summary: string;
  palette: CosinePalette;
  img3DStyle?: Image3DConversionStyle;
  kifsFoldAngle?: number;
  bulbPower?: number;
  imageDepth3D: number;
  imageFractalizeIterations: number;
  imageMorphTurbulence: number;
  trapScale: number;
  imageBlendMethod: MultiImageBlendMethod;
}

export type WorldBiomeMode = 'auto' | 'mountains' | 'nature' | 'cyber-city' | 'animals';

export type PolychoraType = 0 | 1 | 2 | 3 | 4 | 5;

export type AutoSwitchTriggerMode = 'song-sections' | 'every-n-bars' | 'ai-storyboard';

export type ZenoSubMode = 'all' | 'dichotomy' | 'achilles-droste' | 'frozen-arrow';

export type CollageJoinMode = 0 | 1 | 2 | 3;

export type HudViewMode = 'studio' | 'clean-player' | 'zen-fullscreen';

export interface CosinePalette {
  a: [number, number, number];
  b: [number, number, number];
  c: [number, number, number];
  d: [number, number, number];
}

export interface CosinePalettePreset {
  id: string;
  name: string;
  badge?: string;
  palette: CosinePalette;
}

export interface TimelineKeyframe {
  section: 'Intro' | 'Buildup' | 'Drop' | 'Breakdown' | 'Outro';
  startTimeRatio: number; // 0.0 to 1.0
  fractalMode: FractalMode;
  worldBiome?: WorldBiomeMode;
  transcendence?: number;
  speedMultiplier: number;
  bloomIntensity: number;
  bulbPower: number;
  kleinianScale: number;
  foldLimit: number;
  rot4dSpeed?: number;
  chaosMode: boolean;
  description: string;
}

export interface VisualChoreography {
  name: string;
  vibeDescription: string;
  palette: CosinePalette;
  fractalMode: FractalMode;
  worldBiome?: WorldBiomeMode;
  transcendence?: number;
  bulbPower: number;
  kleinianScale: number;
  foldLimit: number;
  bloomIntensity: number;
  chromaticAberration: number;
  cameraSpeed: number;
  chaosMode: boolean;
  timelineKeyframes: TimelineKeyframe[];
}

export interface FrequencyBands {
  subBass: number;    // 20 - 60 Hz
  bass: number;       // 60 - 250 Hz
  lowMid: number;     // 250 - 500 Hz
  mid: number;        // 500 - 2000 Hz
  upperMid: number;   // 2000 - 4000 Hz
  presence: number;   // 4000 - 6000 Hz
  brilliance: number; // 6000 - 20000 Hz
}

export interface AcousticSummary {
  trackName: string;
  durationSeconds: number;
  meanRms: number;
  peakRms: number;
  spectralCentroidHz: number;
  bassToMidRatio: number;
  subBassEnergy: number;
  highFreqBrilliance: number;
  dynamicRangeDb: number;
  estimatedBpm: number;
  dominantKey: string;
  dominantPitchHue: number;
  transientDensity: number;
  featureVector28D: number[];
}

export type QualityTier = 'performance' | 'balanced' | 'ultra';

export type AspectRatioMode = '16:9' | '9:16' | '1:1';

export type ExportResolutionPreset = '4k' | '1440p' | '1080p' | '720p';

export type VideoQualityPreset = '720p' | '1080p' | '1440p' | '4k';

export type ExportVideoFormat = 'mp4-h264' | 'webm-vp9' | 'webm-vp8' | 'mov-h264';

export type ExportRenderBackend = 'offline-deterministic' | 'offloaded-rVFC' | 'live-screen';

export type ExportFpsPreset = 30 | 60;

export type ExportBitratePreset = 12 | 25 | 50;

export type SubFrameMotionBlur = 1 | 2 | 4;

export type TextureMappingMode =
  | 'center-emblem'
  | 'zeno-droste'
  | 'orbit-trap'
  | 'triplanar'
  | 'both';

export type SpectrumBarCount = 32 | 64 | 128;

export type PreviewResolutionCap = '1080p' | '720p';

export type RenderScaleMode = 'auto-60fps' | '0.5' | '0.75' | '1.0';

export type ExportDurationMode =
  | 'full-song'
  | 'section-intro'
  | 'section-buildup'
  | 'section-drop'
  | 'section-breakdown'
  | 'section-outro'
  | 'ab-loop'
  | 'custom-range'
  | '15s-clip'
  | '15s'
  | '30s'
  | '60s'
  | '5s-test';

export interface SongSectionTimeRange {
  section: TimelineKeyframe['section'];
  modeId:
    | 'section-intro'
    | 'section-buildup'
    | 'section-drop'
    | 'section-breakdown'
    | 'section-outro';
  index: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  startTimeRatio: number;
  endTimeRatio: number;
  fractalMode: FractalMode;
  description: string;
}

export interface ResolvedExportSegment {
  mode: ExportDurationMode;
  label: string;
  shortTag: string;
  sectionName: TimelineKeyframe['section'] | null;
  startSec: number;
  endSec: number;
  durationSec: number;
}

export interface RenderedSectionOutput {
  modeId: ExportDurationMode;
  label: string;
  url: string;
  filename: string;
  blobSize: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  completedAt: number;
}

export type StudioInspectorTab =
  | 'modes'
  | 'geometry'
  | 'audio'
  | 'fx'
  | 'image'
  | 'export'
  | 'xypads';

export type PresetVaultCategory =
  | 'Divine & Sacred'
  | 'High-Clarity 3D'
  | '4D & Trippy'
  | 'Bass & EDM'
  | 'Worlds'
  | 'Zeno'
  | 'Image 3D'
  | '4D & Psychedelic'
  | 'Zeno & Infinite'
  | 'Bass & Trap'
  | 'World Genesis'
  | 'Multi-Image 3D'
  | 'User Custom';

export interface StudioPresetSnapshot {
  fractalMode: FractalMode;
  autoChoreographyEnabled: boolean;
  zoomDirectionMode: ZoomDirectionMode;
  palette: CosinePalette;
  clarity?: number;
  img3DStyle?: Image3DConversionStyle;
  reactivityGain: number;
  cameraSpeed: number;
  cameraShakeIntensity: number;
  kaleidoSlices: number;
  feedbackTrailLength: number;
  bloomIntensity: number;
  cloudDensity: number;
  textureMix: number;
  imageDepth3D: number;
  imageFractalizeIterations: number;
  imageMorphTurbulence: number;
  imageBlendMethod: MultiImageBlendMethod;
  polychoraType: PolychoraType;
  rot4dXW: number;
  rot4dYW: number;
  rot4dZW: number;
  wCameraDist: number;
  zenoSpeed: number;
  zenoHalvingRate: number;
  zenoEscherTwist: number;
  zenoArrowParadoxMix: number;
  zenoSliceHz: number;
  worldBiomeMode: WorldBiomeMode;
  transcendence: number;
  bulbPower: number;
  kleinianScale: number;
  foldLimit: number;
  emblemSize: number;
  spectrumBarCount: SpectrumBarCount;
  chaosMode: boolean;
  pitchSynesthesiaEnabled: boolean;
  // Mode 25 & Global Divine Creation Light Sculptor
  divineCreationStage?: DivineCreationStage;
  divineGodRaysEnabled?: boolean;
  divineGodRayIntensity?: number;
  godRayDensity?: number;
  godRayWeight?: number;
  godRayDecay?: number;
  godRayExposure?: number;
  sacredHaloEnabled?: boolean;
  sacredFiligreeMix?: number;
  aiManifestCreationArcEnabled?: boolean;
}

export interface StudioPreset {
  id: string;
  name: string;
  category: PresetVaultCategory;
  description: string;
  isFactory: boolean;
  isFavorite: boolean;
  createdAt: number;
  thumbnailDataUrl?: string;
  snapshot: StudioPresetSnapshot;
}

export interface OfflineRenderProgress {
  active: boolean;
  phase:
    | 'idle'
    | 'analyzing-audio'
    | 'rendering-frames'
    | 'muxing'
    | 'complete'
    | 'cancelled'
    | 'error';
  currentFrame: number;
  totalFrames: number;
  percent: number;
  etaSeconds: number;
  fpsSpeed: number;
  statusLabel: string;
  encoderName: string;
}

export interface PrecomputedAudioFrame {
  frameIndex: number;
  timeSec: number;
  dynamicTime: number;
  bands: FrequencyBands;
  bassCumulative: number;
  midCumulative: number;
  juiceBounce: number;
  rmsEnergy: number;
  audioIntensity: number;
  fractalSpike: number;
  kickTransient: number;
  snareTransient: number;
  hiHatSparkle: number;
  bpmPhase: number;
  mirrorPhase: number;
  pitchHue: number;
}

export interface TransientAudioGestureState {
  // 7 Smoothed Perceptual Frequency Bands
  bands: FrequencyBands;
  // Cumulative & Derived DSP Signals
  bassCumulative: number;
  midCumulative: number;
  juiceBounce: number;
  rmsEnergy: number;
  // Silence-to-Peak Dynamic Reactivity & Fractal Spike Signals
  audioIntensity: number; // 0.0 (dead silent/still) -> 1.0+ (intense music)
  fractalSpike: number;   // 0.0 (smooth in silence) -> 3.0 (razor-sharp fractal spikes on drops/transients)
  dynamicTime: number;    // Audio-gated shader clock (near-still in silence, fast on drops)
  // Beat, Kick/Snare/Hi-Hat & BPM Phase Lock
  kickTransient: number;  // Decaying 400ms spike (0..1) -> triggers 3D beat shockwave ring
  snareTransient: number; // Decaying phase/mirror spike (0..1)
  hiHatSparkle: number;   // High-frequency brilliance Voronoi/FBM ripple envelope (0..1)
  bpmPhase: number;       // 0.0 to 1.0 continuous sawtooth phase locked to track BPM
  mirrorPhase: number;    // Flips/shifts on snare hits
  estimatedBpm: number;
  isBeatBang: boolean;
  manualBeatFlash: number;
  // 12-Tone Pitch-to-Color Synesthesia
  dominantFreqHz: number;
  dominantNote: string;
  pitchHue: number;       // 0.0 to 1.0 (0°=C Red, 120°=E Green, 240°=G# Blue)
  // Multi-Touch & Gesture Camera State
  cameraOrbitX: number;
  cameraOrbitY: number;
  cameraRollZ: number;
  cameraLateralX: number;
  cameraLateralY: number;
  cameraZoomSpeed: number;
  // Gyroscope tilt
  gyroTiltX: number;
  gyroTiltY: number;
  // Dual Interactive Touch XY Pads
  xyPad1: [number, number]; // Geometry & 4D Slice / Julia Constant (c.x, c.y) in [-1.0, 1.0]
  xyPad2: [number, number]; // [Psychedelic Kaleido/Transcendence (0..1), Texture Mix (0..1)]
  // Cross-fading morph state between fractal modes
  prevFractalMode: number;
  targetFractalMode: number;
  modeMorphProgress: number; // 0.0 -> 1.0 smooth transition
  // Playback progress
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}
