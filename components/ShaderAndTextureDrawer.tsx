'use client';

import React, { useRef, useState } from 'react';
import {
  Image as ImageIcon,
  Cpu,
  Trash2,
  Activity,
  Zap,
  Sparkles,
  Palette,
  Layers,
  Globe,
  Box,
  Shuffle,
  RotateCcw,
  Infinity as InfinityIcon,
  Lock,
  Unlock,
  Music,
  Upload,
  Sliders,
  Bookmark,
  Star,
  Copy,
  Download,
  ArrowUp,
  ArrowDown,
  Wand2,
} from 'lucide-react';
import { useStudioStore } from '@/lib/store';
import { audioEngine } from '@/lib/audio-engine';
import {
  AutoSwitchTriggerMode,
  CollageJoinMode,
  FractalMode,
  Image3DConversionStyle,
  ImageFractalProfile,
  ModeCategoryFilter,
  MultiImageBlendMethod,
  MultiImageItem,
  MultiImageTransitionTrigger,
  PolychoraType,
  QualityTier,
  SpectrumBarCount,
  TextureMappingMode,
  WorldBiomeMode,
  ZenoSubMode,
} from '@/lib/types';
import { evaluateCosinePalette, formatTimestamp } from '@/lib/dsp-math';
import {
  COLLAGE_JOIN_PRESETS,
  COSINE_PALETTE_PRESETS,
  FRACTAL_MODE_INFO,
  POLYCHORA_PRESETS,
  SETTING_TOOLTIPS,
  WORLD_BIOME_PRESETS,
} from '@/lib/presets';
import DualXyPads from './DualXyPads';
import SettingTooltip from './SettingTooltip';
import { captureCanvasThumbnailDataUrl } from './FractalCanvas';

