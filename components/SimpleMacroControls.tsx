'use client';

import React, { useRef, useState } from 'react';
import {
  Activity,
  Bookmark,
  CircleDot,
  Compass,
  Download,
  Eye,
  FastForward,
  Image as ImageIcon,
  Layers,
  Lock,
  Music,
  Palette,
  Scissors,
  Sliders,
  Sparkles,
  Square,
  Unlock,
  Video,
  Zap,
} from 'lucide-react';
import { transientState, useStudioStore } from '@/lib/store';
import { audioEngine } from '@/lib/audio-engine';
import { COSINE_PALETTE_PRESETS, FRACTAL_MODE_INFO } from '@/lib/presets';
import { FractalMode, MultiImageItem, ZoomDirectionMode } from '@/lib/types';
import {
  evaluateCosinePalette,
  formatTimestamp,
  getSongSectionsWithTimeRanges,
} from '@/lib/dsp-math';
import SettingTooltip from './SettingTooltip';
import { captureCanvasThumbnailDataUrl } from './FractalCanvas';
import {
  formatFileSize,
  startSynchronizedMusicVideoExport,
  stopSynchronizedMusicVideoExport,
} from './VideoExportDrawer';

function hexToRgbNormalized(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return [0.5, 0.5, 0.5];
  return [
    Number((((num >> 16) & 255) / 255).toFixed(2)),
    Number((((num >> 8) & 255) / 255).toFixed(2)),
    Number(((num & 255) / 255).toFixed(2)),
  ];
}

function rgbNormalizedToHex(rgb: [number, number, number]): string {
  const toByte = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * 255)))
      .toString(16)
      .padStart(2, '0');
  return `#${toByte(rgb[0])}${toByte(rgb[1])}${toByte(rgb[2])}`;
}

