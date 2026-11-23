'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Upload,
  Zap,
  Volume2,
  Compass,
  Video,
  Square,
  Tv,
  Activity,
  Music,
  Cpu,
  Sliders,
  Eye,
  EyeOff,
  Download,
} from 'lucide-react';
import { FRACTAL_MODE_INFO } from '@/lib/presets';
import { audioEngine } from '@/lib/audio-engine';
import { formatTimestamp } from '@/lib/dsp-math';
import { transientState, useStudioStore } from '@/lib/store';
import { FractalMode, StudioInspectorTab } from '@/lib/types';
import {
  startSynchronizedMusicVideoExport,
  stopSynchronizedMusicVideoExport,
} from './VideoExportDrawer';

/**
 * Top Bar (Strict 3-Zone Contract: Brand Wordmark | 5 Single-Line Pro VJ Tab Links | 1 Primary CTA)
 */
export default function StudioHud() {
  const isPlaying = useStudioStore((s) => s.isPlaying);
  const activeInspectorTab = useStudioStore((s) => s.activeInspectorTab);
  const setActiveInspectorTab = useStudioStore((s) => s.setActiveInspectorTab);

  const navItems: { id: StudioInspectorTab; label: string }[] = [
    { id: 'modes', label: '1. Modes & Worlds' },
    { id: 'geometry', label: '2. 4D & Geometry' },
    { id: 'audio', label: '3. Bass & Audio' },
    { id: 'fx', label: '4. Psychedelic FX' },
    { id: 'image', label: '5. Image & Emblem' },
    { id: 'export', label: '6. AI & Export' },
  ];

  return (
    <header
      data-hud-interactive="true"
      className="shrink-0 flex items-center justify-between gap-8 px-5 py-3 bg-zinc-950 border-b border-white/10 text-zinc-100"
    >
      {/* Zone 1: Single text element wordmark */}
      <a
        href="#studio"
        onClick={(e) => {
          e.preventDefault();
          setActiveInspectorTab('export');
        }}
        className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0"
      >
        ChromaFract Studio
      </a>

      {/* Zone 2: 5 concise single-line text navigation links */}
      <nav
        aria-label="Studio Workspace Controls"
        className="hidden md:flex items-center gap-6 text-sm font-medium text-zinc-300"
      >
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveInspectorTab(item.id)}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 ${
              activeInspectorTab === item.id ? 'text-amber-400 underline' : ''
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={() => audioEngine.togglePlayPause()}
          className="px-4 py-2 text-xs font-semibold text-zinc-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
        >
          {isPlaying ? (
            <>
              <Pause className="w-3.5 h-3.5 fill-current" />
              <span>Pause Audio</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Play Synesthetic Audio</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
}

/**
 * Header bar inside the dedicated Video Preview Monitor Window.
 */
export function PreviewWindowHeader() {
  const aspectRatio = useStudioStore((s) => s.aspectRatio);
  const setAspectRatio = useStudioStore((s) => s.setAspectRatio);
  const previewResolutionCap = useStudioStore((s) => s.previewResolutionCap);
  const exportResolutionPreset = useStudioStore((s) => s.exportResolutionPreset);
  const liveFps = useStudioStore((s) => s.liveFps);
  const isRecording = useStudioStore((s) => s.isRecording);
  const recordingSeconds = useStudioStore((s) => s.recordingSeconds);
  const trackDuration = useStudioStore((s) => s.trackDuration);
  const exportRenderBackend = useStudioStore((s) => s.exportRenderBackend);
  const setExportRenderBackend = useStudioStore((s) => s.setExportRenderBackend);
  const activeInspectorTab = useStudioStore((s) => s.activeInspectorTab);
  const setActiveInspectorTab = useStudioStore((s) => s.setActiveInspectorTab);
  const setShaderParam = useStudioStore((s) => s.setShaderParam);
  const triggerBeatBang = useStudioStore((s) => s.triggerBeatBang);
  const showXyPads = useStudioStore((s) => s.showXyPads);
  const setShowXyPads = useStudioStore((s) => s.setShowXyPads);
  const fractalMode = useStudioStore((s) => s.fractalMode);
  const lastExportUrl = useStudioStore((s) => s.lastExportUrl);
  const lastExportFilename = useStudioStore((s) => s.lastExportFilename);
  const setExportCompleteModalOpen = useStudioStore((s) => s.setExportCompleteModalOpen);
  const isPreviewHidden = useStudioStore((s) => s.isPreviewHidden);
  const togglePreviewHidden = useStudioStore((s) => s.togglePreviewHidden);

  const headerAudioInputRef = useRef<HTMLInputElement>(null);

  const [spikeReadout, setSpikeReadout] = useState({
    spike: 0,
    intensity: 0,
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      setSpikeReadout({
        spike: Number(transientState.fractalSpike.toFixed(2)),
        intensity: Number(transientState.audioIntensity.toFixed(2)),
      });
    }, 125);
    return () => window.clearInterval(id);
  }, []);

  const handleHeaderAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await audioEngine.loadAudioFile(file);
  };

  const cycleAspectRatio = () => {
    if (aspectRatio === '16:9') setAspectRatio('9:16');
    else if (aspectRatio === '9:16') setAspectRatio('1:1');
    else setAspectRatio('16:9');
  };

  const isSilentStill = spikeReadout.intensity < 0.04 && spikeReadout.spike < 0.05;
  const activeModeLabel = FRACTAL_MODE_INFO[fractalMode]?.shortName ?? '01. 4D Tesseract';

  return (
    <div
      data-hud-interactive="true"
      className="shrink-0 flex items-center justify-between gap-1.5 px-2.5 py-1.5 bg-zinc-900 border-b border-white/10 text-xs text-zinc-200 overflow-x-auto no-scrollbar"
    >
      <div className="flex items-center gap-1.5 shrink-0">
        {activeInspectorTab !== 'modes' && (
          <button
            type="button"
            data-testid="header-home-btn"
            onClick={() => setActiveInspectorTab('modes')}
            className="px-2 py-0.5 rounded bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold text-[11px] flex items-center gap-1 transition-colors shrink-0"
          >
            <span>← Home</span>
          </button>
        )}

        <span className="font-semibold text-white flex items-center gap-1 min-w-0">
          <Tv className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="hidden md:inline shrink-0">Live Preview:</span>
          <span className="text-amber-300 text-[11px] font-mono truncate max-w-[96px] sm:max-w-none">
            {activeModeLabel}
          </span>
        </span>

        <button
          type="button"
          onClick={cycleAspectRatio}
          className="px-1.5 py-0.5 bg-zinc-950 hover:bg-zinc-800 border border-white/15 rounded font-mono tabular-nums text-[10px] text-amber-400 transition-colors shrink-0"
        >
          {aspectRatio}
        </button>

        <button
          type="button"
          onClick={() =>
            setShaderParam(
              'previewResolutionCap',
              previewResolutionCap === '1080p' ? '720p' : '1080p'
            )
          }
          title="Toggle Preview Window Resolution Cap (1080p or 720p) for fluid 60 FPS editing"
          className="hidden sm:inline-flex px-2 py-0.5 bg-zinc-950 hover:bg-zinc-800 border border-white/15 rounded font-mono tabular-nums text-[10px] text-cyan-400 transition-colors shrink-0"
        >
          DRS: {previewResolutionCap} · {liveFps} FPS
        </button>

        <button
          type="button"
          data-testid="header-offload-toggle"
          onClick={() => {
            setExportRenderBackend(
              exportRenderBackend === 'offline-deterministic'
                ? 'offloaded-rVFC'
                : 'offline-deterministic'
            );
            setActiveInspectorTab('export');
          }}
          title="Toggle Zero-Lag Deterministic Offline Frame-by-Frame Renderer vs Live Clip Capture"
          className={`hidden xl:inline-flex px-2 py-0.5 rounded border font-mono text-[10px] items-center gap-1 transition-colors shrink-0 ${
            exportRenderBackend === 'offline-deterministic'
              ? 'bg-emerald-950/70 border-emerald-400 text-emerald-300'
              : 'bg-cyan-950/70 border-cyan-400 text-cyan-300'
          }`}
        >
          <Cpu className="w-3 h-3" />
          <span>
            {exportRenderBackend === 'offline-deterministic'
              ? 'Offline WebCodecs: ON'
              : 'Live rVFC Capture'}
          </span>
        </button>
      </div>

      {/* Right Quick Actions (Compact 1-row on mobile so it never steals canvas height) */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        <label
          data-testid="header-upload-music-label"
          className="relative overflow-hidden px-2 py-0.5 bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-semibold rounded text-[11px] flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Music className="w-3 h-3" />
          <span className="hidden sm:inline">Upload Music</span>
          <span className="sm:hidden">Music</span>
          <input
            ref={headerAudioInputRef}
            type="file"
            accept=".mp3,.wav,.ogg,.flac,.m4a,.aac,.mp4,audio/*"
            onChange={handleHeaderAudioUpload}
            className="sr-only"
          />
        </label>

        <button
          type="button"
          data-testid="header-toggle-preview-btn"
          onClick={togglePreviewHidden}
          title={
            isPreviewHidden
              ? 'Show Render Preview Window'
              : 'Hide Render Preview Window (Also works while rendering video)'
          }
          className={`px-2 py-0.5 rounded border text-[11px] font-semibold flex items-center gap-1 transition-colors shrink-0 cursor-pointer ${
            isPreviewHidden
              ? 'bg-cyan-400 text-zinc-950 border-cyan-300 font-bold'
              : 'bg-zinc-950 hover:bg-zinc-800 border-cyan-400/40 text-cyan-300'
          }`}
        >
          {isPreviewHidden ? (
            <>
              <Eye className="w-3 h-3" />
              <span>Show Preview</span>
            </>
          ) : (
            <>
              <EyeOff className="w-3 h-3" />
              <span className="hidden sm:inline">Hide Preview</span>
              <span className="sm:hidden">Hide</span>
            </>
          )}
        </button>

        <button
          type="button"
          data-testid="toggle-xy-pads-btn"
          onClick={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 1024) {
              setActiveInspectorTab('geometry');
            } else {
              setShowXyPads(!showXyPads);
            }
          }}
          className={`px-2 py-0.5 rounded border text-[11px] font-medium flex items-center gap-1 transition-colors shrink-0 ${
            showXyPads || activeInspectorTab === 'geometry'
              ? 'bg-amber-400 text-zinc-950 border-amber-300 font-semibold'
              : 'bg-zinc-950 hover:bg-zinc-800 border-white/15 text-zinc-200'
          }`}
        >
          <Sliders className="w-3 h-3" />
          <span className="hidden sm:inline">Fine Tune / XY</span>
          <span className="sm:hidden">Tune</span>
        </button>

        <div
          className="hidden 2xl:flex items-center gap-1.5 px-2 py-0.5 bg-zinc-950 border border-white/10 rounded font-mono tabular-nums text-[10px]"
          title="Dynamic Silence-to-Peak Reactivity"
        >
          <Activity className="w-3 h-3 text-amber-400" />
          {isSilentStill ? (
            <span className="text-zinc-400">Silent: Still</span>
          ) : (
            <span className="text-amber-300">Spike: {spikeReadout.spike.toFixed(2)}x</span>
          )}
        </div>

        <button
          type="button"
          onClick={triggerBeatBang}
          className="hidden sm:inline-flex px-2 py-0.5 bg-zinc-950 hover:bg-zinc-800 border border-white/15 rounded text-[11px] font-medium text-zinc-200 items-center gap-1 transition-colors shrink-0"
        >
          <Zap className="w-3 h-3 text-amber-400" />
          <span>Bang</span>
        </button>

        {!isRecording ? (
          <>
            {lastExportUrl && lastExportFilename && (
              <button
                type="button"
                data-testid="header-save-video-btn"
                onClick={() => setExportCompleteModalOpen(true)}
                className="px-2 py-0.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 font-bold rounded text-[11px] flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
              >
                <Download className="w-3 h-3" />
                <span>Save Video</span>
              </button>
            )}
            <button
              type="button"
              data-testid="header-render-video-btn"
              onClick={() => {
                startSynchronizedMusicVideoExport(exportResolutionPreset);
              }}
              className="px-2 py-0.5 bg-emerald-400 hover:bg-emerald-300 text-zinc-950 font-semibold rounded text-[11px] flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
            >
              <Video className="w-3 h-3" />
              <span className="hidden sm:inline">Render {exportResolutionPreset.toUpperCase()}</span>
              <span className="sm:hidden">Render</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => stopSynchronizedMusicVideoExport()}
            className="px-2 py-0.5 bg-rose-500 hover:bg-rose-400 text-white font-semibold font-mono tabular-nums rounded text-[11px] flex items-center gap-1 transition-colors whitespace-nowrap shrink-0"
          >
            <Square className="w-2.5 h-2.5 fill-current" />
            <span>
              Stop ({formatTimestamp(recordingSeconds)}/{formatTimestamp(trackDuration)})
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Bottom 6-Mode Fractal Switcher & 7-Band Audio / 12-Tone Pitch Synesthesia Bar
 */
export function PreviewTransportAndModeBar() {
  const fractalMode = useStudioStore((s) => s.fractalMode);
  const audioTrackName = useStudioStore((s) => s.audioTrackName);
  const audioVolume = useStudioStore((s) => s.audioVolume);
  const activeSectionName = useStudioStore((s) => s.activeSectionName);
  const gyroEnabled = useStudioStore((s) => s.gyroEnabled);

  const setFractalMode = useStudioStore((s) => s.setFractalMode);
  const setShaderParam = useStudioStore((s) => s.setShaderParam);

  const audioFileInputRef = useRef<HTMLInputElement>(null);

  const [liveHudTelemetry, setLiveHudTelemetry] = useState({
    bpm: 124,
    note: 'C',
    freqHz: 262,
    pitchHue: 0,
    bands: [0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05],
  });

  useEffect(() => {
    const id = window.setInterval(() => {
      const b = transientState.bands;
      setLiveHudTelemetry({
        bpm: transientState.estimatedBpm,
        note: transientState.dominantNote,
        freqHz: Math.round(transientState.dominantFreqHz),
        pitchHue: Math.round(transientState.pitchHue * 360),
        bands: [
          b.subBass,
          b.bass,
          b.lowMid,
          b.mid,
          b.upperMid,
          b.presence,
          b.brilliance,
        ],
      });
    }, 125);
    return () => window.clearInterval(id);
  }, []);

  const handleAudioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await audioEngine.loadAudioFile(file);
  };

  return (
    <div
      data-hud-interactive="true"
      className="shrink-0 bg-zinc-900/90 border border-white/15 rounded-xl p-3 text-zinc-100 space-y-2.5"
    >
      {/* Row 1: 6-Mode Fractal Engine Selector */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-1.5"
        role="group"
        aria-label="Fractal Shader Modes"
      >
        {FRACTAL_MODE_INFO.map((mode) => {
          const isActive = fractalMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              data-testid={`fractal-mode-btn-${mode.id}`}
              onClick={() => setFractalMode(mode.id as FractalMode)}
              className={`px-2.5 py-1.5 rounded-lg border text-left transition-colors ${
                isActive
                  ? 'bg-zinc-800 border-amber-400 text-white'
                  : 'bg-zinc-950/70 border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-white/20'
              }`}
            >
              <div className="text-xs font-semibold whitespace-nowrap truncate">
                {mode.shortName}
              </div>
              <div className="text-[10px] text-zinc-400 whitespace-nowrap truncate">
                {mode.badge}
              </div>
            </button>
          );
        })}
      </div>

      {/* Row 2: Upload Music Button, Master Volume, 7-Band Spectrum & 12-Tone Pitch Synesthesia */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <label
            data-testid="hud-upload-music-label"
            className="relative overflow-hidden px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-zinc-950 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Music (.MP3 / .WAV)</span>
            <input
              ref={audioFileInputRef}
              type="file"
              accept=".mp3,.wav,.ogg,.flac,.m4a,.aac,.mp4,audio/*"
              onChange={handleAudioFileChange}
              className="sr-only"
            />
          </label>

          <div className="flex items-center gap-1.5 text-xs text-zinc-400 min-w-0">
            <Volume2 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <input
              type="range"
              aria-label="Master Audio Volume"
              min={0}
              max={1}
              step={0.02}
              value={audioVolume}
              onChange={(e) => audioEngine.setVolume(parseFloat(e.target.value))}
              className="w-16 accent-amber-400"
            />
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span className="hidden sm:inline truncate max-w-[180px] text-zinc-300" title={audioTrackName}>
              {audioTrackName}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div
            className="flex items-end gap-1 h-5 px-2 py-0.5 bg-zinc-950 border border-white/10 rounded"
            title="7 Perceptual Frequency Bands"
          >
            {liveHudTelemetry.bands.map((val, i) => (
              <div
                key={i}
                className="w-1.5 bg-amber-400 rounded-t-xs transition-all duration-100"
                style={{ height: `${Math.max(14, Math.min(100, Math.round(val * 100)))}%` }}
              />
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-300 font-mono tabular-nums">
            <span>{liveHudTelemetry.bpm} BPM</span>
            <span aria-hidden="true" className="text-zinc-600">·</span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-xs border border-white/20"
                style={{ backgroundColor: `hsl(${liveHudTelemetry.pitchHue}, 85%, 55%)` }}
              />
              <span>
                {liveHudTelemetry.note} ({liveHudTelemetry.freqHz}Hz)
              </span>
            </span>
            <span aria-hidden="true" className="text-zinc-600 hidden xl:inline">·</span>
            <span className="hidden xl:inline text-cyan-400">{activeSectionName}</span>
          </div>

          <button
            type="button"
            onClick={() => setShaderParam('gyroEnabled', !gyroEnabled)}
            title="Toggle Mobile Gyroscope Tilt Control"
            className={`px-2.5 py-1 rounded-lg border text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap shrink-0 ${
              gyroEnabled
                ? 'bg-cyan-400/20 border-cyan-400 text-cyan-300'
                : 'bg-zinc-950 border-white/15 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Gyro</span>
          </button>
        </div>
      </div>
    </div>
  );
}