export default function ShaderAndTextureDrawer() {
  const activeInspectorTab = useStudioStore((s) => s.activeInspectorTab);
  const setActiveInspectorTab = useStudioStore((s) => s.setActiveInspectorTab);

  // Tab 1 (modes): 25 Visualizer Modes, Master Mode Switcher & AI Procedural World Biomes
  const fractalMode = useStudioStore((s) => s.fractalMode);
  const setFractalMode = useStudioStore((s) => s.setFractalMode);
  const autoChoreographyEnabled = useStudioStore((s) => s.autoChoreographyEnabled);
  const autoSwitchTriggerMode = useStudioStore((s) => s.autoSwitchTriggerMode);
  const autoSwitchBars = useStudioStore((s) => s.autoSwitchBars);
  const transitionMorphSeconds = useStudioStore((s) => s.transitionMorphSeconds);
  const autoSwitchEnabledModes = useStudioStore((s) => s.autoSwitchEnabledModes);
  const toggleAutoSwitchModeIncluded = useStudioStore((s) => s.toggleAutoSwitchModeIncluded);
  const manualMorphOverride = useStudioStore((s) => s.manualMorphOverride);
  const worldBiomeMode = useStudioStore((s) => s.worldBiomeMode);
  const setWorldBiomeMode = useStudioStore((s) => s.setWorldBiomeMode);
  const worldBiomeMorph = useStudioStore((s) => s.worldBiomeMorph);
  const transcendence = useStudioStore((s) => s.transcendence);
  const collageJoinMode = useStudioStore((s) => s.collageJoinMode);
  const aiPsychedelicMutate = useStudioStore((s) => s.aiPsychedelicMutate);
  const randomizeDna = useStudioStore((s) => s.randomizeDna);
  const resetCamera = useStudioStore((s) => s.resetCamera);

  // Tab 2 (geometry): Context-Aware Scene Controls + 4D Hyperspace + Zeno's Paradox
  const polychoraType = useStudioStore((s) => s.polychoraType);
  const zenoSubMode = useStudioStore((s) => s.zenoSubMode);
  const setZenoSubMode = useStudioStore((s) => s.setZenoSubMode);
  const zenoReverseDirection = useStudioStore((s) => s.zenoReverseDirection);
  const rot4dXW = useStudioStore((s) => s.rot4dXW);
  const rot4dYW = useStudioStore((s) => s.rot4dYW);
  const rot4dZW = useStudioStore((s) => s.rot4dZW);
  const wCameraDist = useStudioStore((s) => s.wCameraDist);
  const zenoSpeed = useStudioStore((s) => s.zenoSpeed);
  const zenoHalvingRate = useStudioStore((s) => s.zenoHalvingRate);
  const zenoEscherTwist = useStudioStore((s) => s.zenoEscherTwist);
  const zenoArrowParadoxMix = useStudioStore((s) => s.zenoArrowParadoxMix);
  const zenoSliceHz = useStudioStore((s) => s.zenoSliceHz);
  const creatureSpeed = useStudioStore((s) => s.creatureSpeed);
  const iterationDetail = useStudioStore((s) => s.iterationDetail);
  const bulbPower = useStudioStore((s) => s.bulbPower);
  const kleinianScale = useStudioStore((s) => s.kleinianScale);
  const foldLimit = useStudioStore((s) => s.foldLimit);
  const tunnelScale = useStudioStore((s) => s.tunnelScale);
  const tunnelCurvature = useStudioStore((s) => s.tunnelCurvature);
  const cameraSpeed = useStudioStore((s) => s.cameraSpeed);
  const cameraFov = useStudioStore((s) => s.cameraFov);
  const qualityTier = useStudioStore((s) => s.qualityTier);
  const gpuHeavyMode = useStudioStore((s) => s.gpuHeavyMode);
  const setGpuHeavyMode = useStudioStore((s) => s.setGpuHeavyMode);
  const shaderCompileStatus = useStudioStore((s) => s.shaderCompileStatus);

  // Tab 3 (audio): Bass & Reactivity
  const reactivityGain = useStudioStore((s) => s.reactivityGain);
  const peakExponent = useStudioStore((s) => s.peakExponent);
  const bounceIntensity = useStudioStore((s) => s.bounceIntensity);
  const spikeSensitivity = useStudioStore((s) => s.spikeSensitivity);
  const cameraShakeIntensity = useStudioStore((s) => s.cameraShakeIntensity);
  const subBassKickGain = useStudioStore((s) => s.subBassKickGain);
  const bassMorphGain = useStudioStore((s) => s.bassMorphGain);
  const lowMidGain = useStudioStore((s) => s.lowMidGain);
  const midTwistGain = useStudioStore((s) => s.midTwistGain);
  const upperMidGain = useStudioStore((s) => s.upperMidGain);
  const trebleSparkleGain = useStudioStore((s) => s.trebleSparkleGain);
  const brillianceGain = useStudioStore((s) => s.brillianceGain);
  const beatShockwaveEnabled = useStudioStore((s) => s.beatShockwaveEnabled);
  const snareKaleidoJumpEnabled = useStudioStore((s) => s.snareKaleidoJumpEnabled);
  const pitchSynesthesiaEnabled = useStudioStore((s) => s.pitchSynesthesiaEnabled);
  const bpmCameraSurgeEnabled = useStudioStore((s) => s.bpmCameraSurgeEnabled);

  // Tab 4 (fx): High-Clarity Grading, Psychedelic FX & 24 Cosine Palettes
  const clarity = useStudioStore((s) => s.clarity);
  const palette = useStudioStore((s) => s.palette);
  const metaBrightness = useStudioStore((s) => s.metaBrightness);
  const metaContrast = useStudioStore((s) => s.metaContrast);
  const metaGamma = useStudioStore((s) => s.metaGamma);
  const metaSaturation = useStudioStore((s) => s.metaSaturation);
  const metaHueSpeed = useStudioStore((s) => s.metaHueSpeed);
  const colorInvert = useStudioStore((s) => s.colorInvert);
  const kaleidoSlices = useStudioStore((s) => s.kaleidoSlices);
  const mirrorX = useStudioStore((s) => s.mirrorX);
  const mirrorY = useStudioStore((s) => s.mirrorY);
  const fbmWarpStrength = useStudioStore((s) => s.fbmWarpStrength);
  const feedbackTrailLength = useStudioStore((s) => s.feedbackTrailLength);
  const cloudDensity = useStudioStore((s) => s.cloudDensity);
  const bloomIntensity = useStudioStore((s) => s.bloomIntensity);
  const chromaticAberration = useStudioStore((s) => s.chromaticAberration);
  const vignetteDarkness = useStudioStore((s) => s.vignetteDarkness);
  const filmGrain = useStudioStore((s) => s.filmGrain);
  const glitchActive = useStudioStore((s) => s.glitchActive);
  const chaosMode = useStudioStore((s) => s.chaosMode);

  // Tab 5 (image): Media, Audio Track Manager & Custom Image / Bass Emblem Studio
  const audioTrackName = useStudioStore((s) => s.audioTrackName);
  const audioSourceType = useStudioStore((s) => s.audioSourceType);
  const trackDuration = useStudioStore((s) => s.trackDuration);
  const acousticSummary = useStudioStore((s) => s.acousticSummary);
  const userTextureName = useStudioStore((s) => s.userTextureName);
  const textureMappingMode = useStudioStore((s) => s.textureMappingMode);
  const emblemSize = useStudioStore((s) => s.emblemSize);
  const spectrumBarCount = useStudioStore((s) => s.spectrumBarCount);
  const textureMix = useStudioStore((s) => s.textureMix);
  const textureScale = useStudioStore((s) => s.textureScale);
  const trapScale = useStudioStore((s) => s.trapScale);
  const imageSpinSpeed = useStudioStore((s) => s.imageSpinSpeed);
  const imageBeatPulse = useStudioStore((s) => s.imageBeatPulse);

  const setShaderParam = useStudioStore((s) => s.setShaderParam);
  const setQualityTier = useStudioStore((s) => s.setQualityTier);
  const setUserTexture = useStudioStore((s) => s.setUserTexture);
  const setPalette = useStudioStore((s) => s.setPalette);
  const triggerBeatBang = useStudioStore((s) => s.triggerBeatBang);

  // Preset Manager state
  const presets = useStudioStore((s) => s.presets);
  const activePresetId = useStudioStore((s) => s.activePresetId);
  const saveNewPreset = useStudioStore((s) => s.saveNewPreset);
  const loadPreset = useStudioStore((s) => s.loadPreset);
  const deletePreset = useStudioStore((s) => s.deletePreset);
  const toggleFavoritePreset = useStudioStore((s) => s.toggleFavoritePreset);
  const duplicatePreset = useStudioStore((s) => s.duplicatePreset);
  const importPresetsJson = useStudioStore((s) => s.importPresetsJson);

  // Multi-Image AI 3D Fractalizer state
  const multiImages = useStudioStore((s) => s.multiImages);
  const activeImageIndexA = useStudioStore((s) => s.activeImageIndexA);
  const activeImageIndexB = useStudioStore((s) => s.activeImageIndexB);
  const imageMorphPhase = useStudioStore((s) => s.imageMorphPhase);
  const imageTransitionTrigger = useStudioStore((s) => s.imageTransitionTrigger);
  const imageBlendMethod = useStudioStore((s) => s.imageBlendMethod);
  const img3DStyle = useStudioStore((s) => s.img3DStyle);
  const kifsFoldAngle = useStudioStore((s) => s.kifsFoldAngle);
  const aiImageFractalSummary = useStudioStore((s) => s.aiImageFractalSummary);
  const imageDepth3D = useStudioStore((s) => s.imageDepth3D);
  const imageFractalizeIterations = useStudioStore((s) => s.imageFractalizeIterations);
  const imageMorphTurbulence = useStudioStore((s) => s.imageMorphTurbulence);
  const addMultiImages = useStudioStore((s) => s.addMultiImages);
  const removeMultiImage = useStudioStore((s) => s.removeMultiImage);
  const moveMultiImage = useStudioStore((s) => s.moveMultiImage);
  const triggerNextImageTransition = useStudioStore((s) => s.triggerNextImageTransition);
  const setImg3DStyle = useStudioStore((s) => s.setImg3DStyle);
  const applyAiImageFractalProfile = useStudioStore((s) => s.applyAiImageFractalProfile);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const multiImageInputRef = useRef<HTMLInputElement>(null);
  const presetJsonInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [newPresetName, setNewPresetName] = useState('');
  const [presetCategoryFilter, setPresetCategoryFilter] = useState<string>('All');
  const [modeCategoryFilter, setModeCategoryFilter] = useState<ModeCategoryFilter>('All (26)');
  const [isAiFractalizing, setIsAiFractalizing] = useState(false);
  const [reimagineSeed, setReimagineSeed] = useState(1);

  const runAiImageTo3DConversion = async (
    names: string[],
    dataUrls: string[],
    seed = reimagineSeed
  ) => {
    setIsAiFractalizing(true);
    try {
      const res = await fetch('/api/ai-fractalize-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageNames: names,
          imageDataUrls: dataUrls.slice(0, 3),
          variationSeed: seed,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const profile = (data.profile ?? data) as ImageFractalProfile;
        applyAiImageFractalProfile(profile);
      }
    } finally {
      setIsAiFractalizing(false);
    }
  };

  if (
    activeInspectorTab !== 'modes' &&
    activeInspectorTab !== 'geometry' &&
    activeInspectorTab !== 'audio' &&
    activeInspectorTab !== 'fx' &&
    activeInspectorTab !== 'image'
  ) {
    return null;
  }

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await audioEngine.loadAudioFile(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const rawUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const aspect = img.naturalWidth / Math.max(1, img.naturalHeight);
      const maxDim = 1024;
      const targetW = Math.min(
        maxDim,
        Math.pow(2, Math.round(Math.log2(Math.max(64, img.naturalWidth))))
      );
      const targetH = Math.min(
        maxDim,
        Math.pow(2, Math.round(Math.log2(Math.max(64, img.naturalHeight))))
      );
      const offscreen = document.createElement('canvas');
      offscreen.width = targetW;
      offscreen.height = targetH;
      const ctx = offscreen.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const optimizedUrl = offscreen.toDataURL('image/png');
        URL.revokeObjectURL(rawUrl);
        setUserTexture(optimizedUrl, file.name, aspect);
      } else {
        setUserTexture(rawUrl, file.name, aspect);
      }
    };
    img.src = rawUrl;
  };

  const stops = [0.0, 0.25, 0.5, 0.75, 1.0].map((t) => {
    const [r, g, b] = evaluateCosinePalette(t, palette);
    return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
  });
  const gradientCss = `linear-gradient(90deg, ${stops.join(', ')})`;

  const activeModeInfo = FRACTAL_MODE_INFO[fractalMode] ?? FRACTAL_MODE_INFO[0];

  return (
    <div
      data-hud-interactive="true"
      aria-label="Pro VJ Studio Inspector Controls"
      className="space-y-3.5 text-zinc-100"
    >
      {/* ========================================================================== */}
      {/* TAB 1 (modes): [MODES & SONG FLOW]                                         */}
      {/* ========================================================================== */}
      {activeInspectorTab === 'modes' && (
        <div data-testid="inspector-tab-modes" className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-amber-400" />
              Modes &amp; Song Flow (26 WebGL2 Engines)
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Choose whether to lock a single visualizer mode for your entire video or automatically transition across song sections.
            </p>
          </div>

          {/* PROMINENT MASTER MODE SWITCHER BAR: LOCK SINGLE MODE vs AUTO-SWITCH SONG SECTIONS */}
          <div
            data-testid="master-playback-mode-switcher"
            className="bg-zinc-900/95 border-2 border-amber-400/50 rounded-xl p-3 space-y-2.5 shadow-lg"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white uppercase tracking-wider">
                Master Playback &amp; Video Export Mode
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  !autoChoreographyEnabled
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                    : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                }`}
              >
                {!autoChoreographyEnabled ? 'SINGLE MODE LOCKED' : 'AUTO-SWITCH ACTIVE'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                data-testid="master-switch-lock-single-mode"
                onClick={() => setShaderParam('autoChoreographyEnabled', false)}
                className={`min-h-[48px] p-2.5 rounded-lg border text-left transition-all flex items-start gap-2.5 ${
                  !autoChoreographyEnabled
                    ? 'bg-amber-400 text-zinc-950 border-amber-300 font-bold shadow-md'
                    : 'bg-zinc-950/80 border-white/15 text-zinc-300 hover:text-white'
                }`}
              >
                <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold">Lock Current Mode for Entire Video</div>
                  <div
                    className={`text-[10px] mt-0.5 ${
                      !autoChoreographyEnabled ? 'text-zinc-900 font-medium' : 'text-zinc-400'
                    }`}
                  >
                    Stays in {activeModeInfo.shortName} from 00:00 to end
                  </div>
                </div>
              </button>

              <button
                type="button"
                data-testid="master-switch-auto-switch-sections"
                onClick={() => setShaderParam('autoChoreographyEnabled', true)}
                className={`min-h-[48px] p-2.5 rounded-lg border text-left transition-all flex items-start gap-2.5 ${
                  autoChoreographyEnabled
                    ? 'bg-emerald-400 text-zinc-950 border-emerald-300 font-bold shadow-md'
                    : 'bg-zinc-950/80 border-white/15 text-zinc-300 hover:text-white'
                }`}
              >
                <Unlock className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold">Auto-Switch Modes on Song Parts</div>
                  <div
                    className={`text-[10px] mt-0.5 ${
                      autoChoreographyEnabled ? 'text-zinc-900 font-medium' : 'text-zinc-400'
                    }`}
                  >
                    Morphs smoothly on Intro, Buildup, Drop &amp; Outro
                  </div>
                </div>
              </button>
            </div>

            {/* Auto-Switch Configuration (Trigger Mode + Crossfade Smoothness Slider) */}
            {autoChoreographyEnabled && (
              <div
                data-testid="auto-switch-config-panel"
                className="pt-2.5 border-t border-white/15 space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-300 font-semibold">Auto-Switch Trigger Rule</span>
                  <span className="font-mono text-[10px] text-zinc-400">
                    Check modes below to include/exclude
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'song-sections', label: 'Song Sections', sub: 'Intro / Drop / Outro' },
                      { id: 'every-n-bars', label: 'Every 8 Bars', sub: 'BPM Beat-Locked' },
                      { id: 'ai-storyboard', label: 'AI Storyboard', sub: 'Gemini Keyframes' },
                    ] as { id: AutoSwitchTriggerMode; label: string; sub: string }[]
                  ).map((trig) => (
                    <button
                      key={trig.id}
                      type="button"
                      data-testid={`auto-switch-trigger-${trig.id}`}
                      onClick={() => setShaderParam('autoSwitchTriggerMode', trig.id)}
                      className={`p-2 rounded-lg border text-left transition-colors ${
                        autoSwitchTriggerMode === trig.id
                          ? 'bg-emerald-950/80 border-emerald-400 text-white'
                          : 'bg-zinc-950/70 border-white/10 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <div className="text-[11px] font-semibold truncate">{trig.label}</div>
                      <div className="text-[9px] text-zinc-400 truncate">{trig.sub}</div>
                    </button>
                  ))}
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <label htmlFor="slider-crossfade-seconds" className="text-zinc-200 font-medium">
                      Crossfade Smoothness Duration (0.5s – 8.0s)
                    </label>
                    <span className="font-mono tabular-nums text-emerald-400">
                      {transitionMorphSeconds.toFixed(1)}s
                    </span>
                  </div>
                  <input
                    id="slider-crossfade-seconds"
                    type="range"
                    min={0.5}
                    max={8.0}
                    step={0.5}
                    value={transitionMorphSeconds}
                    onChange={(e) =>
                      setShaderParam('transitionMorphSeconds', parseFloat(e.target.value))
                    }
                    className="w-full accent-emerald-400"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 5 Clean Touch-Filter Category Pills for 26 Total Visualizer Modes */}
          <div
            data-testid="mode-category-filter-pills"
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1"
          >
            {(
              [
                'All (26)',
                'Fractals & 4D',
                'Surreal & Visionary',
                'Cosmic & Physics',
                'Organic & Liquid',
                'Audio & Optical',
              ] as ModeCategoryFilter[]
            ).map((cat) => {
              const active = modeCategoryFilter === cat;
              const slug = cat.toLowerCase().replace(/[^a-z0-9]+/g, '-');
              return (
                <button
                  key={cat}
                  type="button"
                  data-testid={`mode-category-pill-${slug}`}
                  onClick={() => setModeCategoryFilter(cat)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    active
                      ? 'bg-amber-400 text-zinc-950 border-amber-300 shadow-sm'
                      : 'bg-zinc-950/90 text-zinc-300 border-white/15 hover:text-white hover:border-amber-400/40'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* 26 Visualizer Mode Touch Cards (Mode 25 Featured at Top of All, Fractals & 4D, and Surreal & Visionary) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {[...FRACTAL_MODE_INFO]
              .filter(
                (m) =>
                  modeCategoryFilter === 'All (26)' ||
                  m.category === modeCategoryFilter ||
                  ('secondaryCategory' in m && m.secondaryCategory === modeCategoryFilter)
              )
              .sort((a, b) => (b.id === 25 ? 1 : 0) - (a.id === 25 ? 1 : 0))
              .map((m) => {
                const isSelected = fractalMode === m.id;
                const isDivine = m.id === 25;
                const isIncludedInAuto = autoSwitchEnabledModes[m.id] ?? true;
                return (
                  <div
                    key={m.id}
                    className={`min-h-[58px] p-2.5 rounded-lg border transition-colors flex flex-col justify-between ${
                      isDivine ? 'sm:col-span-2' : ''
                    } ${
                      isSelected
                        ? isDivine
                          ? 'bg-gradient-to-r from-amber-950/90 via-zinc-900 to-yellow-950/80 border-2 border-amber-300 text-white shadow-[0_0_20px_rgba(251,191,36,0.32)]'
                          : 'bg-zinc-800 border-amber-400 text-white shadow-md'
                        : isDivine
                          ? 'bg-gradient-to-r from-amber-950/55 via-zinc-950/90 to-yellow-950/45 border border-amber-400/50 text-zinc-200 hover:border-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.16)]'
                          : 'bg-zinc-950/60 border-white/10 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        data-testid={`scene-fractal-mode-${m.id}`}
                        onClick={() => setFractalMode(m.id as FractalMode)}
                        className="flex-1 text-left min-w-0 cursor-pointer"
                      >
                        <div className="flex items-center justify-between text-xs font-semibold gap-1">
                          <span className="truncate">{m.shortName}</span>
                          <span
                            className={`text-[10px] font-mono shrink-0 ${
                              isDivine
                                ? 'px-2 py-0.5 rounded bg-gradient-to-r from-amber-300 to-yellow-200 text-zinc-950 font-extrabold shadow-[0_0_10px_rgba(251,191,36,0.45)]'
                                : 'text-amber-400'
                            }`}
                          >
                            {m.badge}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-300 truncate mt-0.5">
                          {m.subtitle}
                        </div>
                      </button>

                      {/* Checkbox to Include/Exclude Mode in Auto-Switch Rotation */}
                      <label
                        title="Include this mode when Auto-Switch per Song Part is active"
                        className="flex items-center gap-1 text-[10px] font-mono text-zinc-300 cursor-pointer shrink-0 pt-0.5"
                      >
                        <input
                          type="checkbox"
                          data-testid={`auto-include-mode-${m.id}`}
                          checked={isIncludedInAuto}
                          onChange={() => toggleAutoSwitchModeIncluded(m.id as FractalMode)}
                          className="rounded border-white/20 bg-zinc-950 text-emerald-400"
                        />
                        <span className="hidden xl:inline">Auto</span>
                      </label>
                    </div>

                    {isSelected && (
                      <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-white/10">
                        <span className="text-[10px] font-mono text-amber-300">
                          Active Engine #{m.id + 1} · {m.category}
                        </span>
                        <button
                          type="button"
                          data-testid={`jump-tune-mode-${m.id}`}
                          onClick={() => setActiveInspectorTab('geometry')}
                          className="text-[10px] font-semibold text-cyan-300 hover:text-cyan-200 flex items-center gap-1 cursor-pointer"
                        >
                          <Sliders className="w-3 h-3" />
                          <span>Tune Active Mode →</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          {/* "Fractal Genesis" AI Procedural World Biome Selector (Mode 3) */}
          <div className="bg-zinc-900/90 border border-emerald-400/40 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>&ldquo;Fractal Genesis&rdquo; World Biome Selector (Mode 04)</span>
              </span>
              <span className="text-[10px] font-mono uppercase text-emerald-400">
                {worldBiomeMode}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {WORLD_BIOME_PRESETS.map((b) => {
                const active = worldBiomeMode === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    data-testid={`world-biome-${b.id}`}
                    onClick={() => {
                      setWorldBiomeMode(b.id as WorldBiomeMode);
                      if (fractalMode !== 3) setFractalMode(3);
                    }}
                    className={`min-h-[46px] p-2 rounded-lg border text-left transition-colors ${
                      active
                        ? 'bg-emerald-950/70 border-emerald-400 text-white'
                        : 'bg-zinc-950/70 border-white/10 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <div className="text-xs font-semibold truncate">{b.label}</div>
                    <div className="text-[9px] text-zinc-400 truncate">{b.subtitle}</div>
                  </button>
                );
              })}
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="slider-world-biome-morph" className="text-zinc-300 font-medium">
                  Manual Biome Morph (0=Mountains · 1=Flora · 2=City · 3=Animals)
                </label>
                <span className="font-mono tabular-nums text-emerald-400">
                  {worldBiomeMode === 'auto' ? 'Auto-Evolve' : worldBiomeMorph.toFixed(2)}
                </span>
              </div>
              <input
                id="slider-world-biome-morph"
                type="range"
                min={0}
                max={3}
                step={0.05}
                value={worldBiomeMorph}
                onChange={(e) => {
                  setShaderParam('worldBiomeMode', 'mountains');
                  setShaderParam('worldBiomeMorph', parseFloat(e.target.value));
                  if (fractalMode !== 3) setFractalMode(3);
                }}
                className="w-full accent-emerald-400"
              />
            </div>

            {/* Transcendental Ascension Slider (u_transcendence: 0.0 -> 1.0) */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="slider-transcendence" className="text-emerald-200 font-medium">
                  Transcendental Ascension (Natural World → Sacred DMT Mandala)
                </label>
                <span className="font-mono tabular-nums text-amber-300">
                  {Math.round(transcendence * 100)}%
                </span>
              </div>
              <input
                id="slider-transcendence"
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={transcendence}
                onChange={(e) => {
                  setShaderParam('transcendence', parseFloat(e.target.value));
                  if (fractalMode !== 3) setFractalMode(3);
                }}
                className="w-full accent-amber-400"
              />
            </div>

            {/* Multi-Piece SDF Collage Join System (u_collageJoinMode: 0..3) */}
            <div className="pt-1 border-t border-emerald-400/20 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-300 font-medium">
                  Multi-Piece SDF Collage Join Operator (Terrain + Flora + City + Creatures)
                </span>
                <span className="font-mono text-emerald-400">
                  {COLLAGE_JOIN_PRESETS.find((c) => c.id === collageJoinMode)?.label}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {COLLAGE_JOIN_PRESETS.map((cj) => (
                  <button
                    key={cj.id}
                    type="button"
                    data-testid={`collage-join-${cj.id}`}
                    onClick={() => setShaderParam('collageJoinMode', cj.id as CollageJoinMode)}
                    className={`min-h-[42px] p-1.5 rounded-lg border text-left transition-colors ${
                      collageJoinMode === cj.id
                        ? 'bg-emerald-950/80 border-emerald-400 text-white'
                        : 'bg-zinc-950/60 border-white/10 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <div className="text-[11px] font-semibold truncate">{cj.label}</div>
                    <div className="text-[9px] text-zinc-400 truncate">{cj.subtitle}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Smooth Cross-Fade Morph Slider & Quick Mutation Actions */}
          <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2.5 space-y-2.5">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="slider-morph" className="text-zinc-300 font-medium">
                  Manual Mode Cross-Fade Morph Override (u_morph)
                </label>
                <span className="font-mono tabular-nums text-amber-400">
                  {manualMorphOverride !== null ? `${Math.round(manualMorphOverride * 100)}%` : 'Auto 100%'}
                </span>
              </div>
              <input
                id="slider-morph"
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={manualMorphOverride !== null ? manualMorphOverride : 1.0}
                onChange={(e) => setShaderParam('manualMorphOverride', parseFloat(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={aiPsychedelicMutate}
                className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Mutate</span>
              </button>
              <button
                type="button"
                onClick={randomizeDna}
                className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-white/15 text-zinc-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <Shuffle className="w-3.5 h-3.5 text-emerald-400" />
                <span>Random DNA</span>
              </button>
              <button
                type="button"
                onClick={resetCamera}
                className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-white/15 text-zinc-200 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                <span>Reset Cam</span>
              </button>
            </div>
          </div>

          {/* PRESET VAULT MANAGER (Save, Load, Favorite, Duplicate, Delete, Export/Import JSON) */}
          <div
            data-testid="preset-vault-manager"
            className="bg-zinc-900/95 border border-amber-400/35 rounded-xl p-3 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                <span>Preset Vault Manager ({presets.length} Presets)</span>
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  ref={presetJsonInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const text = await file.text();
                    importPresetsJson(text);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => presetJsonInputRef.current?.click()}
                  className="px-2 py-1 rounded bg-zinc-950 hover:bg-zinc-800 border border-white/15 text-[10px] font-semibold text-zinc-200 flex items-center gap-1"
                >
                  <Upload className="w-3 h-3 text-cyan-400" />
                  <span>Import JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const userPresets = presets.filter((p) => !p.isFactory);
                    const payload = JSON.stringify(
                      userPresets.length > 0 ? userPresets : presets,
                      null,
                      2
                    );
                    const blob = new Blob([payload], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'chromafract-presets.json';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-2 py-1 rounded bg-zinc-950 hover:bg-zinc-800 border border-white/15 text-[10px] font-semibold text-zinc-200 flex items-center gap-1"
                >
                  <Download className="w-3 h-3 text-amber-400" />
                  <span>Export JSON</span>
                </button>
              </div>
            </div>

            {/* Save Current Snapshot Row */}
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="New preset name (e.g. Sub-Bass DMT Spire)..."
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-zinc-950 border border-white/15 text-xs text-white focus:outline-none focus:border-amber-400"
              />
              <button
                type="button"
                data-testid="vault-save-preset-btn"
                onClick={() => {
                  const thumb = captureCanvasThumbnailDataUrl(160, 90);
                  saveNewPreset(
                    newPresetName.trim() || `Custom Snapshot ${presets.length + 1}`,
                    'User Custom',
                    thumb
                  );
                  setNewPresetName('');
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-zinc-950 text-xs font-bold shrink-0"
              >
                + Save Snapshot
              </button>
            </div>

            {/* Category Filter Pills (All, High-Clarity 3D, 4D & Trippy, Bass & EDM, Worlds, Zeno, Image 3D, User Custom) */}
            <div
              data-testid="preset-vault-category-filters"
              className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5"
            >
              {[
                'All',
                'High-Clarity 3D',
                '4D & Trippy',
                'Bass & EDM',
                'Worlds',
                'Zeno',
                'Image 3D',
                'User Custom',
              ].map((cat) => {
                const active = presetCategoryFilter === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    data-testid={`preset-filter-${cat.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                    onClick={() => setPresetCategoryFilter(cat)}
                    className={`shrink-0 px-2.5 py-1 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                      active
                        ? 'bg-amber-400 text-zinc-950 border-amber-300'
                        : 'bg-zinc-950 text-zinc-300 border-white/10 hover:text-white'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Grid of Presets (35 Factory + Custom User Presets) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-1">
              {presets
                .filter((p) => {
                  if (presetCategoryFilter === 'All') return true;
                  if (presetCategoryFilter === 'User Custom') return !p.isFactory;
                  return p.category === presetCategoryFilter;
                })
                .map((preset) => {
                  const isActive = activePresetId === preset.id;
                  return (
                    <div
                      key={preset.id}
                      data-testid={`vault-preset-card-${preset.id}`}
                      className={`p-2 rounded-lg border flex items-center justify-between gap-2 transition-colors ${
                        isActive
                          ? 'bg-amber-400/15 border-amber-400 text-white'
                          : 'bg-zinc-950/75 border-white/10 text-zinc-300'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => loadPreset(preset.id)}
                        className="flex-1 text-left min-w-0 cursor-pointer"
                      >
                        <div className="text-xs font-semibold truncate flex items-center gap-1">
                          {preset.isFavorite && (
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                          )}
                          <span className="truncate">{preset.name}</span>
                        </div>
                        <div className="text-[10px] font-mono text-zinc-400 truncate">
                          {preset.category} · Mode {(preset.snapshot?.fractalMode ?? 0) + 1}
                        </div>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleFavoritePreset(preset.id)}
                          title="Toggle Favorite"
                          className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-amber-300"
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              preset.isFavorite ? 'text-amber-400 fill-amber-400' : ''
                            }`}
                          />
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicatePreset(preset.id)}
                          title="Duplicate Preset"
                          className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-cyan-300"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {!preset.isFactory && (
                          <button
                            type="button"
                            onClick={() => deletePreset(preset.id)}
                            title="Delete Custom Preset"
                            className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================== */}
      {/* TAB 2 (geometry): [TUNE ACTIVE MODE] — CONTEXT-AWARE SCENE CONTROLS        */}
      {/* ========================================================================== */}
      {activeInspectorTab === 'geometry' && (
        <div data-testid="inspector-tab-geometry" className="space-y-3">
          {/* Active Mode Header & Quick Mode Switcher Strip */}
          <div className="bg-zinc-900/95 border border-amber-400/40 rounded-xl p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Box className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate">Fine-Tuning: {activeModeInfo.name}</span>
                </h2>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Adjust sliders below while watching the pinned live preview above in real time.
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  data-testid="fine-tune-card-back-btn"
                  onClick={() => setActiveInspectorTab('modes')}
                  className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-white/15 text-[11px] font-semibold text-amber-300 flex items-center gap-1 transition-colors"
                >
                  <span>← Modes / Home</span>
                </button>
                <span className="px-2 py-1 rounded bg-amber-400/15 border border-amber-400/35 text-[10px] font-mono text-amber-300 shrink-0">
                  {!autoChoreographyEnabled ? '🔒 Locked' : '🔀 Auto'}
                </span>
              </div>
            </div>

            {/* Compact 26-Mode Pill Selector inside Tab 2 so users can switch modes without leaving Tab 2 */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {[...FRACTAL_MODE_INFO]
                .sort((a, b) => (b.id === 25 ? 1 : 0) - (a.id === 25 ? 1 : 0))
                .map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setFractalMode(m.id as FractalMode)}
                    className={`px-2 py-1 rounded text-[10px] font-semibold whitespace-nowrap border transition-colors shrink-0 ${
                      fractalMode === m.id
                        ? 'bg-amber-400 text-zinc-950 border-amber-300 font-bold'
                        : m.id === 25
                          ? 'bg-cyan-950/80 text-cyan-200 border-cyan-400/50 hover:text-white'
                          : 'bg-zinc-950 text-zinc-400 border-white/10 hover:text-white'
                    }`}
                  >
                    {m.shortName}
                  </button>
                ))}
            </div>
          </div>

          {/* Embedded Interactive Touch XY Pads for 1-Finger Real-Time Morphing */}
          <div className="bg-zinc-900/90 border border-white/10 rounded-xl p-3">
            <DualXyPads />
          </div>

          {/* CONTEXT-AWARE CONTROLS FOR MODE 0 (4D Tesseract) & MODE 1 (4D DMT Kaleidoscope) */}
          {(fractalMode === 0 || fractalMode === 1) && (
            <div
              data-testid="context-controls-4d"
              className="bg-zinc-900/90 border border-amber-400/35 rounded-xl p-3 space-y-2.5"
            >
              <div className="text-xs font-semibold text-amber-300 flex items-center justify-between">
                <span>
                  {fractalMode === 0
                    ? '4D Polychora Polytope & 6-Plane Hyperspace Matrix (Mode 01)'
                    : '4D Sacred DMT Kaleidoscope Slice & Mandala Controls (Mode 02)'}
                </span>
                <span className="font-mono text-[10px] text-zinc-400">Stereographic 4D→3D</span>
              </div>

              {fractalMode === 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {POLYCHORA_PRESETS.map((poly) => {
                    const active = polychoraType === poly.id;
                    return (
                      <button
                        key={poly.id}
                        type="button"
                        data-testid={`polychora-type-${poly.id}`}
                        onClick={() => setShaderParam('polychoraType', poly.id as PolychoraType)}
                        className={`min-h-[44px] p-1.5 rounded-lg border text-left transition-colors ${
                          active
                            ? 'bg-amber-500/20 border-amber-400 text-white'
                            : 'bg-zinc-950/70 border-white/10 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <div className="text-[11px] font-semibold truncate">{poly.label}</div>
                        <div className="text-[9px] text-zinc-400 truncate">{poly.subtitle}</div>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <label htmlFor="slider-rot4d-xw" className="text-zinc-300 flex items-center gap-1">
                      <span>4D XW-Plane Rotation</span>
                      <SettingTooltip label="4D XW Rotation" description={SETTING_TOOLTIPS.rot4dXW} />
                    </label>
                    <span className="font-mono text-amber-400">{rot4dXW.toFixed(2)} rad</span>
                  </div>
                  <input
                    id="slider-rot4d-xw"
                    type="range"
                    min={-3.14}
                    max={3.14}
                    step={0.05}
                    value={rot4dXW}
                    onChange={(e) => setShaderParam('rot4dXW', parseFloat(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <label htmlFor="slider-rot4d-yw" className="text-zinc-300 flex items-center gap-1">
                      <span>4D YW-Plane Rotation</span>
                      <SettingTooltip label="4D YW Rotation" description={SETTING_TOOLTIPS.rot4dYW} />
                    </label>
                    <span className="font-mono text-amber-400">{rot4dYW.toFixed(2)} rad</span>
                  </div>
                  <input
                    id="slider-rot4d-yw"
                    type="range"
                    min={-3.14}
                    max={3.14}
                    step={0.05}
                    value={rot4dYW}
                    onChange={(e) => setShaderParam('rot4dYW', parseFloat(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <label htmlFor="slider-rot4d-zw" className="text-zinc-300 flex items-center gap-1">
                      <span>4D ZW-Plane Rotation</span>
                      <SettingTooltip label="4D ZW Rotation" description={SETTING_TOOLTIPS.rot4dZW} />
                    </label>
                    <span className="font-mono text-cyan-400">{rot4dZW.toFixed(2)} rad</span>
                  </div>
                  <input
                    id="slider-rot4d-zw"
                    type="range"
                    min={-3.14}
                    max={3.14}
                    step={0.05}
                    value={rot4dZW}
                    onChange={(e) => setShaderParam('rot4dZW', parseFloat(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center text-xs mb-1">
                    <label htmlFor="slider-w-cam-dist" className="text-zinc-300 flex items-center gap-1">
                      <span>4D W-Camera Distance</span>
                      <SettingTooltip label="4D W-Camera Distance" description={SETTING_TOOLTIPS.wCameraDist} />
                    </label>
                    <span className="font-mono text-cyan-400">{wCameraDist.toFixed(2)}</span>
                  </div>
                  <input
                    id="slider-w-cam-dist"
                    type="range"
                    min={1.45}
                    max={3.6}
                    step={0.05}
                    value={wCameraDist}
                    onChange={(e) => setShaderParam('wCameraDist', parseFloat(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>

                {fractalMode === 1 && (
                  <>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-300">Mandala Symmetry Slices (2–24)</span>
                        <span className="font-mono text-amber-400">{kaleidoSlices} Slices</span>
                      </div>
                      <input
                        type="range"
                        min={2}
                        max={24}
                        step={1}
                        value={Math.max(2, kaleidoSlices)}
                        onChange={(e) =>
                          setShaderParam('kaleidoSlices', parseInt(e.target.value, 10))
                        }
                        className="w-full accent-amber-400"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-300">Optical Trail Persistence</span>
                        <span className="font-mono text-cyan-400">
                          {Math.round(feedbackTrailLength * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={0.94}
                        step={0.02}
                        value={feedbackTrailLength}
                        onChange={(e) =>
                          setShaderParam('feedbackTrailLength', parseFloat(e.target.value))
                        }
                        className="w-full accent-cyan-400"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* CONTEXT-AWARE CONTROLS FOR MODE 2 (Bass Nation Electro Reactor) */}
          {fractalMode === 2 && (
            <div
              data-testid="context-controls-bass-reactor"
              className="bg-zinc-900/90 border border-amber-400/40 rounded-xl p-3 space-y-2.5"
            >
              <div className="text-xs font-semibold text-amber-300 flex items-center justify-between">
                <span>Bass Nation Electro Reactor &amp; Polar FFT Ring (Mode 03)</span>
                <span className="font-mono text-[10px] text-amber-400">
                  {spectrumBarCount} Spectrum Bars
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {([32, 64, 128] as SpectrumBarCount[]).map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setShaderParam('spectrumBarCount', cnt)}
                    className={`py-1.5 rounded border text-xs font-mono transition-colors ${
                      spectrumBarCount === cnt
                        ? 'bg-amber-400 text-zinc-950 border-amber-300 font-bold'
                        : 'bg-zinc-950 border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {cnt} Bars
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-300">Center Medallion Radius</span>
                    <span className="font-mono text-amber-400">{Math.round(emblemSize * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={0.65}
                    step={0.02}
                    value={emblemSize}
                    onChange={(e) => setShaderParam('emblemSize', parseFloat(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-300">Sub-Bass Camera Shake</span>
                    <span className="font-mono text-cyan-400">
                      {Math.round(cameraShakeIntensity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.0}
                    max={2.0}
                    step={0.05}
                    value={cameraShakeIntensity}
                    onChange={(e) =>
                      setShaderParam('cameraShakeIntensity', parseFloat(e.target.value))
                    }
                    className="w-full accent-cyan-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* CONTEXT-AWARE CONTROLS FOR MODE 3 (Fractal Genesis Procedural World v2) */}
          {fractalMode === 3 && (
            <div
              data-testid="context-controls-world-genesis"
              className="bg-zinc-900/90 border border-emerald-400/40 rounded-xl p-3 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-300">
                  &ldquo;Fractal Genesis&rdquo; Procedural World Controls (Mode 04)
                </span>
                <span className="text-[10px] font-mono uppercase text-emerald-400">
                  {worldBiomeMode}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {WORLD_BIOME_PRESETS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setWorldBiomeMode(b.id as WorldBiomeMode)}
                    className={`min-h-[42px] p-1.5 rounded-lg border text-left transition-colors ${
                      worldBiomeMode === b.id
                        ? 'bg-emerald-950/70 border-emerald-400 text-white'
                        : 'bg-zinc-950/70 border-white/10 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <div className="text-xs font-semibold truncate">{b.label}</div>
                    <div className="text-[9px] text-zinc-400 truncate">{b.subtitle}</div>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-300">Transcendental Ascension</span>
                    <span className="font-mono text-amber-300">
                      {Math.round(transcendence * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={transcendence}
                    onChange={(e) => setShaderParam('transcendence', parseFloat(e.target.value))}
                    className="w-full accent-amber-400"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-300">Volumetric Cloud Density</span>
                    <span className="font-mono text-cyan-400">
                      {Math.round(cloudDensity * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1.8}
                    step={0.05}
                    value={cloudDensity}
                    onChange={(e) => setShaderParam('cloudDensity', parseFloat(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* CONTEXT-AWARE CONTROLS FOR MODES 11–24 (Surreal, Cosmic, Organic & Optical Engines) */}
          {fractalMode >= 11 && fractalMode <= 24 && (
            <div
              data-testid={`context-controls-mode-${fractalMode}`}
              className="bg-zinc-900/95 border border-amber-400/40 rounded-xl p-3 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-300">
                  {activeModeInfo.name} · Context-Aware Engine Controls
                </span>
                <span className="text-[10px] font-mono text-cyan-300">{activeModeInfo.badge}</span>
              </div>

              {/* Mode 11: Klüver Cortical Form Constants & V1 Hallucination Engine */}
              {fractalMode === 11 && (
                <div className="space-y-2">
                  <div className="text-[11px] text-zinc-300 font-medium">
                    Wallpaper Symmetry Lens (Crystallographic Plane Group Folding)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {[
                      { id: 0, label: 'pmm Bilateral', sub: 'Mirror Lattice' },
                      { id: 1, label: 'p4m 4-Fold', sub: 'Square Dihedral' },
                      { id: 2, label: 'p6m 6-Fold', sub: 'Hex Honeycomb' },
                      { id: 3, label: 'Chiral p6', sub: 'Rotating Pinwheel' },
                    ].map((sym) => (
                      <button
                        key={sym.id}
                        type="button"
                        onClick={() => setShaderParam('polychoraType', sym.id as PolychoraType)}
                        className={`p-1.5 rounded-lg border text-left transition-colors ${
                          polychoraType === sym.id
                            ? 'bg-amber-400/20 border-amber-400 text-white'
                            : 'bg-zinc-950/70 border-white/10 text-zinc-400 hover:text-white'
                        }`}
                      >
                        <div className="text-[11px] font-semibold truncate">{sym.label}</div>
                        <div className="text-[9px] text-zinc-400 truncate">{sym.sub}</div>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-300">V1 Cortical Wave Frequency</span>
                        <span className="font-mono text-amber-400">{bulbPower.toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min={4.0}
                        max={14.0}
                        step={0.2}
                        value={bulbPower}
                        onChange={(e) => setShaderParam('bulbPower', parseFloat(e.target.value))}
                        className="w-full accent-amber-400"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-300">Spiral vs Cobweb Dominance</span>
                        <span className="font-mono text-cyan-400">
                          {Math.round(transcendence * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.02}
                        value={transcendence}
                        onChange={(e) => setShaderParam('transcendence', parseFloat(e.target.value))}
                        className="w-full accent-cyan-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Mode 12: Non-Euclidean Curved Spaces (Hyperbolic H3, Nil & Sol Thurston Geometries) */}
              {fractalMode === 12 && (
                <div className="space-y-2">
                  <div className="text-[11px] text-zinc-300 font-medium">
                    Thurston Non-Euclidean Geometry Sub-Mode
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                    {[
                      { id: 0, label: 'Hyperbolic H3 Hall', sub: 'Mirrored Dodecahedron' },
                      { id: 1, label: 'Nil Heisenberg Space', sub: 'Helical Twisted Beams' },
                      { id: 2, label: 'Sol Anisotropic Warp', sub: 'Escher exp(z)/exp(-z)' },
                    ].map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setShaderParam('polychoraType', sub.id as PolychoraType)}
                        className={`p-2 rounded-lg border text-left transition-colors ${
                          polychoraType === sub.id
                            ? 'bg-amber-400/20 border-amber-400 text-white'
                            : 'bg-zinc-950/70 border-white/10 text-zinc-400 hover:text-white'
                        }`}
                      >
                        <div className="text-[11px] font-semibold truncate">{sub.label}</div>
                        <div className="text-[9px] text-zinc-400 truncate">{sub.sub}</div>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-300">Geodesic Curvature &amp; Twist</span>
                        <span className="font-mono text-amber-400">{kleinianScale.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min={1.15}
                        max={1.75}
                        step={0.01}
                        value={kleinianScale}
                        onChange={(e) => setShaderParam('kleinianScale', parseFloat(e.target.value))}
                        className="w-full accent-amber-400"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-300">Cell Aperture Scale</span>
                        <span className="font-mono text-cyan-400">{foldLimit.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min={0.65}
                        max={1.55}
                        step={0.01}
                        value={foldLimit}
                        onChange={(e) => setShaderParam('foldLimit', parseFloat(e.target.value))}
                        className="w-full accent-cyan-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Mode 13: Indra's Pearls — Limit Sets of 3D Kleinian & Schottky Sphere Inversions */}
              {fractalMode === 13 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300">Schottky Sphere Inversion Radius</span>
                      <span className="font-mono text-amber-400">{kleinianScale.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={1.15}
                      max={1.75}
                      step={0.01}
                      value={kleinianScale}
                      onChange={(e) => setShaderParam('kleinianScale', parseFloat(e.target.value))}
                      className="w-full accent-amber-400"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300">Möbius Spiral Twist Rate</span>
                      <span className="font-mono text-cyan-400">{foldLimit.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={0.65}
                      max={1.55}
                      step={0.01}
                      value={foldLimit}
                      onChange={(e) => setShaderParam('foldLimit', parseFloat(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                </div>
              )}

              {/* Mode 14: 4D Hopf Fibration & Stereographic Clifford Torus */}
              {fractalMode === 14 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300">Linked Fiber Ring Count</span>
                      <span className="font-mono text-amber-400">{Math.round(bulbPower)} Fibers</span>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={14}
                      step={1}
                      value={bulbPower}
                      onChange={(e) => setShaderParam('bulbPower', parseFloat(e.target.value))}
                      className="w-full accent-amber-400"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300">4D Stereographic W-Projection</span>
                      <span className="font-mono text-cyan-400">{wCameraDist.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={1.45}
                      max={3.6}
                      step={0.05}
                      value={wCameraDist}
                      onChange={(e) => setShaderParam('wCameraDist', parseFloat(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                </div>
              )}

              {/* Mode 15: Relativistic Black Hole Gravitational Lensing & Accretion Disk */}
              {fractalMode === 15 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300">Schwarzschild Event Horizon Mass</span>
                      <span className="font-mono text-amber-400">{kleinianScale.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={1.15}
                      max={1.75}
                      step={0.01}
                      value={kleinianScale}
                      onChange={(e) => setShaderParam('kleinianScale', parseFloat(e.target.value))}
                      className="w-full accent-amber-400"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300">Accretion Disk Inclination Tilt</span>
                      <span className="font-mono text-cyan-400">{zenoEscherTwist.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={-1.5}
                      max={1.5}
                      step={0.05}
                      value={zenoEscherTwist}
                      onChange={(e) => setShaderParam('zenoEscherTwist', parseFloat(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                </div>
              )}

              {/* Mode 16: Kali's Star Nest & Volumetric Cosmic Nebula */}
              {fractalMode === 16 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300">Kali Magic Parameter (abs(p)/dot(p,p)-c)</span>
                      <span className="font-mono text-amber-400">{kleinianScale.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={1.15}
                      max={1.75}
                      step={0.01}
                      value={kleinianScale}
                      onChange={(e) => setShaderParam('kleinianScale', parseFloat(e.target.value))}
                      className="w-full accent-amber-400"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300">Supernova Dust Cloud Density</span>
                      <span className="font-mono text-cyan-400">
                        {Math.round(cloudDensity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={1.8}
                      step={0.05}
                      value={cloudDensity}
                      onChange={(e) => setShaderParam('cloudDensity', parseFloat(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                </div>
              )}

              {/* Mode 17: Triply Periodic Minimal Surfaces (Gyroid / Schwarz-P / Lidinoid) */}
              {fractalMode === 17 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300">TPMS Morph (Gyroid → Schwarz-P → Lidinoid)</span>
                      <span className="font-mono text-amber-400">
                        {Math.round(transcendence * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={transcendence}
                      onChange={(e) => setShaderParam('transcendence', parseFloat(e.target.value))}
                      className="w-full accent-amber-400"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300">Cathedral Membrane Thickness</span>
                      <span className="font-mono text-cyan-400">{foldLimit.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={0.65}
                      max={1.55}
                      step={0.01}
                      value={foldLimit}
                      onChange={(e) => setShaderParam('foldLimit', parseFloat(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                </div>
              )}

              {/* Mode 18: Magnetic Flux Ropes, Tokamak Plasma & Quantum Orbitals */}
              {fractalMode === 18 && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: 0, label: 'Helical Tokamak Cage', sub: 'Braided Magnetic Flux Ropes' },
                      { id: 1, label: 'Hydrogen Quantum Orbitals', sub: '3d / 4f Wavefunction Beats' },
                    ].map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setShaderParam('polychoraType', sub.id as PolychoraType)}
                        className={`p-2 rounded-lg border text-left transition-colors ${
                          (polychoraType % 2) === sub.id
                            ? 'bg-amber-400/20 border-amber-400 text-white'
                            : 'bg-zinc-950/70 border-white/10 text-zinc-400 hover:text-white'
                        }`}
                      >
                        <div className="text-[11px] font-semibold truncate">{sub.label}</div>
                        <div className="text-[9px] text-zinc-400 truncate">{sub.sub}</div>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-300">Harmonic Lobe Order / Winding</span>
                        <span className="font-mono text-amber-400">{bulbPower.toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min={4}
                        max={14}
                        step={0.5}
                        value={bulbPower}
                        onChange={(e) => setShaderParam('bulbPower', parseFloat(e.target.value))}
                        className="w-full accent-amber-400"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-300">Plasma Core Radius</span>
                        <span className="font-mono text-cyan-400">{kleinianScale.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min={1.15}
                        max={1.75}
                        step={0.01}
                        value={kleinianScale}
                        onChange={(e) => setShaderParam('kleinianScale', parseFloat(e.target.value))}
                        className="w-full accent-cyan-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Mode 19: Liquid Mercury Ferrofluid & Thin-Film Iridescent Oil-Slick */}
              {fractalMode === 19 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300">Rosensweig Magnetic Spike Harmonics</span>
                      <span className="font-mono text-amber-400">{bulbPower.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min={4.0}
                      max={14.0}
                      step={0.2}
                      value={bulbPower}
                      onChange={(e) => setShaderParam('bulbPower', parseFloat(e.target.value))}
                      className="w-full accent-amber-400"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300">Thin-Film Soap/Oil Interference Shift</span>
                      <span className="font-mono text-cyan-400">
                        {Math.round(transcendence * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={transcendence}
                      onChange={(e) => setShaderParam('transcendence', parseFloat(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                </div>
              )}

              {/* Mode 20: Physarum Slime-Mold & Bioluminescent Neural Mycelium Network */}
              {fractalMode === 20 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300">Mycelium Voronoi Filament Density</span>
                      <span className="font-mono text-amber-400">{bulbPower.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min={4.0}
                      max={14.0}
                      step={0.2}
                      value={bulbPower}
                      onChange={(e) => setShaderParam('bulbPower', parseFloat(e.target.value))}
                      className="w-full accent-amber-400"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300">Synaptic Domain Curl Warp</span>
                      <span className="font-mono text-cyan-400">{fbmWarpStrength.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min={0.0}
                      max={1.5}
                      step={0.05}
                      value={fbmWarpStrength}
                      onChange={(e) => setShaderParam('fbmWarpStrength', parseFloat(e.target.value))}
                      className="w-full accent-cyan-400"
                    />
                  </div>
                </div>
              )}

              {/* Mode 21: Holographic 3D Strange Attractors (Aizawa / Thomas / Clifford-De Jong) */}
              {fractalMode === 21 && (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                    {[
                      { id: 0, label: 'Aizawa Torus-Sphere', sub: 'Chaotic Magnetic Core' },
                      { id: 1, label: 'Thomas Cyclic Lattice', sub: 'sin(y) - b*x Attractor' },
                      { id: 2, label: 'Clifford / De Jong', sub: 'Silky Caustic Mist' },
                    ].map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setShaderParam('polychoraType', sub.id as PolychoraType)}
                        className={`p-2 rounded-lg border text-left transition-colors ${
                          (polychoraType % 3) === sub.id
                            ? 'bg-amber-400/20 border-amber-400 text-white'
                            : 'bg-zinc-950/70 border-white/10 text-zinc-400 hover:text-white'
                        }`}
                      >
                        <div className="text-[11px] font-semibold truncate">{sub.label}</div>
                        <div className="text-[9px] text-zinc-400 truncate">{sub.sub}</div>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-300">Attractor Bifurcation Parameter</span>
                        <span className="font-mono text-amber-400">{kleinianScale.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min={1.15}
                        max={1.75}
                        step={0.01}
                        value={kleinianScale}
                        onChange={(e) => setShaderParam('kleinianScale', parseFloat(e.target.value))}
                        className="w-full accent-amber-400"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-300">Ribbon Phase Velocity</span>
                        <span className="font-mono text-cyan-400">{cameraSpeed.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min={0.2}
                        max={2.8}
                        step={0.05}
                        value={cameraSpeed}
                        onChange={(e) => setShaderParam('cameraSpeed', parseFloat(e.target.value))}
                        className="w-full accent-cyan-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Mode 22: N-Dimensional Quasicrystal & Aperiodic Penrose Wave Interference */}
              {fractalMode === 22 && (
                <div className="space-y-2">
                  <div className="text-[11px] text-zinc-300 font-medium">
                    Aperiodic Rotational Symmetry Order (N Plane Waves)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {[
                      { id: 0, label: '5-Fold Penrose', sub: 'Golden Ratio Phi' },
                      { id: 1, label: '7-Fold Heptagonal', sub: 'Forbidden Crystal' },
                      { id: 2, label: '9-Fold Nonagonal', sub: 'Aperiodic Star' },
                      { id: 3, label: '12-Fold Dodecagonal', sub: 'Sacred Mosaic' },
                    ].map((sym) => (
                      <button
                        key={sym.id}
                        type="button"
                        onClick={() => setShaderParam('polychoraType', sym.id as PolychoraType)}
                        className={`p-1.5 rounded-lg border text-left transition-colors ${
                          (polychoraType % 4) === sym.id
                            ? 'bg-amber-400/20 border-amber-400 text-white'
                            : 'bg-zinc-950/70 border-white/10 text-zinc-400 hover:text-white'
                        }`}
                      >
                        <div className="text-[11px] font-semibold truncate">{sym.label}</div>
                        <div className="text-[9px] text-zinc-400 truncate">{sym.sub}</div>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-300">Wave Spatial Frequency</span>
                        <span className="font-mono text-amber-400">{bulbPower.toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min={4.0}
                        max={14.0}
                        step={0.2}
                        value={bulbPower}
                        onChange={(e) => setShaderParam('bulbPower', parseFloat(e.target.value))}
                        className="w-full accent-amber-400"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-300">Hyperspace Phason Drift</span>
                        <span className="font-mono text-cyan-400">
                          {Math.round(transcendence * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.02}
                        value={transcendence}
                        onChange={(e) => setShaderParam('transcendence', parseFloat(e.target.value))}
                        className="w-full accent-cyan-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Mode 23: Complex Domain Coloring, Newton/Nova Fractal Root Basins */}
              {fractalMode === 23 && (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                    {[
                      { id: 0, label: 'Newton Root Basins', sub: 'z - R * P(z)/P′(z)' },
                      { id: 1, label: 'Nova Fractal Basins', sub: 'Relaxed + c Perturbation' },
                      { id: 2, label: 'Weierstrass Vortex', sub: 'Doubly Periodic Poles' },
                    ].map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setShaderParam('polychoraType', sub.id as PolychoraType)}
                        className={`p-2 rounded-lg border text-left transition-colors ${
                          (polychoraType % 3) === sub.id
                            ? 'bg-amber-400/20 border-amber-400 text-white'
                            : 'bg-zinc-950/70 border-white/10 text-zinc-400 hover:text-white'
                        }`}
                      >
                        <div className="text-[11px] font-semibold truncate">{sub.label}</div>
                        <div className="text-[9px] text-zinc-400 truncate">{sub.sub}</div>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-300">Polynomial Root Degree (3–8)</span>
                        <span className="font-mono text-amber-400">
                          Degree {Math.min(8, Math.max(3, Math.round(bulbPower * 0.6)))}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={5.0}
                        max={13.5}
                        step={0.5}
                        value={bulbPower}
                        onChange={(e) => setShaderParam('bulbPower', parseFloat(e.target.value))}
                        className="w-full accent-amber-400"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-300">Newton Relaxation Damping R</span>
                        <span className="font-mono text-cyan-400">{foldLimit.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min={0.65}
                        max={1.55}
                        step={0.02}
                        value={foldLimit}
                        onChange={(e) => setShaderParam('foldLimit', parseFloat(e.target.value))}
                        className="w-full accent-cyan-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Mode 24: Op-Art Moiré, Pleochroic Crystal & CRT XY Oscilloscope */}
              {fractalMode === 24 && (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                    {[
                      { id: 0, label: 'Op-Art Moiré Illusion', sub: 'Bridget Riley / Vasarely' },
                      { id: 1, label: 'Pleochroic Gemstone', sub: '3-Axis Birefringent Crystal' },
                      { id: 2, label: 'CRT XY Oscilloscope', sub: 'Jerobeam Green Phosphor' },
                    ].map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => setShaderParam('polychoraType', sub.id as PolychoraType)}
                        className={`p-2 rounded-lg border text-left transition-colors ${
                          (polychoraType % 3) === sub.id
                            ? 'bg-amber-400/20 border-amber-400 text-white'
                            : 'bg-zinc-950/70 border-white/10 text-zinc-400 hover:text-white'
                        }`}
                      >
                        <div className="text-[11px] font-semibold truncate">{sub.label}</div>
                        <div className="text-[9px] text-zinc-400 truncate">{sub.sub}</div>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-300">Lissajous Harmonic Ratio / Grid Density</span>
                        <span className="font-mono text-amber-400">{bulbPower.toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min={4.0}
                        max={14.0}
                        step={0.2}
                        value={bulbPower}
                        onChange={(e) => setShaderParam('bulbPower', parseFloat(e.target.value))}
                        className="w-full accent-amber-400"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-zinc-300">Phosphor Persistence / Dispersion</span>
                        <span className="font-mono text-cyan-400">
                          {Math.round(feedbackTrailLength * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={0.95}
                        step={0.02}
                        value={feedbackTrailLength}
                        onChange={(e) =>
                          setShaderParam('feedbackTrailLength', parseFloat(e.target.value))
                        }
                        className="w-full accent-cyan-400"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CONTEXT-AWARE CONTROLS FOR MODE 9: ZENO'S PARADOX INFINITE ZOOM */}
          <div className="bg-zinc-900/90 border border-cyan-400/40 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
                <InfinityIcon className="w-4 h-4 text-cyan-400" />
                <span>Zeno&apos;s Paradox: Dichotomy Zoom &amp; Frozen Arrow (Mode 10)</span>
              </span>
              <button
                type="button"
                data-testid="activate-zeno-mode-btn"
                onClick={() => setFractalMode(9)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                  fractalMode === 9
                    ? 'bg-cyan-400 text-zinc-950 border-cyan-300 font-bold'
                    : 'bg-zinc-950 text-cyan-300 border-cyan-400/40 hover:bg-cyan-500/20'
                }`}
              >
                {fractalMode === 9 ? 'ACTIVE (MODE 10)' : 'Switch to Zeno Mode'}
              </button>
            </div>

            {/* 4 Zeno Paradox Sub-Mode Pills + Zoom Direction Toggle */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {(
                [
                  { id: 'all', label: 'All 3 Combined', sub: 'Full Zeno Paradox' },
                  { id: 'dichotomy', label: 'Dichotomy 1/2ⁿ', sub: 'Halving Cascade' },
                  { id: 'achilles-droste', label: 'Achilles Droste', sub: 'Logarithmic Spiral' },
                  { id: 'frozen-arrow', label: 'Frozen Arrow', sub: 'Chrono-Echo Strobe' },
                ] as { id: ZenoSubMode; label: string; sub: string }[]
              ).map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  data-testid={`zeno-submode-${sub.id}`}
                  onClick={() => {
                    setZenoSubMode(sub.id);
                    if (fractalMode !== 9) setFractalMode(9);
                  }}
                  className={`p-1.5 rounded-lg border text-left transition-colors ${
                    zenoSubMode === sub.id
                      ? 'bg-cyan-950/80 border-cyan-400 text-white'
                      : 'bg-zinc-950/70 border-white/10 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="text-[11px] font-semibold truncate">{sub.label}</div>
                  <div className="text-[9px] text-zinc-400 truncate">{sub.sub}</div>
                </button>
              ))}
            </div>

            {/* Zoom Direction Toggle: Infinite Inward Fall vs Outward Emergence */}
            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-zinc-950/80 border border-white/10">
              <span className="text-xs text-zinc-300 font-medium">
                Paradox Zoom Direction
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  data-testid="zeno-direction-inward"
                  onClick={() => setShaderParam('zenoReverseDirection', false)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                    !zenoReverseDirection
                      ? 'bg-cyan-400 text-zinc-950 font-bold'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white'
                  }`}
                >
                  Infinite Inward Fall
                </button>
                <button
                  type="button"
                  data-testid="zeno-direction-outward"
                  onClick={() => setShaderParam('zenoReverseDirection', true)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-colors ${
                    zenoReverseDirection
                      ? 'bg-amber-400 text-zinc-950 font-bold'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white'
                  }`}
                >
                  Outward Emergence
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor="slider-zeno-speed" className="text-zinc-300">
                    Zeno Infinite Zoom Speed
                  </label>
                  <span className="font-mono text-cyan-400">{zenoSpeed.toFixed(2)}x</span>
                </div>
                <input
                  id="slider-zeno-speed"
                  type="range"
                  min={0.1}
                  max={3.0}
                  step={0.05}
                  value={zenoSpeed}
                  onChange={(e) => setShaderParam('zenoSpeed', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor="slider-zeno-halving" className="text-zinc-300">
                    Dichotomy Scale-Halving Rate (1/2ⁿ)
                  </label>
                  <span className="font-mono text-cyan-400">{zenoHalvingRate.toFixed(2)}x</span>
                </div>
                <input
                  id="slider-zeno-halving"
                  type="range"
                  min={0.25}
                  max={2.5}
                  step={0.05}
                  value={zenoHalvingRate}
                  onChange={(e) => setShaderParam('zenoHalvingRate', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor="slider-zeno-twist" className="text-zinc-300">
                    Escher-Droste Spiral Twist
                  </label>
                  <span className="font-mono text-amber-400">{zenoEscherTwist.toFixed(2)}</span>
                </div>
                <input
                  id="slider-zeno-twist"
                  type="range"
                  min={-2.0}
                  max={2.0}
                  step={0.05}
                  value={zenoEscherTwist}
                  onChange={(e) => setShaderParam('zenoEscherTwist', parseFloat(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor="slider-zeno-arrow" className="text-zinc-300">
                    Flying Arrow Time-Slicer Mix
                  </label>
                  <span className="font-mono text-amber-400">
                    {Math.round(zenoArrowParadoxMix * 100)}%
                  </span>
                </div>
                <input
                  id="slider-zeno-arrow"
                  type="range"
                  min={0.0}
                  max={1.0}
                  step={0.05}
                  value={zenoArrowParadoxMix}
                  onChange={(e) => setShaderParam('zenoArrowParadoxMix', parseFloat(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>

              <div className="sm:col-span-2">
                <div className="flex justify-between text-xs mb-1">
                  <label htmlFor="slider-zeno-slice-hz" className="text-zinc-300">
                    Frozen Instant Strobe Frequency (u_sliceHz: 4Hz – 24Hz)
                  </label>
                  <span className="font-mono text-cyan-400">{zenoSliceHz.toFixed(0)} Hz</span>
                </div>
                <input
                  id="slider-zeno-slice-hz"
                  type="range"
                  min={4}
                  max={24}
                  step={1}
                  value={zenoSliceHz}
                  onChange={(e) => setShaderParam('zenoSliceHz', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>
          </div>

          {/* Fractal Math, Creature Wing/Fin Speed & Camera Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2.5">
              <div className="flex justify-between items-center text-xs mb-1">
                <label htmlFor="slider-iter-detail" className="text-zinc-300 font-medium flex items-center gap-1">
                  <span>Fractal Iterations (4–16)</span>
                  <SettingTooltip label="Fractal Iterations" description={SETTING_TOOLTIPS.iterationDetail} />
                </label>
                <span className="font-mono tabular-nums text-cyan-400">{iterationDetail} Folds</span>
              </div>
              <input
                id="slider-iter-detail"
                type="range"
                min={4}
                max={16}
                step={1}
                value={iterationDetail}
                onChange={(e) => setShaderParam('iterationDetail', parseInt(e.target.value, 10))}
                className="w-full accent-cyan-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2.5">
              <div className="flex justify-between items-center text-xs mb-1">
                <label htmlFor="slider-creature-speed" className="text-zinc-300 font-medium flex items-center gap-1">
                  <span>Creature Wing/Fin Speed</span>
                  <SettingTooltip label="Creature Speed" description={SETTING_TOOLTIPS.creatureSpeed} />
                </label>
                <span className="font-mono tabular-nums text-emerald-400">{creatureSpeed.toFixed(2)}x</span>
              </div>
              <input
                id="slider-creature-speed"
                type="range"
                min={0.2}
                max={3.0}
                step={0.05}
                value={creatureSpeed}
                onChange={(e) => setShaderParam('creatureSpeed', parseFloat(e.target.value))}
                className="w-full accent-emerald-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2.5">
              <div className="flex justify-between items-center text-xs mb-1">
                <label htmlFor="slider-bulb-power" className="text-zinc-300 font-medium flex items-center gap-1">
                  <span>Mandelbulb Power</span>
                  <SettingTooltip label="Mandelbulb Power" description={SETTING_TOOLTIPS.bulbPower} />
                </label>
                <span className="font-mono tabular-nums text-amber-400">{bulbPower.toFixed(1)}</span>
              </div>
              <input
                id="slider-bulb-power"
                type="range"
                min={4.0}
                max={14.0}
                step={0.1}
                value={bulbPower}
                onChange={(e) => setShaderParam('bulbPower', parseFloat(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2.5">
              <div className="flex justify-between items-center text-xs mb-1">
                <label htmlFor="slider-kleinian-scale" className="text-zinc-300 font-medium flex items-center gap-1">
                  <span>Kleinian Inversion Scale</span>
                  <SettingTooltip label="Kleinian Inversion Scale" description={SETTING_TOOLTIPS.kleinianScale} />
                </label>
                <span className="font-mono tabular-nums text-amber-400">{kleinianScale.toFixed(2)}</span>
              </div>
              <input
                id="slider-kleinian-scale"
                type="range"
                min={1.15}
                max={1.75}
                step={0.01}
                value={kleinianScale}
                onChange={(e) => setShaderParam('kleinianScale', parseFloat(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2.5">
              <div className="flex justify-between items-center text-xs mb-1">
                <label htmlFor="slider-fold-limit" className="text-zinc-300 font-medium flex items-center gap-1">
                  <span>Mandelbox Box-Fold Limit</span>
                  <SettingTooltip label="Mandelbox Fold Limit" description={SETTING_TOOLTIPS.foldLimit} />
                </label>
                <span className="font-mono tabular-nums text-amber-400">{foldLimit.toFixed(2)}</span>
              </div>
              <input
                id="slider-fold-limit"
                type="range"
                min={0.65}
                max={1.55}
                step={0.01}
                value={foldLimit}
                onChange={(e) => setShaderParam('foldLimit', parseFloat(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2.5">
              <div className="flex justify-between items-center text-xs mb-1">
                <label htmlFor="slider-tunnel-scale" className="text-zinc-300 font-medium flex items-center gap-1">
                  <span>Tunnel Radius &amp; KIFS Scale</span>
                  <SettingTooltip label="Tunnel & KIFS Scale" description={SETTING_TOOLTIPS.tunnelScale} />
                </label>
                <span className="font-mono tabular-nums text-cyan-400">{tunnelScale.toFixed(2)}</span>
              </div>
              <input
                id="slider-tunnel-scale"
                type="range"
                min={1.5}
                max={2.8}
                step={0.02}
                value={tunnelScale}
                onChange={(e) => setShaderParam('tunnelScale', parseFloat(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2.5">
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="slider-tunnel-curvature" className="text-zinc-300 font-medium">
                  Wormhole Path Curvature
                </label>
                <span className="font-mono tabular-nums text-cyan-400">{tunnelCurvature.toFixed(2)}</span>
              </div>
              <input
                id="slider-tunnel-curvature"
                type="range"
                min={0.0}
                max={2.2}
                step={0.05}
                value={tunnelCurvature}
                onChange={(e) => setShaderParam('tunnelCurvature', parseFloat(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2.5">
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="slider-camera-speed" className="text-zinc-300 font-medium">
                  Camera Fly Speed
                </label>
                <span className="font-mono tabular-nums text-cyan-400">{cameraSpeed.toFixed(2)}x</span>
              </div>
              <input
                id="slider-camera-speed"
                type="range"
                min={0.2}
                max={2.8}
                step={0.05}
                value={cameraSpeed}
                onChange={(e) => setShaderParam('cameraSpeed', parseFloat(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2.5 sm:col-span-2">
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="slider-camera-fov" className="text-zinc-300 font-medium">
                  Camera Field of View (FOV Focal Length)
                </label>
                <span className="font-mono tabular-nums text-amber-400">{cameraFov.toFixed(2)}</span>
              </div>
              <input
                id="slider-camera-fov"
                type="range"
                min={0.6}
                max={2.2}
                step={0.05}
                value={cameraFov}
                onChange={(e) => setShaderParam('cameraFov', parseFloat(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>
          </div>

          {/* GPU-Heavy Mode & Raymarch Step Budget */}
          <div className="bg-zinc-900/90 border border-cyan-400/40 rounded-lg p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span>GPU-Heavy Mode</span>
                  <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-cyan-400/15 text-cyan-300 border border-cyan-400/30">
                    {gpuHeavyMode ? 'GLSL highp' : 'GLSL mediump'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Forces 32-bit <code className="text-cyan-300">highp float</code> calculations in GLSL and multi-threaded compilation ({shaderCompileStatus}).
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={gpuHeavyMode}
                aria-label="GPU-Heavy Mode"
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

            <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-white/10">
              {(
                [
                  { id: 'performance', label: 'Fast Mobile', sub: '64 Steps' },
                  { id: 'balanced', label: 'Balanced', sub: '100 Steps' },
                  { id: 'ultra', label: 'Cinema Ultra', sub: '140–200 Steps' },
                ] as { id: QualityTier; label: string; sub: string }[]
              ).map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setQualityTier(tier.id)}
                  className={`p-2 rounded border text-left transition-colors ${
                    qualityTier === tier.id
                      ? 'bg-zinc-800 border-amber-400 text-white'
                      : 'bg-zinc-950/60 border-white/10 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="text-xs font-semibold flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-amber-400" />
                    <span>{tier.label}</span>
                  </div>
                  <div className="text-[10px] font-mono tabular-nums text-zinc-400">{tier.sub}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================== */}
      {/* TAB 3 (audio): [AUDIO SYNC & BASS]                                         */}
      {/* ========================================================================== */}
      {activeInspectorTab === 'audio' && (
        <div data-testid="inspector-tab-audio" className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              Audio Sync &amp; Bass Reactivity Matrix
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Tune master audio gain, nonlinear peak exaggeration, sub-bass directional camera shake, and 7-band frequency sensitivity.
            </p>
          </div>

          {/* Master Reactivity Gain & Sub-Bass Camera Shake */}
          <div className="bg-zinc-900/90 border border-amber-400/35 rounded-lg p-3 space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="slider-reactivity-gain" className="text-amber-300 font-semibold">
                  Master Audio Reactivity Gain (0% – 300%)
                </label>
                <span className="font-mono tabular-nums text-amber-400">
                  {Math.round(reactivityGain * 100)}%
                </span>
              </div>
              <input
                id="slider-reactivity-gain"
                type="range"
                min={0}
                max={3.0}
                step={0.05}
                value={reactivityGain}
                onChange={(e) => setShaderParam('reactivityGain', parseFloat(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-white/10">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-zinc-300">Sub-Bass Camera Shake</span>
                  <span className="font-mono text-amber-300">{Math.round(cameraShakeIntensity * 100)}%</span>
                </div>
                <input
                  id="slider-camera-shake"
                  type="range"
                  min={0.0}
                  max={2.0}
                  step={0.05}
                  value={cameraShakeIntensity}
                  onChange={(e) => setShaderParam('cameraShakeIntensity', parseFloat(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-zinc-300">Peak Exaggeration</span>
                  <span className="font-mono text-cyan-300">{peakExponent.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0.8}
                  max={2.6}
                  step={0.05}
                  value={peakExponent}
                  onChange={(e) => setShaderParam('peakExponent', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-zinc-300">Mechanical Bounce</span>
                  <span className="font-mono text-cyan-300">{bounceIntensity.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min={0.0}
                  max={2.5}
                  step={0.05}
                  value={bounceIntensity}
                  onChange={(e) => setShaderParam('bounceIntensity', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="text-zinc-300">Spike Sensitivity</span>
                  <span className="font-mono text-amber-300">{spikeSensitivity.toFixed(2)}x</span>
                </div>
                <input
                  id="slider-spike-sensitivity"
                  type="range"
                  min={0.2}
                  max={3.0}
                  step={0.05}
                  value={spikeSensitivity}
                  onChange={(e) => setShaderParam('spikeSensitivity', parseFloat(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>
            </div>
          </div>

          {/* 7-Band Per-Frequency Reactivity Gain Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2.5">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-300 font-medium">1. Sub-Bass Kick (20–60Hz)</span>
                <span className="font-mono text-amber-400">{Math.round(subBassKickGain * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={2.5}
                step={0.05}
                value={subBassKickGain}
                onChange={(e) => setShaderParam('subBassKickGain', parseFloat(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2.5">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-300 font-medium">2. Bass Morph (60–250Hz)</span>
                <span className="font-mono text-amber-400">{Math.round(bassMorphGain * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={2.5}
                step={0.05}
                value={bassMorphGain}
                onChange={(e) => setShaderParam('bassMorphGain', parseFloat(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2.5">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-300 font-medium">3. Low-Mid Warmth (250–500Hz)</span>
                <span className="font-mono text-emerald-400">{Math.round(lowMidGain * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={2.5}
                step={0.05}
                value={lowMidGain}
                onChange={(e) => setShaderParam('lowMidGain', parseFloat(e.target.value))}
                className="w-full accent-emerald-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2.5">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-300 font-medium">4. Mid Space Twist (500–2kHz)</span>
                <span className="font-mono text-cyan-400">{Math.round(midTwistGain * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={2.5}
                step={0.05}
                value={midTwistGain}
                onChange={(e) => setShaderParam('midTwistGain', parseFloat(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2.5">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-300 font-medium">5. Upper-Mid Presence (2–4kHz)</span>
                <span className="font-mono text-cyan-400">{Math.round(upperMidGain * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={2.5}
                step={0.05}
                value={upperMidGain}
                onChange={(e) => setShaderParam('upperMidGain', parseFloat(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2.5">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-300 font-medium">6. Treble Sparkle (4–6kHz)</span>
                <span className="font-mono text-cyan-400">{Math.round(trebleSparkleGain * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={2.5}
                step={0.05}
                value={trebleSparkleGain}
                onChange={(e) => setShaderParam('trebleSparkleGain', parseFloat(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2.5 sm:col-span-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-zinc-300 font-medium">7. Brilliance &amp; Air Shimmer (6–20kHz)</span>
                <span className="font-mono text-amber-400">{Math.round(brillianceGain * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={2.5}
                step={0.05}
                value={brillianceGain}
                onChange={(e) => setShaderParam('brillianceGain', parseFloat(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>
          </div>

          {/* Synesthetic & Onset Feature Toggles */}
          <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-3 space-y-2">
            <div className="text-xs font-semibold text-white mb-1">
              Onset Triggers &amp; Synesthesia Couplers
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center justify-between p-2 rounded bg-zinc-950/70 border border-white/10 cursor-pointer">
                <span>Kick Shockwave Rings</span>
                <input
                  type="checkbox"
                  checked={beatShockwaveEnabled}
                  onChange={(e) => setShaderParam('beatShockwaveEnabled', e.target.checked)}
                  className="rounded border-white/20 bg-zinc-950 text-amber-400"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded bg-zinc-950/70 border border-white/10 cursor-pointer">
                <span>Snare Kaleidoscope / Glitch</span>
                <input
                  type="checkbox"
                  checked={snareKaleidoJumpEnabled}
                  onChange={(e) => setShaderParam('snareKaleidoJumpEnabled', e.target.checked)}
                  className="rounded border-white/20 bg-zinc-950 text-cyan-400"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded bg-zinc-950/70 border border-white/10 cursor-pointer">
                <span>12-Tone Pitch-to-Color Synesthesia</span>
                <input
                  type="checkbox"
                  checked={pitchSynesthesiaEnabled}
                  onChange={(e) => setShaderParam('pitchSynesthesiaEnabled', e.target.checked)}
                  className="rounded border-white/20 bg-zinc-950 text-amber-400"
                />
              </label>

              <label className="flex items-center justify-between p-2 rounded bg-zinc-950/70 border border-white/10 cursor-pointer">
                <span>BPM Sawtooth Camera Surge</span>
                <input
                  type="checkbox"
                  checked={bpmCameraSurgeEnabled}
                  onChange={(e) => setShaderParam('bpmCameraSurgeEnabled', e.target.checked)}
                  className="rounded border-white/20 bg-zinc-950 text-cyan-400"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================== */}
      {/* TAB 4 (fx): [COLORS, CLARITY & FX]                                         */}
      {/* ========================================================================== */}
      {activeInspectorTab === 'fx' && (
        <div data-testid="inspector-tab-fx" className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Palette className="w-4 h-4 text-cyan-400" />
              Colors, Clarity &amp; FX Studio ({COSINE_PALETTE_PRESETS.length} Built-In Palettes)
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              High-Clarity 3D edge contrast grading (u_clarity), 24 Cosine Color Palettes, 24-slice Kaleidoscope mandala, and ACES Filmic mastering.
            </p>
          </div>

          {/* HIGH-CLARITY 3D EDGE CONTRAST & ANTI-MUD SHADER GRADING BOOSTER */}
          <div
            data-testid="clarity-grading-card"
            className="bg-zinc-900/95 border border-cyan-400/45 rounded-xl p-3 space-y-2"
          >
            <div className="flex items-center justify-between text-xs">
              <label
                htmlFor="slider-clarity"
                className="font-bold text-cyan-300 flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Clarity &amp; 3D Edge Contrast Booster (u_clarity: 0% – 200%)</span>
                <SettingTooltip
                  settingKey="clarity"
                  label="High-Clarity 3D Crevice & Rim Booster"
                />
              </label>
              <span className="font-mono font-bold text-cyan-300 tabular-nums">
                {Math.round(clarity * 100)}%
              </span>
            </div>
            <input
              id="slider-clarity"
              type="range"
              data-testid="slider-clarity"
              min={0.0}
              max={2.0}
              step={0.05}
              value={clarity}
              onChange={(e) => setShaderParam('clarity', parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
              <span>5-Tap AO Crevice Contrast</span>
              <span>4th-Power Fresnel Rim</span>
              <span>ACES Anti-Mud Tone Map</span>
            </div>
          </div>

          {/* 24 Built-In Cosine Palette Presets + RGB Cosine Vector Fine-Tuning */}
          <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-3 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white">
                24 Visionary &amp; High-Clarity Cosine Palettes
              </span>
              <span className="font-mono text-[11px] text-zinc-400">
                d=[{(palette?.d ?? [0.8, 0.9, 0.3]).map((v) => v.toFixed(2)).join(', ')}]
              </span>
            </div>
            <div
              className="h-3 w-full rounded border border-white/15"
              style={{ background: gradientCss }}
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1 max-h-64 overflow-y-auto pr-1">
              {COSINE_PALETTE_PRESETS.map((p) => {
                const isSelected =
                  p.palette.d[0] === palette.d[0] &&
                  p.palette.d[1] === palette.d[1] &&
                  p.palette.d[2] === palette.d[2];
                const swatchStops = [0.1, 0.5, 0.85].map((t) => {
                  const [r, g, b] = evaluateCosinePalette(t, p.palette);
                  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
                });
                return (
                  <button
                    key={p.id}
                    type="button"
                    data-testid={`palette-preset-${p.id}`}
                    onClick={() => setPalette(p.palette)}
                    className={`min-h-[42px] p-1.5 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-2 ${
                      isSelected
                        ? 'bg-cyan-950/80 border-cyan-400 text-white shadow-sm'
                        : 'bg-zinc-950 hover:bg-zinc-800 border-white/10 text-zinc-200'
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded shrink-0 border border-white/25"
                      style={{ background: `linear-gradient(135deg, ${swatchStops.join(', ')})` }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold truncate">{p.name}</div>
                      {p.badge && (
                        <div className="text-[9px] font-mono text-cyan-300/80 truncate">
                          {p.badge}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* RGB Cosine Phase Vector (d) Fine-Tuning Sliders */}
            <div className="pt-2 border-t border-white/10 grid grid-cols-3 gap-2">
              {(['R Phase (d.x)', 'G Phase (d.y)', 'B Phase (d.z)'] as const).map((lbl, idx) => (
                <div key={lbl}>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-zinc-400">{lbl}</span>
                    <span className="font-mono text-cyan-300">
                      {(palette.d[idx] ?? 0.5).toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    data-testid={`cosine-d-slider-${idx}`}
                    min={0.0}
                    max={1.0}
                    step={0.02}
                    value={palette.d[idx] ?? 0.5}
                    onChange={(e) => {
                      const nextD = [...palette.d] as [number, number, number];
                      nextD[idx] = parseFloat(e.target.value);
                      setPalette({ ...palette, d: nextD });
                    }}
                    className="w-full accent-cyan-400"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Kaleidoscope Polar Slicer (1–24), Optical Feedback Trail & 3D FBM Domain Warp */}
          <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-3 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-300 font-medium">Kaleidoscope (1–24)</span>
                  <span className="font-mono text-amber-400">
                    {kaleidoSlices <= 1 ? 'Off (1x)' : `${kaleidoSlices} Slices`}
                  </span>
                </div>
                <input
                  id="slider-kaleido-slices"
                  type="range"
                  min={1}
                  max={24}
                  step={1}
                  value={kaleidoSlices}
                  onChange={(e) => setShaderParam('kaleidoSlices', parseInt(e.target.value, 10))}
                  className="w-full accent-amber-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-300 font-medium">Feedback Trail</span>
                  <span className="font-mono text-cyan-400">{Math.round(feedbackTrailLength * 100)}%</span>
                </div>
                <input
                  id="slider-feedback-trail"
                  type="range"
                  min={0.5}
                  max={0.94}
                  step={0.02}
                  value={feedbackTrailLength}
                  onChange={(e) => setShaderParam('feedbackTrailLength', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-300 font-medium">3D FBM Warp</span>
                  <span className="font-mono text-cyan-400">{fbmWarpStrength.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1.5}
                  step={0.05}
                  value={fbmWarpStrength}
                  onChange={(e) => setShaderParam('fbmWarpStrength', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <label className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-white/10 text-xs cursor-pointer">
                <span>Mirror X</span>
                <input
                  type="checkbox"
                  checked={mirrorX}
                  onChange={(e) => setShaderParam('mirrorX', e.target.checked)}
                />
              </label>
              <label className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-white/10 text-xs cursor-pointer">
                <span>Mirror Y</span>
                <input
                  type="checkbox"
                  checked={mirrorY}
                  onChange={(e) => setShaderParam('mirrorY', e.target.checked)}
                />
              </label>
              <label className="flex items-center justify-between p-2 rounded bg-zinc-950 border border-white/10 text-xs cursor-pointer">
                <span>Color Invert</span>
                <input
                  type="checkbox"
                  checked={colorInvert}
                  onChange={(e) => setShaderParam('colorInvert', e.target.checked)}
                />
              </label>
            </div>
          </div>

          {/* Global Color Grading & Post-Processing Sliders */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-zinc-300">Brightness</span>
                <span className="font-mono text-amber-400">{metaBrightness.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={1.8}
                step={0.02}
                value={metaBrightness}
                onChange={(e) => setShaderParam('metaBrightness', parseFloat(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-zinc-300">Contrast</span>
                <span className="font-mono text-amber-400">{metaContrast.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={1.8}
                step={0.02}
                value={metaContrast}
                onChange={(e) => setShaderParam('metaContrast', parseFloat(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-zinc-300">Gamma</span>
                <span className="font-mono text-cyan-400">{metaGamma.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={1.6}
                step={0.02}
                value={metaGamma}
                onChange={(e) => setShaderParam('metaGamma', parseFloat(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-zinc-300">Saturation</span>
                <span className="font-mono text-cyan-400">{metaSaturation.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.0}
                max={2.0}
                step={0.05}
                value={metaSaturation}
                onChange={(e) => setShaderParam('metaSaturation', parseFloat(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-zinc-300">Hue Cycle Speed</span>
                <span className="font-mono text-amber-400">{metaHueSpeed.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.0}
                max={2.0}
                step={0.05}
                value={metaHueSpeed}
                onChange={(e) => setShaderParam('metaHueSpeed', parseFloat(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-zinc-300">Bloom Glow</span>
                <span className="font-mono text-cyan-400">{bloomIntensity.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0.2}
                max={2.4}
                step={0.05}
                value={bloomIntensity}
                onChange={(e) => setShaderParam('bloomIntensity', parseFloat(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-zinc-300">Chromatic Aberr.</span>
                <span className="font-mono text-amber-400">{(chromaticAberration * 1000).toFixed(1)}‰</span>
              </div>
              <input
                type="range"
                min={0.0}
                max={0.012}
                step={0.0005}
                value={chromaticAberration}
                onChange={(e) => setShaderParam('chromaticAberration', parseFloat(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-zinc-300">Vignette</span>
                <span className="font-mono text-cyan-400">{Math.round(vignetteDarkness * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.0}
                max={1.0}
                step={0.05}
                value={vignetteDarkness}
                onChange={(e) => setShaderParam('vignetteDarkness', parseFloat(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-zinc-300">Film Grain</span>
                <span className="font-mono text-amber-400">{Math.round(filmGrain * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.0}
                max={0.5}
                step={0.02}
                value={filmGrain}
                onChange={(e) => setShaderParam('filmGrain', parseFloat(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2 sm:col-span-3">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-zinc-300">Volumetric Cloud &amp; Atmospheric Fog Density (u_cloudDensity)</span>
                <span className="font-mono text-cyan-400">{Math.round(cloudDensity * 100)}%</span>
              </div>
              <input
                id="slider-cloud-density"
                type="range"
                min={0.0}
                max={1.8}
                step={0.05}
                value={cloudDensity}
                onChange={(e) => setShaderParam('cloudDensity', parseFloat(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 bg-zinc-900/90 border border-white/10 rounded-lg p-2.5">
            <label className="flex items-center gap-2 text-xs text-zinc-200 cursor-pointer">
              <input
                type="checkbox"
                checked={chaosMode}
                onChange={(e) => setShaderParam('chaosMode', e.target.checked)}
                className="rounded border-white/20 bg-zinc-950 text-amber-500"
              />
              <span>Lyapunov Chaos Neon Glow</span>
            </label>
            <button
              type="button"
              onClick={triggerBeatBang}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                glitchActive
                  ? 'bg-amber-400 text-zinc-950'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-400/30'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Beat Glitch Strobe</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================== */}
      {/* TAB 1 (image): DEDICATED [AI IMAGE -> 3D FRACTAL] CONVERTER STUDIO         */}
      {/* ========================================================================== */}
      {activeInspectorTab === 'image' && (
        <div data-testid="inspector-tab-image" className="space-y-3">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-cyan-400" />
              AI Image → 3D Fractal Converter &amp; Multi-Image Depth Studio
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Upload 1 to 12+ images to automatically convert flat 2D pixels into raymarched 3D fractal sculptures with AI Vision &amp; GPU RGBA depth maps.
            </p>
          </div>

          {/* 1. DEDICATED AI IMAGE -> 3D FRACTAL CONVERTER & MULTI-IMAGE DEPTH-MORPH STUDIO */}
          <div
            data-testid="multi-image-3d-studio"
            className="bg-zinc-900/95 border-2 border-cyan-400/50 rounded-xl p-3.5 space-y-3 shadow-lg"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Direct AI Image-to-3D-Fractal Pipeline (Mode 11)</span>
                <SettingTooltip
                  label="Multi-Image 3D Relief"
                  description={SETTING_TOOLTIPS.imageDepth3D}
                />
              </div>
              <button
                type="button"
                data-testid="activate-mode-10-btn"
                onClick={() => setFractalMode(10)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border transition-colors ${
                  fractalMode === 10
                    ? 'bg-cyan-400 text-zinc-950 border-cyan-300'
                    : 'bg-zinc-950 text-cyan-300 border-cyan-400/40 hover:bg-cyan-500/20'
                }`}
              >
                {fractalMode === 10 ? 'ACTIVE (MODE 11: 3D FRACTALIZER)' : 'Activate 3D Image Engine'}
              </button>
            </div>

            {/* AI Vision Status & Synthesized 3D DNA Summary Banner */}
            <div
              data-testid="ai-image-3d-status-banner"
              className={`p-2.5 rounded-lg border text-xs flex items-start justify-between gap-2 ${
                isAiFractalizing
                  ? 'bg-amber-500/15 border-amber-400/50 text-amber-200 animate-pulse'
                  : 'bg-zinc-950/90 border-cyan-400/25 text-zinc-200'
              }`}
            >
              <div className="min-w-0">
                <div className="font-bold text-[11px] uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>
                    {isAiFractalizing
                      ? 'AI 3D Fractalizing Image (Gemini Vision + GPU Depth)...'
                      : 'AI 3D Fractal DNA Status'}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-300 mt-0.5 leading-snug">
                  {aiImageFractalSummary}
                </p>
              </div>
              <span className="px-2 py-0.5 rounded bg-cyan-500/15 border border-cyan-400/30 font-mono text-[10px] text-cyan-300 shrink-0">
                {multiImages.length > 0 ? `${multiImages.length} Loaded` : 'Built-In 3D Pair'}
              </span>
            </div>

            {/* Upload & AI Re-Imagine Action Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                ref={multiImageInputRef}
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length === 0) return;
                  const newItems: MultiImageItem[] = [];
                  let processed = 0;
                  files.forEach((file, idx) => {
                    const rawUrl = URL.createObjectURL(file);
                    const img = new window.Image();
                    img.onload = () => {
                      const aspect = img.naturalWidth / Math.max(1, img.naturalHeight);
                      const offscreen = document.createElement('canvas');
                      offscreen.width = 512;
                      offscreen.height = 512;
                      const ctx = offscreen.getContext('2d');
                      let dataUrl = rawUrl;
                      if (ctx) {
                        ctx.drawImage(img, 0, 0, 512, 512);
                        dataUrl = offscreen.toDataURL('image/jpeg', 0.86);
                        URL.revokeObjectURL(rawUrl);
                      }
                      newItems.push({
                        id: `img-${Date.now()}-${idx}`,
                        name: file.name,
                        url: dataUrl,
                        aspect,
                      });
                      processed++;
                      if (processed === files.length) {
                        // Step 1: Automatically switch to Mode 10 & populate queue
                        addMultiImages(newItems);
                        setFractalMode(10);
                        // Step 2: Automatically run AI Vision + 3D Depth Fractal synthesis
                        void runAiImageTo3DConversion(
                          newItems.map((it) => it.name),
                          newItems.map((it) => it.url),
                          reimagineSeed
                        );
                      }
                    };
                    img.src = rawUrl;
                  });
                  e.target.value = '';
                }}
                className="hidden"
              />
              <button
                type="button"
                data-testid="upload-multi-images-btn"
                onClick={() => multiImageInputRef.current?.click()}
                className="min-h-[42px] py-2 px-3 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Image(s) → Auto 3D</span>
              </button>

              <button
                type="button"
                data-testid="ai-fractalize-images-btn"
                disabled={isAiFractalizing}
                onClick={async () => {
                  const nextSeed = reimagineSeed + 1;
                  setReimagineSeed(nextSeed);
                  await runAiImageTo3DConversion(
                    multiImages.map((m) => m.name),
                    multiImages.map((m) => m.url),
                    nextSeed
                  );
                }}
                className="min-h-[42px] py-2 px-3 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 border border-amber-400/50 text-amber-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {isAiFractalizing ? 'AI 3D Synthesizing...' : 'AI Re-Imagine 3D Structure'}
                </span>
              </button>

              <button
                type="button"
                data-testid="morph-next-image-btn"
                onClick={triggerNextImageTransition}
                className="min-h-[42px] py-2 px-3 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Shuffle className="w-3.5 h-3.5 text-cyan-400" />
                <span>Morph Next Pair ({activeImageIndexA + 1}→{activeImageIndexB + 1})</span>
              </button>
            </div>

            {/* 4 SELECTABLE 3D IMAGE-TO-FRACTAL CONVERSION STYLES */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">
                  4 Selectable 3D Image-to-Fractal Conversion Styles
                </span>
                <span className="font-mono text-[10px] text-cyan-400">
                  Style {String.fromCharCode(65 + img3DStyle)} Active
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {(
                  [
                    {
                      id: 0 as Image3DConversionStyle,
                      badge: 'Style A',
                      title: '3D Raymarched Fractal Relief & KIFS Canyon',
                      desc: 'Extrudes image depth (.a) into a towering 3D KIFS mirror canyon with specular rim lighting.',
                    },
                    {
                      id: 1 as Image3DConversionStyle,
                      badge: 'Style B',
                      title: '3D Image-Mandelbulb & Quaternion Sculpture',
                      desc: 'Maps image color & depth directly into spherical triplex Mandelbulb organic filaments.',
                    },
                    {
                      id: 2 as Image3DConversionStyle,
                      badge: 'Style C',
                      title: '3D Infinite Image Wormhole & Kleinian Cathedral',
                      desc: 'Carves uploaded artwork into infinite curved 3D tunnel walls with neon kick/snare edge veins.',
                    },
                    {
                      id: 3 as Image3DConversionStyle,
                      badge: 'Style D',
                      title: '3D Volumetric Fractal Particle / Splat Nebula',
                      desc: 'Explodes image pixels into a 3D Gaussian-splat point cloud swirling along curl-noise vortices.',
                    },
                  ]
                ).map((st) => {
                  const isSelected = img3DStyle === st.id;
                  return (
                    <button
                      key={st.id}
                      type="button"
                      data-testid={`image-3d-style-${st.id}`}
                      onClick={() => setImg3DStyle(st.id)}
                      className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-950/85 border-cyan-400 text-white shadow-md'
                          : 'bg-zinc-950/75 border-white/10 text-zinc-300 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 text-xs font-bold">
                        <span className="truncate">{st.title}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono shrink-0 ${
                            isSelected
                              ? 'bg-cyan-400 text-zinc-950 font-bold'
                              : 'bg-zinc-800 text-cyan-300'
                          }`}
                        >
                          {st.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-0.5 leading-snug">{st.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Uploaded Multi-Image Queue List */}
            {multiImages.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {multiImages.map((item, idx) => {
                  const isSlotA = idx === activeImageIndexA;
                  const isSlotB = idx === activeImageIndexB && multiImages.length > 1;
                  return (
                    <div
                      key={item.id}
                      className="p-2 rounded-lg bg-zinc-950/90 border border-white/10 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 font-mono text-[10px] text-cyan-300 shrink-0">
                          #{idx + 1}
                          {isSlotA ? ' [A]' : isSlotB ? ' [B]' : ''}
                        </span>
                        <span className="truncate text-zinc-200 font-medium">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveMultiImage(item.id, 'left')}
                          className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveMultiImage(item.id, 'right')}
                          className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeMultiImage(item.id)}
                          className="p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-rose-400"
                          title="Remove Image"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Dedicated Touch Sliders in this Tab: 3D Extrusion Depth, Fractal Folding Complexity, KIFS Fold Angle, Morph Turbulence, Manual Crossfader */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <div className="bg-zinc-950/80 border border-white/10 rounded-lg p-2.5">
                <div className="flex justify-between items-center text-xs mb-1">
                  <label htmlFor="slider-image-depth-3d" className="text-zinc-200 font-medium flex items-center gap-1">
                    <span>3D Extrusion Depth (0%–200%)</span>
                    <SettingTooltip label="3D Depth Relief" description={SETTING_TOOLTIPS.imageDepth3D} />
                  </label>
                  <span className="font-mono text-cyan-400">{Math.round(imageDepth3D * 100)}%</span>
                </div>
                <input
                  id="slider-image-depth-3d"
                  type="range"
                  min={0.0}
                  max={2.0}
                  step={0.05}
                  value={imageDepth3D}
                  onChange={(e) => setShaderParam('imageDepth3D', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div className="bg-zinc-950/80 border border-white/10 rounded-lg p-2.5">
                <div className="flex justify-between items-center text-xs mb-1">
                  <label htmlFor="slider-img-fractal-iter" className="text-zinc-200 font-medium flex items-center gap-1">
                    <span>Fractal Folding Complexity (1–12)</span>
                    <SettingTooltip
                      label="Image Fractal Iterations"
                      description={SETTING_TOOLTIPS.imageFractalizeIterations}
                    />
                  </label>
                  <span className="font-mono text-amber-400">{imageFractalizeIterations} Folds</span>
                </div>
                <input
                  id="slider-img-fractal-iter"
                  type="range"
                  min={1}
                  max={12}
                  step={1}
                  value={imageFractalizeIterations}
                  onChange={(e) =>
                    setShaderParam('imageFractalizeIterations', parseInt(e.target.value, 10))
                  }
                  className="w-full accent-amber-400"
                />
              </div>

              <div className="bg-zinc-950/80 border border-white/10 rounded-lg p-2.5">
                <div className="flex justify-between items-center text-xs mb-1">
                  <label htmlFor="slider-kifs-fold-angle" className="text-zinc-200 font-medium">
                    3D KIFS Mirror Fold Angle
                  </label>
                  <span className="font-mono text-amber-400">{kifsFoldAngle.toFixed(2)} rad</span>
                </div>
                <input
                  id="slider-kifs-fold-angle"
                  type="range"
                  min={0.18}
                  max={1.45}
                  step={0.02}
                  value={kifsFoldAngle}
                  onChange={(e) => setShaderParam('kifsFoldAngle', parseFloat(e.target.value))}
                  className="w-full accent-amber-400"
                />
              </div>

              <div className="bg-zinc-950/80 border border-white/10 rounded-lg p-2.5">
                <div className="flex justify-between items-center text-xs mb-1">
                  <label htmlFor="slider-morph-turbulence" className="text-zinc-200 font-medium flex items-center gap-1">
                    <span>Liquid Morph Turbulence</span>
                    <SettingTooltip
                      label="Morph Turbulence"
                      description={SETTING_TOOLTIPS.imageMorphTurbulence}
                    />
                  </label>
                  <span className="font-mono text-cyan-400">{Math.round(imageMorphTurbulence * 100)}%</span>
                </div>
                <input
                  id="slider-morph-turbulence"
                  type="range"
                  min={0.0}
                  max={1.5}
                  step={0.05}
                  value={imageMorphTurbulence}
                  onChange={(e) => setShaderParam('imageMorphTurbulence', parseFloat(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>

              <div className="bg-zinc-950/80 border border-white/10 rounded-lg p-2.5 sm:col-span-2">
                <div className="flex justify-between items-center text-xs mb-1">
                  <label htmlFor="slider-image-morph-phase" className="text-zinc-200 font-medium">
                    Manual Image A → B 3D Morph Scrub Slider
                  </label>
                  <span className="font-mono text-amber-400">{Math.round(imageMorphPhase * 100)}%</span>
                </div>
                <input
                  id="slider-image-morph-phase"
                  type="range"
                  min={0.0}
                  max={1.0}
                  step={0.02}
                  value={imageMorphPhase}
                  onChange={(e) => {
                    setShaderParam('imageTransitionTrigger', 'manual');
                    setShaderParam('imageMorphPhase', parseFloat(e.target.value));
                  }}
                  className="w-full accent-amber-400"
                />
              </div>
            </div>

            {/* 4 Multi-Image 3D Transition Modes & Trigger Pills */}
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-zinc-300">
                Multi-Image 3D Transition Topology &amp; Beat Trigger
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {(
                  [
                    { id: 'liquid-fbm', label: '1. Liquid FBM Merge' },
                    { id: 'crystal-shatter', label: '2. Crystal Shatter' },
                    { id: 'droste-nest', label: '3. Droste Nesting' },
                    { id: 'kaleido-trap', label: '4. Cross-Fold Trap' },
                  ] as { id: MultiImageBlendMethod; label: string }[]
                ).map((bm) => (
                  <button
                    key={bm.id}
                    type="button"
                    onClick={() => setShaderParam('imageBlendMethod', bm.id)}
                    className={`py-1.5 px-2 rounded border text-[11px] font-semibold transition-colors ${
                      imageBlendMethod === bm.id
                        ? 'bg-cyan-400 text-zinc-950 border-cyan-300 font-bold'
                        : 'bg-zinc-950 border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {bm.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {(
                  [
                    { id: 'smooth-time', label: 'Smooth Time' },
                    { id: 'every-n-bars', label: 'Every 8 Bars' },
                    { id: 'bass-drops', label: 'On Bass Drops' },
                    { id: 'manual', label: 'Manual Scrub' },
                  ] as { id: MultiImageTransitionTrigger; label: string }[]
                ).map((tr) => (
                  <button
                    key={tr.id}
                    type="button"
                    onClick={() => setShaderParam('imageTransitionTrigger', tr.id)}
                    className={`py-1.5 px-2 rounded border text-[11px] font-semibold transition-colors ${
                      imageTransitionTrigger === tr.id
                        ? 'bg-amber-400 text-zinc-950 border-amber-300 font-bold'
                        : 'bg-zinc-950 border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {tr.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. AUDIO TRACK MANAGER (Upload Audio File, Track Info, Built-in Demo Synth Generator) */}
          <div
            data-testid="media-audio-track-manager"
            className="bg-zinc-900/95 border border-amber-400/40 rounded-xl p-3.5 space-y-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                <Music className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Audio Track Manager</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-zinc-950 border border-white/10 text-[10px] font-mono text-zinc-300">
                {audioSourceType === 'file' ? 'Uploaded Audio File' : 'Built-in 124 BPM Synth'}
              </span>
            </div>

            <div className="p-2.5 rounded-lg bg-zinc-950/90 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <div className="font-semibold text-white truncate" title={audioTrackName}>
                  {audioTrackName}
                </div>
                <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                  Duration: {formatTimestamp(trackDuration)} ·{' '}
                  {acousticSummary
                    ? `${acousticSummary.estimatedBpm} BPM · Key: ${acousticSummary.dominantKey}`
                    : '124 BPM'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label
                data-testid="media-upload-audio-btn"
                className="relative overflow-hidden min-h-[40px] py-2 px-3 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Audio (.MP3 / .WAV / .FLAC)</span>
                <input
                  ref={audioInputRef}
                  type="file"
                  accept=".mp3,.wav,.ogg,.flac,.m4a,.aac,.mp4,audio/*"
                  onChange={handleAudioUpload}
                  className="sr-only"
                />
              </label>

              <button
                type="button"
                data-testid="media-use-builtin-synth-btn"
                onClick={() => audioEngine.useBuiltInSynth()}
                className="min-h-[40px] py-2 px-3 bg-zinc-950 hover:bg-zinc-800 border border-white/15 text-zinc-200 font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors"
              >
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>Use Built-in Demo Beat Synth</span>
              </button>
            </div>
          </div>

          {/* 3. SINGLE CUSTOM IMAGE / CHANNEL LOGO STUDIO */}
          <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">Active Image / Emblem Asset</span>
              {userTextureName ? (
                <span className="text-xs text-cyan-400 font-mono truncate max-w-[180px]">
                  {userTextureName}
                </span>
              ) : (
                <span className="text-[11px] font-mono text-amber-300">
                  Built-in Bass Reactor Crest
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="flex-1 min-h-[38px] py-2 px-3 bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-semibold text-xs rounded-lg transition-colors"
              >
                Upload Custom Image / Logo (.PNG, .JPG, .WEBP)
              </button>
              {userTextureName && (
                <button
                  type="button"
                  onClick={() => setUserTexture(null, null, 1.0)}
                  aria-label="Remove Custom Image"
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Mapping Mode Selector: Center Bass Emblem, Zeno Droste PiP, Orbit Trap, 3D Triplanar, or Hybrid Both */}
          <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-zinc-200 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Image &amp; Emblem Projection Mode</span>
              </span>
              <span className="font-mono text-cyan-300 uppercase text-[11px]">
                {textureMappingMode}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'center-emblem', label: 'Center Bass Emblem', sub: 'Medallion + Spectrum Ring' },
                  { id: 'zeno-droste', label: 'Zeno Droste PiP', sub: 'Recursive Halving Spiral' },
                  { id: 'orbit-trap', label: 'Orbit Trap', sub: 'Recursive Fractal Core' },
                  { id: 'triplanar', label: '3D Triplanar', sub: 'World XYZ Surface Wrap' },
                  { id: 'both', label: 'Hybrid Trap + 3D', sub: 'Full Surface + Core' },
                ] as { id: TextureMappingMode; label: string; sub: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  data-testid={`texture-mode-${m.id}`}
                  onClick={() => setShaderParam('textureMappingMode', m.id)}
                  className={`min-h-[46px] p-2 rounded-lg border text-left transition-colors ${
                    textureMappingMode === m.id
                      ? 'bg-zinc-800 border-cyan-400 text-white'
                      : 'bg-zinc-950/60 border-white/10 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="text-xs font-semibold">{m.label}</div>
                  <div className="text-[10px] text-zinc-400">{m.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Bass Nation Emblem Size & Polar Spectrum Ring Bar Count (32 / 64 / 128) */}
          <div className="bg-zinc-900/90 border border-amber-400/35 rounded-lg p-3 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-amber-300">
                Polar Spectrum Ring Bars (Mode 03 &amp; Center Emblem)
              </span>
              <span className="font-mono text-amber-400">{spectrumBarCount} Bars</span>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {([32, 64, 128] as SpectrumBarCount[]).map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  data-testid={`spectrum-bars-${cnt}`}
                  onClick={() => setShaderParam('spectrumBarCount', cnt)}
                  className={`py-1.5 rounded border text-xs font-mono transition-colors ${
                    spectrumBarCount === cnt
                      ? 'bg-amber-400 text-zinc-950 border-amber-300 font-bold'
                      : 'bg-zinc-950 border-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  {cnt} Bars
                </button>
              ))}
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="slider-emblem-size" className="text-zinc-300 font-medium">
                  Center Bass Emblem Medallion Size
                </label>
                <span className="font-mono tabular-nums text-amber-400">
                  {Math.round(emblemSize * 100)}%
                </span>
              </div>
              <input
                id="slider-emblem-size"
                type="range"
                min={0.2}
                max={0.65}
                step={0.02}
                value={emblemSize}
                onChange={(e) => setShaderParam('emblemSize', parseFloat(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>
          </div>

          {/* Texture Opacity, Scale, Trap Radius, Spin Speed, Beat-Pulse Scale */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2.5">
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="slider-tex-mix" className="text-zinc-300 font-medium">
                  Texture Blend Opacity
                </label>
                <span className="font-mono tabular-nums text-cyan-400">
                  {Math.round(textureMix * 100)}%
                </span>
              </div>
              <input
                id="slider-tex-mix"
                type="range"
                min={0.0}
                max={1.0}
                step={0.02}
                value={textureMix}
                onChange={(e) => setShaderParam('textureMix', parseFloat(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2.5">
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="slider-tex-scale" className="text-zinc-300 font-medium">
                  Texture Tiling Scale
                </label>
                <span className="font-mono tabular-nums text-cyan-400">
                  {textureScale.toFixed(2)}x
                </span>
              </div>
              <input
                id="slider-tex-scale"
                type="range"
                min={0.25}
                max={4.0}
                step={0.05}
                value={textureScale}
                onChange={(e) => setShaderParam('textureScale', parseFloat(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2.5">
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="slider-trap-scale" className="text-zinc-300 font-medium">
                  Orbit Trap Capture Radius
                </label>
                <span className="font-mono tabular-nums text-amber-400">
                  {trapScale.toFixed(2)}
                </span>
              </div>
              <input
                id="slider-trap-scale"
                type="range"
                min={0.2}
                max={2.5}
                step={0.05}
                value={trapScale}
                onChange={(e) => setShaderParam('trapScale', parseFloat(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2.5">
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="slider-image-spin" className="text-zinc-300 font-medium">
                  Continuous Spin Velocity
                </label>
                <span className="font-mono tabular-nums text-amber-400">
                  {imageSpinSpeed.toFixed(2)}
                </span>
              </div>
              <input
                id="slider-image-spin"
                type="range"
                min={-2.0}
                max={2.0}
                step={0.05}
                value={imageSpinSpeed}
                onChange={(e) => setShaderParam('imageSpinSpeed', parseFloat(e.target.value))}
                className="w-full accent-amber-400"
              />
            </div>

            <div className="bg-zinc-900/90 border border-white/10 rounded-lg p-2.5 sm:col-span-2">
              <div className="flex justify-between text-xs mb-1">
                <label htmlFor="slider-image-pulse" className="text-zinc-300 font-medium">
                  Kick-Transient Zoom Pulse Intensity
                </label>
                <span className="font-mono tabular-nums text-cyan-400">
                  {Math.round(imageBeatPulse * 100)}%
                </span>
              </div>
              <input
                id="slider-image-pulse"
                type="range"
                min={0.0}
                max={1.5}
                step={0.05}
                value={imageBeatPulse}
                onChange={(e) => setShaderParam('imageBeatPulse', parseFloat(e.target.value))}
                className="w-full accent-cyan-400"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