export default function SimpleMacroControls() {
  const fractalMode = useStudioStore((s) => s.fractalMode);
  const setFractalMode = useStudioStore((s) => s.setFractalMode);
  const autoChoreographyEnabled = useStudioStore((s) => s.autoChoreographyEnabled);
  const setShaderParam = useStudioStore((s) => s.setShaderParam);

  // Macro state values
  const reactivityGain = useStudioStore((s) => s.reactivityGain);
  const cameraSpeed = useStudioStore((s) => s.cameraSpeed);
  const zenoSpeed = useStudioStore((s) => s.zenoSpeed);
  const zoomDirectionMode = useStudioStore((s) => s.zoomDirectionMode);
  const setZoomDirectionMode = useStudioStore((s) => s.setZoomDirectionMode);
  const cameraShakeIntensity = useStudioStore((s) => s.cameraShakeIntensity);
  const clarity = useStudioStore((s) => s.clarity);
  const kaleidoSlices = useStudioStore((s) => s.kaleidoSlices);
  const bloomIntensity = useStudioStore((s) => s.bloomIntensity);
  const textureMix = useStudioStore((s) => s.textureMix);
  const palette = useStudioStore((s) => s.palette);
  const setPalette = useStudioStore((s) => s.setPalette);
  const pitchSynesthesiaEnabled = useStudioStore((s) => s.pitchSynesthesiaEnabled);
  const multiImages = useStudioStore((s) => s.multiImages);
  const addMultiImages = useStudioStore((s) => s.addMultiImages);

  // Macro Setters
  const setMacroReactivity = useStudioStore((s) => s.setMacroReactivity);
  const setMacroSpeed = useStudioStore((s) => s.setMacroSpeed);
  const setMacroScreenShake = useStudioStore((s) => s.setMacroScreenShake);
  const setMacroClarity = useStudioStore((s) => s.setMacroClarity);
  const setMacroTrippySymmetry = useStudioStore((s) => s.setMacroTrippySymmetry);
  const setMacroDepth3DGlow = useStudioStore((s) => s.setMacroDepth3DGlow);
  const setMacroImageFractalMix = useStudioStore((s) => s.setMacroImageFractalMix);
  const aiPsychedelicMutate = useStudioStore((s) => s.aiPsychedelicMutate);
  const saveNewPreset = useStudioStore((s) => s.saveNewPreset);
  const setActiveInspectorTab = useStudioStore((s) => s.setActiveInspectorTab);
  const setControlComplexityMode = useStudioStore((s) => s.setControlComplexityMode);
  const choreographies = useStudioStore((s) => s.choreographies);
  const activeChoreographyIndex = useStudioStore((s) => s.activeChoreographyIndex);
  const trackDuration = useStudioStore((s) => s.trackDuration);
  const exportDurationMode = useStudioStore((s) => s.exportDurationMode);
  const exportResolutionPreset = useStudioStore((s) => s.exportResolutionPreset);
  const exportVideoFormat = useStudioStore((s) => s.exportVideoFormat);
  const isRecording = useStudioStore((s) => s.isRecording);
  const offlineRenderProgress = useStudioStore((s) => s.offlineRenderProgress);
  const renderedSectionsHistory = useStudioStore((s) => s.renderedSectionsHistory);
  const selectSongSectionForExport = useStudioStore((s) => s.selectSongSectionForExport);

  const activeKeyframes = choreographies[activeChoreographyIndex]?.timelineKeyframes ?? [];
  const songSections = getSongSectionsWithTimeRanges(activeKeyframes, trackDuration);

  const audioInputRef = useRef<HTMLInputElement>(null);
  const multiImageInputRef = useRef<HTMLInputElement>(null);
  const [presetFeedback, setPresetFeedback] = useState<string | null>(null);

  // Convert underlying shader params to clean 0-300%, 0-200%, or 0-100% display values
  const reactivityPercent = Math.round((reactivityGain / 1.0) * 100);
  const speedPercent = Math.round((cameraSpeed / 1.0) * 100);
  const zoomPercent = Math.round((zenoSpeed / 1.0) * 100);
  const shakePercent = Math.min(100, Math.round((cameraShakeIntensity / 2.0) * 100));
  const clarityPercent = Math.min(200, Math.max(0, Math.round(clarity * 100)));
  const symmetryPercent =
    kaleidoSlices <= 1 ? 0 : Math.min(100, Math.round(((kaleidoSlices - 2) / 22) * 100));
  const depthGlowPercent = Math.min(
    100,
    Math.max(0, Math.round(((bloomIntensity - 0.6) / 1.8) * 100))
  );
  const imageMixPercent = Math.round(textureMix * 100);

  const audioTrackName = useStudioStore((s) => s.audioTrackName);
  const audioSourceType = useStudioStore((s) => s.audioSourceType);
  const isPlaying = useStudioStore((s) => s.isPlaying);
  const [musicUploadFeedback, setMusicUploadFeedback] = useState<string | null>(null);

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMusicUploadFeedback(`Loading "${file.name}"...`);
    await audioEngine.loadAudioFile(file);
    setMusicUploadFeedback(`Loaded "${file.name}"`);
    window.setTimeout(() => setMusicUploadFeedback(null), 4000);
  };

  const applyAiImageFractalProfile = useStudioStore((s) => s.applyAiImageFractalProfile);

  const handleMultiImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newItems: MultiImageItem[] = [];
    let processed = 0;
    const capped = files.slice(0, 12);

    capped.forEach((file, idx) => {
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
        if (processed === capped.length) {
          addMultiImages(newItems);
          setFractalMode(10);
          void fetch('/api/ai-fractalize-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageNames: newItems.map((it) => it.name),
              imageDataUrls: newItems.slice(0, 3).map((it) => it.url),
            }),
          })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
              if (data) {
                applyAiImageFractalProfile(data.profile ?? data);
              }
            })
            .catch(() => {});
        }
      };
      img.src = rawUrl;
    });
    e.target.value = '';
  };

  const handleOneTapSavePreset = () => {
    const thumb = captureCanvasThumbnailDataUrl(160, 90);
    const modeShort = FRACTAL_MODE_INFO[fractalMode]?.shortName ?? 'Visualizer';
    const created = saveNewPreset(`${modeShort} Macro`, 'User Custom', thumb);
    setPresetFeedback(`Saved "${created.name}"`);
    window.setTimeout(() => setPresetFeedback(null), 2200);
  };

  return (
    <div
      data-testid="simple-macro-controls"
      data-hud-interactive="true"
      className="space-y-3 text-slate-100"
    >
      {/* Active Uploaded Music Banner */}
      <div
        data-testid="simple-active-music-banner"
        className={`p-2 rounded-xl border flex items-center justify-between gap-2 text-xs ${
          audioSourceType === 'file'
            ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-100'
            : 'bg-white/[0.03] border-white/10 text-slate-300'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Music className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-white truncate" title={audioTrackName}>
              {musicUploadFeedback || audioTrackName}
            </div>
            <div className="text-[10px] font-mono text-cyan-300">
              {audioSourceType === 'file' ? 'Custom Uploaded Song' : 'Built-in 124 BPM Bass Synth'} · {formatTimestamp(trackDuration)} · {isPlaying ? 'Playing' : 'Paused'}
            </div>
          </div>
        </div>
        <label
          data-testid="simple-top-upload-music-label"
          className="relative overflow-hidden px-2.5 py-1.5 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-bold text-[11px] flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
        >
          <Music className="w-3 h-3 shrink-0" />
          <span>{audioSourceType === 'file' ? 'Change Song' : 'Upload Song'}</span>
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac,.mp4"
            onChange={handleAudioUpload}
            className="sr-only"
          />
        </label>
      </div>

      {/* 1) Visualizer Style Carousel + Lock 1 Mode / Auto-Switch Toggle */}
      <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold text-white">
              Visualizer Engine ({fractalMode + 1}/26)
            </span>
            <SettingTooltip
              settingKey="autoChoreography"
              label="Visualizer Engine & Mode Lock"
            />
          </div>

          <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-lg border border-white/10">
            <button
              type="button"
              data-testid="simple-lock-mode-btn"
              onClick={() => setShaderParam('autoChoreographyEnabled', false)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                !autoChoreographyEnabled
                  ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Lock className="w-2.5 h-2.5" />
              <span>Lock 1 Mode</span>
            </button>
            <button
              type="button"
              data-testid="simple-auto-switch-btn"
              onClick={() => setShaderParam('autoChoreographyEnabled', true)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                autoChoreographyEnabled
                  ? 'bg-amber-500/25 text-amber-200 border border-amber-400/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Unlock className="w-2.5 h-2.5" />
              <span>Auto-Switch</span>
            </button>
          </div>
        </div>

        {/* Horizontal Carousel of 26 Visualizer Modes (Mode 25 Featured First) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {[...FRACTAL_MODE_INFO]
            .sort((a, b) => (b.id === 25 ? 1 : 0) - (a.id === 25 ? 1 : 0))
            .map((m) => {
              const active = fractalMode === m.id;
              const isOverdrive = m.id === 25;
              return (
                <button
                  key={m.id}
                  type="button"
                  data-testid={`simple-mode-pill-${m.id}`}
                  onClick={() => setFractalMode(m.id as FractalMode)}
                  className={`shrink-0 px-2.5 py-1.5 rounded-lg text-left border transition-all cursor-pointer ${
                    active
                      ? 'bg-gradient-to-r from-amber-500/30 to-cyan-500/25 border-amber-400 text-white shadow-[0_0_14px_rgba(245,158,11,0.35)]'
                      : isOverdrive
                        ? 'bg-gradient-to-r from-cyan-950/80 to-amber-950/60 hover:from-cyan-900/80 border-cyan-400/60 text-cyan-100 shadow-[0_0_10px_rgba(34,211,238,0.2)]'
                        : 'bg-black/40 hover:bg-white/[0.06] border-white/10 text-slate-300'
                  }`}
                >
                  <div className="text-[11px] font-bold whitespace-nowrap">{m.shortName}</div>
                  <div
                    className={`text-[9px] font-mono ${
                      isOverdrive ? 'text-cyan-300 font-bold' : 'text-amber-300/80'
                    }`}
                  >
                    {m.badge}
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {/* 2) Single-Column Grid of 8 High-Impact Macro Sliders */}
      <div
        data-testid="simple-macro-sliders-grid"
        className="grid grid-cols-1 gap-2.5"
      >
        {/* MACRO 1: Reactivity (0% - 300%) */}
        <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="macro-reactivity-input"
              className="flex items-center gap-1.5 text-xs font-bold text-white"
            >
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>1. Reactivity</span>
              <SettingTooltip settingKey="macroReactivity" label="Reactivity (Musical Punch)" />
            </label>
            <span className="font-mono text-xs font-bold text-amber-300 tabular-nums">
              {reactivityPercent}%
            </span>
          </div>
          <input
            id="macro-reactivity-input"
            type="range"
            data-testid="macro-slider-reactivity"
            min={0}
            max={300}
            step={5}
            value={reactivityPercent}
            onChange={(e) => setMacroReactivity(Number(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none bg-slate-800 accent-amber-400 cursor-pointer"
          />
        </div>

        {/* MACRO 2: Speed (0% - 300%) */}
        <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="macro-speed-input"
              className="flex items-center gap-1.5 text-xs font-bold text-white"
            >
              <FastForward className="w-3.5 h-3.5 text-cyan-400" />
              <span>2. Speed</span>
              <SettingTooltip settingKey="macroSpeed" label="Speed (Flight & Rotation)" />
            </label>
            <span className="font-mono text-xs font-bold text-cyan-300 tabular-nums">
              {speedPercent}%
            </span>
          </div>
          <input
            id="macro-speed-input"
            type="range"
            data-testid="macro-slider-speed"
            min={0}
            max={300}
            step={5}
            value={speedPercent}
            onChange={(e) => setMacroSpeed(Number(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none bg-slate-800 accent-cyan-400 cursor-pointer"
          />
        </div>

        {/* MACRO 3: Zoom Direction & Velocity */}
        <div
          data-testid="macro-control-zoom"
          className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2"
        >
          <div className="flex items-center justify-between">
            <label
              htmlFor="macro-zoom-input"
              className="flex items-center gap-1.5 text-xs font-bold text-white"
            >
              <Compass className="w-3.5 h-3.5 text-purple-400" />
              <span>3. Zoom</span>
              <SettingTooltip settingKey="macroZoomDirection" label="Zoom Direction & Rate" />
            </label>
            <span className="font-mono text-xs font-bold text-purple-300 tabular-nums">
              {zoomPercent}% ({zoomDirectionMode.toUpperCase()})
            </span>
          </div>
          <input
            id="macro-zoom-input"
            type="range"
            data-testid="macro-slider-zoom"
            min={10}
            max={300}
            step={5}
            value={zoomPercent}
            onChange={(e) => {
              const norm = Number(e.target.value) / 100;
              setShaderParam('zenoSpeed', Number(norm.toFixed(2)));
              transientState.cameraZoomSpeed = Math.max(0.35, Math.min(2.5, norm));
            }}
            className="w-full h-2 rounded-lg appearance-none bg-slate-800 accent-purple-400 cursor-pointer"
          />
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'inward', label: 'Inward Dive (+1)' },
                { id: 'outward', label: 'Outward Emerge (-1)' },
                { id: 'pendulum', label: 'Beat-Pulse Pendulum' },
              ] as { id: ZoomDirectionMode; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                data-testid={`zoom-dir-${opt.id}`}
                onClick={() => setZoomDirectionMode(opt.id)}
                className={`py-1.5 px-2 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                  zoomDirectionMode === opt.id
                    ? 'bg-purple-500/25 text-purple-200 border-purple-400/60'
                    : 'bg-black/40 text-slate-400 border-white/10 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* MACRO 4: Screen Shake (0% - 100%) */}
        <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="macro-shake-input"
              className="flex items-center gap-1.5 text-xs font-bold text-white"
            >
              <Zap className="w-3.5 h-3.5 text-rose-400" />
              <span>4. Screen Shake</span>
              <SettingTooltip settingKey="macroScreenShake" label="Sub-Bass Screen Shake" />
            </label>
            <span className="font-mono text-xs font-bold text-rose-300 tabular-nums">
              {shakePercent}%
            </span>
          </div>
          <input
            id="macro-shake-input"
            type="range"
            data-testid="macro-slider-shake"
            min={0}
            max={100}
            step={1}
            value={shakePercent}
            onChange={(e) => setMacroScreenShake(Number(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none bg-slate-800 accent-rose-400 cursor-pointer"
          />
        </div>

        {/* MACRO 5: Clarity & Edge Sharpness (0% - 200%) */}
        <div className="p-2.5 rounded-xl bg-white/[0.03] border border-cyan-400/25 space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="macro-clarity-input"
              className="flex items-center gap-1.5 text-xs font-bold text-white"
            >
              <Eye className="w-3.5 h-3.5 text-cyan-300" />
              <span>5. Clarity &amp; Edge Sharpness</span>
              <SettingTooltip
                settingKey="macroClarity"
                label="Clarity & Edge Contrast Booster (u_clarity)"
              />
            </label>
            <span className="font-mono text-xs font-bold text-cyan-300 tabular-nums">
              {clarityPercent}%
            </span>
          </div>
          <input
            id="macro-clarity-input"
            type="range"
            data-testid="macro-slider-clarity"
            min={0}
            max={200}
            step={5}
            value={clarityPercent}
            onChange={(e) => setMacroClarity(Number(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none bg-slate-800 accent-cyan-300 cursor-pointer"
          />
        </div>

        {/* MACRO 6: Trippy Symmetry (0% - 100%) */}
        <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="macro-symmetry-input"
              className="flex items-center gap-1.5 text-xs font-bold text-white"
            >
              <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
              <span>6. Trippy Symmetry</span>
              <SettingTooltip settingKey="macroTrippySymmetry" label="Trippy Mandala Symmetry" />
            </label>
            <span className="font-mono text-xs font-bold text-fuchsia-300 tabular-nums">
              {symmetryPercent}% ({kaleidoSlices === 1 ? 'Off' : `${kaleidoSlices}-Fold`})
            </span>
          </div>
          <input
            id="macro-symmetry-input"
            type="range"
            data-testid="macro-slider-symmetry"
            min={0}
            max={100}
            step={1}
            value={symmetryPercent}
            onChange={(e) => setMacroTrippySymmetry(Number(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none bg-slate-800 accent-fuchsia-400 cursor-pointer"
          />
        </div>

        {/* MACRO 7: 3D Depth & Glow (0% - 100%) */}
        <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="macro-depth-glow-input"
              className="flex items-center gap-1.5 text-xs font-bold text-white"
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>7. 3D Depth &amp; Glow</span>
              <SettingTooltip settingKey="macroDepth3DGlow" label="3D Extrusion Depth & Glow" />
            </label>
            <span className="font-mono text-xs font-bold text-emerald-300 tabular-nums">
              {depthGlowPercent}%
            </span>
          </div>
          <input
            id="macro-depth-glow-input"
            type="range"
            data-testid="macro-slider-depth-glow"
            min={0}
            max={100}
            step={1}
            value={depthGlowPercent}
            onChange={(e) => setMacroDepth3DGlow(Number(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none bg-slate-800 accent-emerald-400 cursor-pointer"
          />
        </div>

        {/* MACRO 8: Image Fractal Intensity (0% - 100%) */}
        <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="macro-image-mix-input"
              className="flex items-center gap-1.5 text-xs font-bold text-white"
            >
              <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
              <span>8. Image Fractal Intensity</span>
              <SettingTooltip
                settingKey="macroImageFractalMix"
                label="Image-Fractal 3D Relief Intensity"
              />
            </label>
            <span className="font-mono text-xs font-bold text-sky-300 tabular-nums">
              {imageMixPercent}% ({multiImages.length || 'Built-In'} img)
            </span>
          </div>
          <input
            id="macro-image-mix-input"
            type="range"
            data-testid="macro-slider-image-mix"
            min={0}
            max={100}
            step={1}
            value={imageMixPercent}
            onChange={(e) => setMacroImageFractalMix(Number(e.target.value))}
            className="w-full h-2 rounded-lg appearance-none bg-slate-800 accent-sky-400 cursor-pointer"
          />
        </div>

        {/* MACRO 9: Color Vibe Picker (24 Built-In Palettes + Pitch Rainbow Toggle) */}
        <div
          data-testid="macro-control-color"
          className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Palette className="w-3.5 h-3.5 text-amber-400" />
              <span>9. Color Vibe Picker ({COSINE_PALETTE_PRESETS.length} Palettes)</span>
              <SettingTooltip settingKey="macroColorVibe" label="Harmonic Color Vibe & Tint" />
            </div>

            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-300 cursor-pointer">
                <span>Custom Tint</span>
                <input
                  type="color"
                  data-testid="macro-color-picker-input"
                  value={rgbNormalizedToHex(palette.a)}
                  onChange={(e) => {
                    const nextA = hexToRgbNormalized(e.target.value);
                    setPalette({ ...palette, a: nextA });
                  }}
                  className="w-6 h-5 rounded border border-white/20 bg-transparent cursor-pointer"
                />
              </label>

              <button
                type="button"
                data-testid="macro-pitch-rainbow-toggle"
                onClick={() =>
                  setShaderParam('pitchSynesthesiaEnabled', !pitchSynesthesiaEnabled)
                }
                className={`px-2 py-1 rounded-md text-[10px] font-bold border transition-all cursor-pointer ${
                  pitchSynesthesiaEnabled
                    ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400/50'
                    : 'bg-black/40 text-slate-400 border-white/10'
                }`}
              >
                12-Tone Pitch Rainbow: {pitchSynesthesiaEnabled ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-56 overflow-y-auto pr-1">
            {COSINE_PALETTE_PRESETS.map((preset) => {
              const stops = [0.1, 0.45, 0.8].map((t) => {
                const [r, g, b] = evaluateCosinePalette(t, preset.palette);
                return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
              });
              return (
                <button
                  key={preset.id}
                  type="button"
                  data-testid={`macro-palette-chip-${preset.id}`}
                  onClick={() => setPalette(preset.palette)}
                  className="flex items-center gap-2 p-1.5 rounded-lg bg-black/45 hover:bg-white/[0.08] border border-white/10 text-left transition-all cursor-pointer"
                >
                  <span
                    className="w-5 h-5 rounded-md shrink-0 border border-white/20"
                    style={{ background: `linear-gradient(135deg, ${stops.join(', ')})` }}
                  />
                  <span className="text-[10px] font-semibold text-slate-200 truncate">
                    {preset.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2.5) Quick Render Song Section Individually (Intro / Buildup / Drop / Breakdown / Outro) */}
      <div
        data-testid="simple-song-sections-export-bar"
        className="p-2.5 rounded-xl bg-emerald-500/[0.08] border border-emerald-400/35 space-y-2"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Scissors className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs font-bold text-white">
              Render Song Section Individually (Safe Part-by-Part Export)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveInspectorTab('export')}
            className="text-[10px] font-mono text-amber-300 hover:underline cursor-pointer"
          >
            Custom Trim &amp; Resolution ({exportResolutionPreset.toUpperCase()}) →
          </button>
        </div>

        {/* Inline Live Progress Bar when rendering any song section */}
        {(offlineRenderProgress.active || isRecording) && (
          <div
            data-testid="simple-section-render-active-banner"
            className="p-2.5 rounded-lg bg-zinc-950/90 border border-emerald-400/50 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
              <span className="text-emerald-300 font-bold truncate">
                {offlineRenderProgress.statusLabel || 'Rendering song section...'}
              </span>
              <span className="text-amber-300 font-bold shrink-0">
                {offlineRenderProgress.percent}%
              </span>
            </div>
            <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 via-cyan-400 to-amber-400 transition-all duration-150"
                style={{ width: `${Math.max(2, offlineRenderProgress.percent)}%` }}
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-[10px] font-mono text-zinc-300">
              <span>
                Frame {offlineRenderProgress.currentFrame} / {offlineRenderProgress.totalFrames} ·{' '}
                {offlineRenderProgress.fpsSpeed} fps
              </span>
              <button
                type="button"
                onClick={() => stopSynchronizedMusicVideoExport()}
                className="px-2 py-0.5 rounded bg-rose-500/25 hover:bg-rose-500/35 border border-rose-400/50 text-rose-200 font-bold flex items-center gap-1 cursor-pointer"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                <span>Stop</span>
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
          {songSections.map((sec, idx) => {
            const isSelected = exportDurationMode === sec.modeId;
            const renderedRecord = renderedSectionsHistory.find((r) => r.modeId === sec.modeId);
            const isRenderingThis =
              (offlineRenderProgress.active || isRecording) && isSelected;
            return (
              <div
                key={sec.modeId}
                className={`p-2 rounded-lg border transition-all flex flex-col justify-between gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-500/20 border-emerald-400/75 text-white shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                    : 'bg-black/45 hover:bg-white/[0.06] border-white/10 text-slate-200'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[9px] font-mono font-bold uppercase text-emerald-300">
                      Part {idx + 1}
                    </span>
                    <span className="text-[9px] font-mono text-amber-300">
                      {formatTimestamp(sec.startSec)}–{formatTimestamp(sec.endSec)}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white truncate mt-0.5">{sec.section}</div>
                  <div className="text-[9px] font-mono text-slate-400">
                    {Math.round(sec.durationSec)}s clip
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isRecording || offlineRenderProgress.active}
                  data-testid={`simple-render-section-${sec.section.toLowerCase()}`}
                  onClick={() => {
                    selectSongSectionForExport(sec.modeId, sec.startSec, sec.endSec);
                    audioEngine.seekToTime(sec.startSec);
                    startSynchronizedMusicVideoExport(
                      exportResolutionPreset,
                      sec.modeId,
                      exportVideoFormat
                    );
                  }}
                  className="w-full py-1 px-1.5 rounded bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-zinc-950 font-bold text-[10px] flex items-center justify-center gap-1 cursor-pointer"
                >
                  <CircleDot className="w-2.5 h-2.5 shrink-0" />
                  <span>{isRenderingThis ? 'Rendering...' : `Render ${sec.section}`}</span>
                </button>

                {renderedRecord && (
                  <a
                    href={renderedRecord.url}
                    download={renderedRecord.filename}
                    className="w-full py-0.5 px-1.5 rounded bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-bold text-[9px] flex items-center justify-center gap-1"
                  >
                    <Download className="w-2.5 h-2.5 shrink-0" />
                    <span>Save ({formatFileSize(renderedRecord.blobSize)})</span>
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3) One-Tap Quick Action Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 pt-1">
        <label
          data-testid="simple-action-upload-music"
          className="relative overflow-hidden flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-400/40 text-cyan-200 text-xs font-bold cursor-pointer"
        >
          <Music className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{musicUploadFeedback || 'Upload Music'}</span>
          <input
            type="file"
            accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac,.mp4"
            onChange={handleAudioUpload}
            className="sr-only"
          />
        </label>

        <label
          data-testid="simple-action-upload-images"
          className="relative overflow-hidden flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/40 text-sky-200 text-xs font-bold cursor-pointer"
        >
          <ImageIcon className="w-3.5 h-3.5 shrink-0" />
          <span>Upload Images</span>
          <input
            ref={multiImageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleMultiImageUpload}
            className="sr-only"
          />
        </label>

        <button
          type="button"
          data-testid="simple-action-ai-autotune"
          onClick={aiPsychedelicMutate}
          className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-400/45 text-purple-200 text-xs font-bold cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>AI Auto-Tune</span>
        </button>

        <button
          type="button"
          data-testid="simple-action-save-preset"
          onClick={handleOneTapSavePreset}
          className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/45 text-amber-200 text-xs font-bold cursor-pointer"
        >
          <Bookmark className="w-3.5 h-3.5" />
          <span>{presetFeedback || 'Save Preset'}</span>
        </button>

        <button
          type="button"
          data-testid="simple-action-export-video"
          onClick={() => setActiveInspectorTab('export')}
          className="col-span-2 sm:col-span-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/50 text-emerald-200 text-xs font-bold cursor-pointer"
        >
          <Video className="w-3.5 h-3.5" />
          <span>Export Video</span>
        </button>
      </div>

      {/* Switch to Advanced Studio Fine-Tuned Tabs CTA */}
      <div className="pt-1 flex justify-end">
        <button
          type="button"
          data-testid="unlock-advanced-studio-btn"
          onClick={() => setControlComplexityMode('advanced')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[11px] font-semibold text-slate-300 cursor-pointer"
        >
          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
          <span>Open Advanced Fine-Tuned Studio (6 Tabs) →</span>
        </button>
      </div>
    </div>
  );
}
