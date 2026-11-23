'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Repeat,
  Upload,
  Image as ImageIcon,
  Volume2,
  Compass,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Video,
} from 'lucide-react';
import { FRACTAL_MODE_INFO } from '@/lib/presets';
import { audioEngine } from '@/lib/audio-engine';
import { formatTimestamp, getSongSectionsWithTimeRanges } from '@/lib/dsp-math';
import { transientState, useStudioStore } from '@/lib/store';
import { FractalMode } from '@/lib/types';
import { startSynchronizedMusicVideoExport } from './VideoExportDrawer';

function downscaleImageToPowerOfTwoDataUrl(img: HTMLImageElement): {
  dataUrl: string;
  aspect: number;
} {
  const aspect = img.naturalWidth / Math.max(1, img.naturalHeight);
  const nextPow2 = (v: number) => Math.min(1024, Math.max(256, Math.pow(2, Math.round(Math.log2(Math.max(1, v))))));
  const targetW = nextPow2(img.naturalWidth);
  const targetH = nextPow2(img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);
    return { dataUrl: canvas.toDataURL('image/webp', 0.92), aspect };
  }
  return { dataUrl: img.src, aspect };
}

function formatPreciseTimestamp(sec: number): string {
  const safe = Math.max(0, Number.isFinite(sec) ? sec : 0);
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const tenths = Math.floor((safe - Math.floor(safe)) * 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
}

export default function TouchTimelineBar() {
  const fractalMode = useStudioStore((s) => s.fractalMode);
  const setFractalMode = useStudioStore((s) => s.setFractalMode);
  const isPlaying = useStudioStore((s) => s.isPlaying);
  const audioTrackName = useStudioStore((s) => s.audioTrackName);
  const audioVolume = useStudioStore((s) => s.audioVolume);
  const trackDuration = useStudioStore((s) => s.trackDuration);
  const waveformPeaks = useStudioStore((s) => s.waveformPeaks);
  const loopA = useStudioStore((s) => s.loopA);
  const loopB = useStudioStore((s) => s.loopB);
  const abLoopActive = useStudioStore((s) => s.abLoopActive);
  const toggleAbLoop = useStudioStore((s) => s.toggleAbLoop);
  const activeSectionName = useStudioStore((s) => s.activeSectionName);
  const choreographies = useStudioStore((s) => s.choreographies);
  const activeChoreographyIndex = useStudioStore((s) => s.activeChoreographyIndex);
  const gyroEnabled = useStudioStore((s) => s.gyroEnabled);
  const setShaderParam = useStudioStore((s) => s.setShaderParam);
  const setUserTexture = useStudioStore((s) => s.setUserTexture);
  const viewMode = useStudioStore((s) => s.viewMode);
  const toggleCleanPlayerMode = useStudioStore((s) => s.toggleCleanPlayerMode);
  const isPreviewHidden = useStudioStore((s) => s.isPreviewHidden);
  const togglePreviewHidden = useStudioStore((s) => s.togglePreviewHidden);
  const autoChoreographyEnabled = useStudioStore((s) => s.autoChoreographyEnabled);
  const exportDurationMode = useStudioStore((s) => s.exportDurationMode);
  const exportResolutionPreset = useStudioStore((s) => s.exportResolutionPreset);
  const exportVideoFormat = useStudioStore((s) => s.exportVideoFormat);
  const isRecording = useStudioStore((s) => s.isRecording);
  const offlineRenderActive = useStudioStore((s) => s.offlineRenderProgress.active);
  const selectSongSectionForExport = useStudioStore((s) => s.selectSongSectionForExport);

  const seekTrackRef = useRef<HTMLDivElement>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [scrubTime, setScrubTime] = useState<number>(0);
  const [scrubRatio, setScrubRatio] = useState<number>(0);

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
      setCurrentTime(transientState.currentTime);
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
    }, 80);
    return () => window.clearInterval(id);
  }, []);

  const totalDur = Math.max(1, trackDuration || transientState.duration || 180);
  const displayTime = isScrubbing ? scrubTime : currentTime;
  const progressRatio = Math.max(0, Math.min(1, displayTime / totalDur));

  const activeChoreo = choreographies[activeChoreographyIndex] ?? choreographies[0];
  const songSections = getSongSectionsWithTimeRanges(activeChoreo?.timelineKeyframes, totalDur);
  const sectionMarkers = songSections;
  const selectedTimelineSection =
    songSections.find((s) => s.modeId === exportDurationMode) ??
    songSections.find((s) => s.section === activeSectionName) ??
    songSections[0];

  const handleScrubAtClientX = (clientX: number) => {
    const rect = seekTrackRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetSec = Number((ratio * totalDur).toFixed(2));
    setScrubRatio(ratio);
    setScrubTime(targetSec);
    setCurrentTime(targetSec);
    audioEngine.seekToTime(targetSec);
  };

  const handleAudioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await audioEngine.loadAudioFile(file);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const { dataUrl, aspect } = downscaleImageToPowerOfTwoDataUrl(img);
      URL.revokeObjectURL(url);
      setUserTexture(dataUrl, file.name, aspect);
    };
    img.src = url;
  };

  const loopLabel =
    loopA === null
      ? 'Loop A/B'
      : loopB === null
        ? `A: ${formatTimestamp(loopA)} → Set B`
        : `Loop ${formatTimestamp(loopA)}–${formatTimestamp(loopB)}`;

  return (
    <div
      data-hud-interactive="true"
      data-testid="touch-timeline-bar"
      className="shrink-0 bg-zinc-900/95 backdrop-blur-xl border border-white/15 rounded-xl p-1.5 sm:p-2.5 text-zinc-100 space-y-1.5 shadow-2xl"
    >
      {/* ROW 1: INTERACTIVE TOUCH WAVEFORM SEEK BAR WITH SECTION MARKERS & FLOATING TIMESTAMP PILL */}
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-1 text-[10px] sm:text-[11px] font-mono tabular-nums px-0.5 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-amber-400 font-semibold" data-testid="timeline-current-time">
              {formatPreciseTimestamp(displayTime)}
            </span>
            <span className="text-zinc-500">/</span>
            <span className="text-zinc-300" data-testid="timeline-total-duration">
              {formatPreciseTimestamp(totalDur)}
            </span>
            <span className="px-1.5 py-0.2 rounded bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-[9px] sm:text-[10px]">
              {activeSectionName}
            </span>
          </div>

          {/* Section Marker Quick-Jump + 1-Tap Render Selected Section Pills (Visible on Mobile & Desktop) */}
          <div className="flex items-center gap-1 shrink-0">
            {sectionMarkers.map((mk) => {
              const isCurr =
                exportDurationMode === mk.modeId ||
                (!exportDurationMode.startsWith('section-') && activeSectionName === mk.section);
              return (
                <button
                  key={mk.section}
                  type="button"
                  data-testid={`timeline-section-pill-${mk.section.toLowerCase()}`}
                  onClick={() => {
                    selectSongSectionForExport(mk.modeId, mk.startSec, mk.endSec);
                    audioEngine.seekToTime(mk.startSec);
                  }}
                  title={`Select & Seek to ${mk.section} (${formatTimestamp(mk.startSec)} → ${formatTimestamp(mk.endSec)})`}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                    isCurr
                      ? 'bg-amber-400 text-zinc-950 font-bold'
                      : 'bg-zinc-950/80 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/10'
                  }`}
                >
                  {mk.section}
                </button>
              );
            })}
            {selectedTimelineSection && (
              <button
                type="button"
                disabled={isRecording || offlineRenderActive}
                data-testid="timeline-render-selected-section-btn"
                onClick={() => {
                  selectSongSectionForExport(
                    selectedTimelineSection.modeId,
                    selectedTimelineSection.startSec,
                    selectedTimelineSection.endSec
                  );
                  audioEngine.seekToTime(selectedTimelineSection.startSec);
                  startSynchronizedMusicVideoExport(
                    exportResolutionPreset,
                    selectedTimelineSection.modeId,
                    exportVideoFormat
                  );
                }}
                className="px-2 py-0.5 rounded bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-zinc-950 font-bold text-[10px] flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
              >
                <Video className="w-2.5 h-2.5 shrink-0" />
                <span>Render {selectedTimelineSection.section}</span>
              </button>
            )}
          </div>
        </div>

        {/* Touch-Scrubbable Waveform & Energy Heatmap Track */}
        <div
          ref={seekTrackRef}
          role="slider"
          aria-label="Interactive Audio Waveform Timeline Seek Bar"
          aria-valuemin={0}
          aria-valuemax={Math.round(totalDur)}
          aria-valuenow={Math.round(displayTime)}
          tabIndex={0}
          data-testid="waveform-seek-scrubber"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setIsScrubbing(true);
            handleScrubAtClientX(e.clientX);
          }}
          onPointerMove={(e) => {
            if (isScrubbing || e.buttons > 0) {
              handleScrubAtClientX(e.clientX);
            }
          }}
          onPointerUp={() => setIsScrubbing(false)}
          onPointerCancel={() => setIsScrubbing(false)}
          className="relative h-7 sm:h-9 w-full bg-zinc-950 border border-white/15 rounded-lg overflow-visible cursor-pointer select-none flex items-center px-1.5"
          style={{ touchAction: 'none' }}
        >
          {/* Floating Timestamp Pill above user's thumb while scrubbing */}
          {isScrubbing && (
            <div
              data-testid="floating-scrub-pill"
              className="absolute -top-7 -translate-x-1/2 z-30 px-2 py-0.5 rounded-md bg-amber-400 text-zinc-950 font-mono font-bold text-[10px] shadow-xl whitespace-nowrap pointer-events-none"
              style={{ left: `${Math.max(8, Math.min(92, scrubRatio * 100))}%` }}
            >
              {formatPreciseTimestamp(scrubTime)} / {formatPreciseTimestamp(totalDur)} ({activeSectionName})
            </div>
          )}

          {/* A/B Loop Highlight Region */}
          {loopA !== null && (
            <div
              className="absolute inset-y-0 bg-cyan-400/20 border-x-2 border-cyan-400 pointer-events-none z-10"
              style={{
                left: `${(loopA / totalDur) * 100}%`,
                width: `${
                  loopB !== null
                    ? Math.max(1, ((loopB - loopA) / totalDur) * 100)
                    : 1.5
                }%`,
              }}
            />
          )}

          {/* Song Section Vertical Divider Ticks */}
          {sectionMarkers.map((mk) => (
            <div
              key={mk.section}
              className="absolute inset-y-0 border-l border-white/15 pointer-events-none z-10"
              style={{ left: `${mk.startTimeRatio * 100}%` }}
            >
              <span className="hidden sm:inline absolute top-0.5 left-1 text-[8px] font-mono uppercase tracking-wider text-zinc-500">
                {mk.section}
              </span>
            </div>
          ))}

          {/* 120-Bar High-Contrast 2D Waveform / Energy Heatmap */}
          <div className="w-full h-5 sm:h-6 flex items-center justify-between gap-[1px] pointer-events-none z-0">
            {waveformPeaks.map((peak, idx) => {
              const barRatio = idx / waveformPeaks.length;
              const isPlayed = barRatio <= progressRatio;
              const heightPct = Math.max(16, Math.min(100, Math.round(peak * 100)));
              const isHotDrop = peak > 0.78;
              return (
                <div
                  key={idx}
                  className={`flex-1 rounded-full transition-colors duration-75 ${
                    isPlayed
                      ? isHotDrop
                        ? 'bg-amber-400'
                        : 'bg-cyan-400'
                      : isHotDrop
                        ? 'bg-zinc-600'
                        : 'bg-zinc-800'
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
              );
            })}
          </div>

          {/* Playhead Thumb Handle */}
          <div
            className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_10px_#f59e0b] pointer-events-none z-20"
            style={{ left: `${progressRatio * 100}%` }}
          >
            <div className="w-3 h-3 -ml-[5px] top-1/2 -translate-y-1/2 relative rounded-full bg-amber-400 border-2 border-zinc-950 shadow-md" />
          </div>
        </div>
      </div>

      {/* ROW 2: SINGLE-LINE COMPACT TOUCH TRANSPORT DECK (Never wraps into multiple tall rows on mobile) */}
      <div className="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 shrink-0">
          {/* Play / Pause Touch Button */}
          <button
            type="button"
            data-testid="transport-play-pause-btn"
            onClick={() => audioEngine.togglePlayPause()}
            className="min-h-[30px] sm:min-h-[34px] px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-zinc-950 rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1 transition-colors shrink-0"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3 h-3 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>Play</span>
              </>
            )}
          </button>

          {/* -5s Quick-Skip Touch Button */}
          <button
            type="button"
            data-testid="transport-skip-back-btn"
            onClick={() => audioEngine.skipRelative(-5)}
            title="Skip Back 5 Seconds"
            className="min-h-[30px] sm:min-h-[34px] px-1.5 sm:px-2 py-1 bg-zinc-950 hover:bg-zinc-800 border border-white/15 rounded-lg text-[11px] font-mono text-zinc-200 flex items-center gap-0.5 transition-colors shrink-0"
          >
            <RotateCcw className="w-3 h-3 text-cyan-400" />
            <span>-5s</span>
          </button>

          {/* +5s Quick-Skip Touch Button */}
          <button
            type="button"
            data-testid="transport-skip-fwd-btn"
            onClick={() => audioEngine.skipRelative(5)}
            title="Skip Forward 5 Seconds"
            className="min-h-[30px] sm:min-h-[34px] px-1.5 sm:px-2 py-1 bg-zinc-950 hover:bg-zinc-800 border border-white/15 rounded-lg text-[11px] font-mono text-zinc-200 flex items-center gap-0.5 transition-colors shrink-0"
          >
            <span>+5s</span>
            <RotateCw className="w-3 h-3 text-cyan-400" />
          </button>

          {/* Master Playback Mode Quick Switch: Lock Single Mode vs Auto-Switch Song Sections */}
          <button
            type="button"
            data-testid="transport-master-mode-lock-toggle"
            onClick={() =>
              setShaderParam('autoChoreographyEnabled', !autoChoreographyEnabled)
            }
            title="Toggle between Locking current Visualizer Mode for the whole video vs Auto-Switching per Song Section"
            className={`min-h-[30px] sm:min-h-[34px] px-2 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-colors shrink-0 ${
              !autoChoreographyEnabled
                ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                : 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
            }`}
          >
            <span>
              {!autoChoreographyEnabled
                ? `🔒 Locked: ${FRACTAL_MODE_INFO[fractalMode]?.shortName ?? 'Mode'}`
                : '🔀 Auto-Switch Sections'}
            </span>
          </button>

          {/* Loop A/B Region Toggle Button */}
          <button
            type="button"
            data-testid="transport-ab-loop-btn"
            onClick={toggleAbLoop}
            title="Tap once for Loop Start (A), tap again for Loop End (B), tap third time to clear"
            className={`min-h-[30px] sm:min-h-[34px] px-2 py-1 rounded-lg border text-[11px] font-mono flex items-center gap-1 transition-colors shrink-0 ${
              abLoopActive
                ? 'bg-cyan-400 text-zinc-950 border-cyan-300 font-bold'
                : loopA !== null
                  ? 'bg-cyan-950/80 border-cyan-400 text-cyan-200'
                  : 'bg-zinc-950 hover:bg-zinc-800 border-white/15 text-zinc-300'
            }`}
          >
            <Repeat className="w-3 h-3" />
            <span className="hidden sm:inline">{loopLabel}</span>
            <span className="sm:hidden">{loopA !== null ? 'A/B' : 'Loop'}</span>
          </button>

          {/* Audio Upload Button */}
          <label
            data-testid="transport-upload-audio-label"
            title="Upload Audio Track"
            className="relative overflow-hidden min-h-[30px] sm:min-h-[34px] px-2 py-1 bg-zinc-950 hover:bg-zinc-800 border border-amber-400/40 text-amber-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
          >
            <Upload className="w-3 h-3" />
            <span className="hidden sm:inline">Audio</span>
            <input
              ref={audioFileInputRef}
              type="file"
              accept=".mp3,.wav,.ogg,.flac,.m4a,.aac,.mp4,audio/*"
              onChange={handleAudioFileChange}
              className="sr-only"
            />
          </label>

          {/* Image / Emblem Upload Button */}
          <label
            data-testid="transport-upload-logo-label"
            title="Upload Custom Logo / Emblem"
            className="relative overflow-hidden min-h-[30px] sm:min-h-[34px] px-2 py-1 bg-zinc-950 hover:bg-zinc-800 border border-cyan-400/40 text-cyan-300 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors shrink-0 cursor-pointer"
          >
            <ImageIcon className="w-3 h-3" />
            <span className="hidden sm:inline">Logo</span>
            <input
              ref={imageFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/*"
              onChange={handleImageFileChange}
              className="sr-only"
            />
          </label>
        </div>

        {/* Right Telemetry: Volume, 7-Band Mini Spectrum, BPM & Pitch Note, Gyro, View Mode Toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="hidden md:flex items-center gap-1.5 text-xs text-zinc-400">
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
            <span className="hidden xl:inline truncate max-w-[130px] text-zinc-300" title={audioTrackName}>
              {audioTrackName}
            </span>
          </div>

          <div
            className="hidden sm:flex items-end gap-0.5 h-5 px-2 py-0.5 bg-zinc-950 border border-white/10 rounded"
            title="7 Perceptual Frequency Bands"
          >
            {liveHudTelemetry.bands.map((val, i) => (
              <div
                key={i}
                className="w-1.5 bg-amber-400 rounded-t-xs transition-all duration-75"
                style={{ height: `${Math.max(14, Math.min(100, Math.round(val * 100)))}%` }}
              />
            ))}
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-300 font-mono tabular-nums">
            <span>{liveHudTelemetry.bpm} BPM</span>
            <span aria-hidden="true" className="text-zinc-600">·</span>
            <span className="flex items-center gap-1">
              <span
                className="inline-block w-2.5 h-2.5 rounded-xs border border-white/20"
                style={{ backgroundColor: `hsl(${liveHudTelemetry.pitchHue}, 85%, 55%)` }}
              />
              <span>{liveHudTelemetry.note}</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShaderParam('gyroEnabled', !gyroEnabled)}
            title="Toggle Mobile Gyroscope Tilt Control"
            className={`hidden sm:inline-flex min-h-[30px] sm:min-h-[34px] px-2 py-1 rounded-lg border text-[11px] font-medium items-center gap-1 transition-colors shrink-0 ${
              gyroEnabled
                ? 'bg-cyan-400/20 border-cyan-400 text-cyan-300'
                : 'bg-zinc-950 border-white/15 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Compass className="w-3 h-3" />
            <span className="hidden md:inline">Gyro</span>
          </button>

          {/* Pinned [Hide Preview / Show Preview] EyeOff Toggle Button */}
          <button
            type="button"
            data-testid="transport-toggle-hide-preview-btn"
            onClick={togglePreviewHidden}
            title={
              isPreviewHidden
                ? 'Show Render Preview Window'
                : 'Hide Render Preview Window (Also works while rendering video)'
            }
            className={`min-h-[30px] sm:min-h-[34px] px-2 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-colors shrink-0 cursor-pointer ${
              isPreviewHidden
                ? 'bg-cyan-400 text-zinc-950 border-cyan-300 shadow-md font-bold'
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
                <span>Hide Preview</span>
              </>
            )}
          </button>

          {/* Pinned [Expand Player / Show Controls] View Mode Toggle Button */}
          <button
            type="button"
            data-testid="transport-toggle-clean-player-btn"
            onClick={toggleCleanPlayerMode}
            title="Toggle Expanded Player + Timeline Only vs Split-Screen Studio Controls"
            className={`min-h-[30px] sm:min-h-[34px] px-2 py-1 rounded-lg border text-[11px] font-semibold flex items-center gap-1 transition-colors shrink-0 cursor-pointer ${
              viewMode === 'clean-player'
                ? 'bg-amber-400 text-zinc-950 border-amber-300 shadow-md'
                : 'bg-zinc-950 hover:bg-zinc-800 border-white/20 text-zinc-200'
            }`}
          >
            {viewMode === 'clean-player' ? (
              <>
                <Minimize2 className="w-3 h-3" />
                <span>Show Controls</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3 h-3" />
                <span>Expand</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ROW 3: 26 NEXT-GEN VISUALIZER MODE TOUCH SELECTOR STRIP (Visible on Desktop in Studio VJ Mode) */}
      {viewMode === 'studio' && (
        <div
          className="hidden lg:grid lg:grid-cols-5 xl:grid-cols-9 gap-1 pt-1 border-t border-white/10"
          role="group"
          aria-label="26 Next-Gen Visualizer Modes"
        >
          {[...FRACTAL_MODE_INFO]
            .sort((a, b) => (a.id === 25 ? -1 : b.id === 25 ? 1 : a.id - b.id))
            .map((mode) => {
              const isActive = fractalMode === mode.id;
              const isDivine = mode.id === 25;
              return (
                <button
                  key={mode.id}
                  type="button"
                  data-testid={`fractal-mode-btn-${mode.id}`}
                  onClick={() => setFractalMode(mode.id as FractalMode)}
                  className={`min-h-[40px] px-2 py-1 rounded-lg border text-left transition-colors ${
                    isActive
                      ? isDivine
                        ? 'bg-gradient-to-r from-amber-500/40 via-yellow-300/30 to-cyan-400/35 border-amber-200 text-white shadow-[0_0_14px_rgba(251,191,36,0.45)]'
                        : 'bg-zinc-800 border-amber-400 text-white shadow-sm'
                      : isDivine
                      ? 'bg-gradient-to-r from-amber-950/75 via-zinc-900/90 to-yellow-950/70 border-amber-400/60 text-amber-100 hover:border-amber-300'
                      : 'bg-zinc-950/70 border-white/10 text-zinc-400 hover:text-zinc-200 hover:border-white/20'
                  }`}
                >
                  <div className="text-[11px] font-semibold whitespace-nowrap truncate">
                    {mode.shortName}
                  </div>
                  <div
                    className={`text-[9px] font-mono whitespace-nowrap truncate ${
                      isDivine ? 'text-yellow-200 font-bold' : 'text-amber-400/90'
                    }`}
                  >
                    {mode.badge}
                  </div>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
