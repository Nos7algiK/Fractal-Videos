import {
  AspectRatioMode,
  CosinePalette,
  ExportDurationMode,
  ExportResolutionPreset,
  ExportVideoFormat,
  FrequencyBands,
  PrecomputedAudioFrame,
  PreviewResolutionCap,
  ResolvedExportSegment,
  SongSectionTimeRange,
  TimelineKeyframe,
} from './types';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/**
 * Converts decibel FFT reading (-100dB .. 0dB) into normalized linear magnitude [0, 1].
 */
export function dbToLinear(db: number, minDb = -95, maxDb = -10): number {
  if (!Number.isFinite(db) || db <= minDb) return 0;
  if (db >= maxDb) return 1;
  const normalizedDb = (db - minDb) / (maxDb - minDb);
  const linearAmp = Math.pow(10, (db - maxDb) / 28);
  return Math.max(0, Math.min(1, linearAmp * 0.75 + normalizedDb * 0.25));
}

/**
 * Applies user-adjustable Audio Gain and Peak Exaggeration Curve:
 * pow(clamp(band * gain, 0.0, 2.0), peakExponent)
 */
export function applyPeakExaggeration(
  value: number,
  gain = 1.0,
  peakExponent = 1.45
): number {
  if (!Number.isFinite(value) || value <= 0 || gain <= 0) return 0;
  const scaled = Math.max(0, Math.min(2.0, value * gain));
  const safeExp = Math.max(0.5, Math.min(3.5, peakExponent));
  return Math.max(0, Math.min(2.5, Math.pow(scaled, safeExp)));
}

/**
 * Continuous BPM Sawtooth Phase Lock:
 * Returns normalized beat phase in [0, 1) for a given timestamp and BPM.
 */
export function computeBpmSawtoothPhase(timeSec: number, bpm = 124): number {
  if (!Number.isFinite(timeSec) || timeSec < 0) return 0;
  const safeBpm = Math.max(40, Math.min(240, Number.isFinite(bpm) ? bpm : 124));
  const beatsElapsed = timeSec * (safeBpm / 60);
  return ((beatsElapsed % 1) + 1) % 1;
}

/**
 * Samples a linear FFT magnitude array at a specific frequency (Hz) using
 * linear interpolation between adjacent FFT bins (essential for accurate sub-bass/bass).
 */
export function sampleFftInterpolated(
  fftLinear: Float32Array | number[],
  freqHz: number,
  sampleRate: number,
  fftSize: number
): number {
  const binCount = fftLinear.length;
  if (binCount === 0 || sampleRate <= 0 || fftSize <= 0) return 0;
  const binWidth = sampleRate / fftSize;
  const exactBin = freqHz / binWidth;
  const lowIndex = Math.max(0, Math.min(binCount - 1, Math.floor(exactBin)));
  const highIndex = Math.max(0, Math.min(binCount - 1, Math.ceil(exactBin)));
  const frac = exactBin - Math.floor(exactBin);
  const vLow = fftLinear[lowIndex] ?? 0;
  const vHigh = fftLinear[highIndex] ?? 0;
  return vLow + (vHigh - vLow) * frac;
}

/**
 * Computes a frequency band average using logarithmic resampling with linear interpolation
 * for low frequencies (< 500Hz) and bin averaging for high frequencies.
 */
export function computeBandEnergy(
  fftLinear: Float32Array | number[],
  minHz: number,
  maxHz: number,
  sampleRate: number,
  fftSize: number,
  logSamples = 12
): number {
  if (fftLinear.length === 0 || maxHz <= minHz) return 0;
  const binWidth = sampleRate / fftSize;
  const startBin = Math.floor(minHz / binWidth);
  const endBin = Math.ceil(maxHz / binWidth);

  if (endBin - startBin < logSamples) {
    let sum = 0;
    const logMin = Math.log(Math.max(1, minHz));
    const logMax = Math.log(Math.max(2, maxHz));
    for (let i = 0; i < logSamples; i++) {
      const t = i / Math.max(1, logSamples - 1);
      const freq = Math.exp(logMin + (logMax - logMin) * t);
      sum += sampleFftInterpolated(fftLinear, freq, sampleRate, fftSize);
    }
    return Math.max(0, Math.min(1, sum / logSamples));
  }

  let sum = 0;
  let count = 0;
  const clampedStart = Math.max(0, Math.min(fftLinear.length - 1, startBin));
  const clampedEnd = Math.max(clampedStart, Math.min(fftLinear.length - 1, endBin));
  for (let b = clampedStart; b <= clampedEnd; b++) {
    sum += fftLinear[b] ?? 0;
    count++;
  }
  return count > 0 ? Math.max(0, Math.min(1, sum / count)) : 0;
}

/**
 * Computes all 7 perceptual frequency bands from linear FFT magnitudes.
 */
export function computeFrequencyBands(
  fftLinear: Float32Array | number[],
  sampleRate = 48000,
  fftSize = 2048
): FrequencyBands {
  return {
    subBass: computeBandEnergy(fftLinear, 20, 60, sampleRate, fftSize, 10),
    bass: computeBandEnergy(fftLinear, 60, 250, sampleRate, fftSize, 14),
    lowMid: computeBandEnergy(fftLinear, 250, 500, sampleRate, fftSize, 12),
    mid: computeBandEnergy(fftLinear, 500, 2000, sampleRate, fftSize, 16),
    upperMid: computeBandEnergy(fftLinear, 2000, 4000, sampleRate, fftSize, 16),
    presence: computeBandEnergy(fftLinear, 4000, 6000, sampleRate, fftSize, 16),
    brilliance: computeBandEnergy(fftLinear, 6000, 20000, sampleRate, fftSize, 20),
  };
}

/**
 * Frame-rate independent Adaptive Modulated Half-Life Smoothing:
 * alpha = 1 - pow(2.0, -dt / H_k)
 * where H_k shrinks near 0 on rapid volume attacks (instant beat punch)
 * and lengthens during steady decay (zero jitter).
 */
export function adaptiveHalfLifeSmooth(
  current: number,
  target: number,
  dt: number,
  attackHalfLife = 0.008,
  decayHalfLife = 0.14
): number {
  if (!Number.isFinite(dt) || dt <= 0) return current;
  const clampedDt = Math.min(dt, 0.25);
  const delta = target - current;

  let halfLife: number;
  if (delta > 0) {
    const attackUrgency = Math.min(1, delta * 3.5);
    halfLife = Math.max(0.0015, attackHalfLife * (1 - 0.85 * attackUrgency));
  } else {
    halfLife = Math.max(0.01, decayHalfLife);
  }

  const decayFactor = Math.pow(2.0, -clampedDt / halfLife);
  return target + (current - target) * decayFactor;
}

/**
 * Mechanical "Juice" Bounce Multiplier:
 * bounce = pow(bass + bass / max(mids, 0.001), 0.15)
 */
export function computeJuiceBounce(bass: number, mids: number): number {
  const safeBass = Math.max(0, bass);
  const safeMids = Math.max(mids, 0.001);
  if (safeBass <= 1e-6) return 0;
  const raw = Math.pow(safeBass + safeBass / safeMids, 0.15);
  return Math.max(0, Math.min(3.0, raw));
}

/**
 * Silence-to-Intensity Envelope & Fractal Spike Generator:
 * - In silent or near-silent passages (rms <= noiseGate), returns near-zero timeRate
 *   and zero spike displacement so fractals remain serene and still.
 * - As music intensity, bass, presence, and kick/snare transients surge,
 *   produces sharp nonlinear fractal spike amplitude [0, 3.0] and accelerated time flow.
 */
export function computeAudioSpikeEnvelope(
  bands: FrequencyBands,
  kickTransient: number,
  snareTransient: number,
  spikeSensitivity = 1.35,
  noiseGate = 0.035
): {
  audioIntensity: number;
  fractalSpike: number;
  timeRateMultiplier: number;
} {
  const weightedRms =
    bands.subBass * 0.24 +
    bands.bass * 0.28 +
    bands.lowMid * 0.12 +
    bands.mid * 0.14 +
    bands.upperMid * 0.1 +
    bands.presence * 0.07 +
    bands.brilliance * 0.05;

  const gatedEnergy = Math.max(0, weightedRms - noiseGate) / Math.max(0.001, 1 - noiseGate);
  const audioIntensity = Math.max(
    0,
    Math.min(1.5, Math.pow(gatedEnergy, 1.35) + kickTransient * 0.35 + snareTransient * 0.25)
  );

  const harmonicClash = (bands.bass + bands.subBass) * (bands.presence + bands.upperMid + 0.25);
  const rawSpike =
    (Math.pow(gatedEnergy, 1.55) * 1.45 +
      kickTransient * 1.25 +
      snareTransient * 0.95 +
      harmonicClash * 1.65) *
    Math.max(0, spikeSensitivity);

  const fractalSpike =
    gatedEnergy <= 0.002 && kickTransient < 0.02 && snareTransient < 0.02
      ? 0
      : Math.max(0, Math.min(3.0, rawSpike));

  const timeRateMultiplier =
    0.025 + Math.pow(gatedEnergy, 1.3) * 1.55 + kickTransient * 0.65 + snareTransient * 0.35;

  return {
    audioIntensity: Number(audioIntensity.toFixed(4)),
    fractalSpike: Number(fractalSpike.toFixed(4)),
    timeRateMultiplier: Number(timeRateMultiplier.toFixed(4)),
  };
}

/**
 * 12-Tone Pitch-to-Color Synesthesia:
 * Maps dominant fundamental frequency (Hz) to semitone on the chromatic circle
 * at 30 degrees per step (C = Red 0°, E = Green 120°, G# = Blue 240°).
 * Returns pitchHue normalized to [0, 1] for GLSL shader u_pitchHue.
 */
export function frequencyToPitchHue(freqHz: number): {
  pitchHue: number;
  degrees: number;
  semitone: number;
  noteName: string;
} {
  if (!Number.isFinite(freqHz) || freqHz <= 16) {
    return { pitchHue: 0, degrees: 0, semitone: 0, noteName: 'C' };
  }
  const midiFloat = 69 + 12 * Math.log2(freqHz / 440);
  const semitoneContinuous = ((midiFloat % 12) + 12) % 12;
  const semitoneRounded = Math.round(semitoneContinuous) % 12;
  const degrees = (semitoneContinuous * 30) % 360;
  const pitchHue = degrees / 360;
  const noteName = NOTE_NAMES[semitoneRounded] ?? 'C';

  return {
    pitchHue,
    degrees,
    semitone: semitoneRounded,
    noteName,
  };
}

/**
 * Inigo Quilez Cosine Palette evaluation:
 * color(t) = a + b * cos(6.28318 * (c * t + d))
 */
export function evaluateCosinePalette(
  t: number,
  palette: CosinePalette
): [number, number, number] {
  const TAU = 6.28318530718;
  const r = palette.a[0] + palette.b[0] * Math.cos(TAU * (palette.c[0] * t + palette.d[0]));
  const g = palette.a[1] + palette.b[1] * Math.cos(TAU * (palette.c[1] * t + palette.d[1]));
  const b = palette.a[2] + palette.b[2] * Math.cos(TAU * (palette.c[2] * t + palette.d[2]));
  return [
    Math.max(0, Math.min(1, r)),
    Math.max(0, Math.min(1, g)),
    Math.max(0, Math.min(1, b)),
  ];
}

/**
 * Finds the active TimelineKeyframe for a normalized track progress [0, 1].
 */
export function getActiveChoreographyKeyframe(
  keyframes: TimelineKeyframe[],
  progressRatio: number
): TimelineKeyframe | null {
  if (!keyframes || keyframes.length === 0) return null;
  const clamped = Math.max(0, Math.min(1, progressRatio));
  const sorted = [...keyframes].sort((a, b) => a.startTimeRatio - b.startTimeRatio);
  let active = sorted[0];
  for (const kf of sorted) {
    if (clamped >= kf.startTimeRatio) {
      active = kf;
    } else {
      break;
    }
  }
  return active;
}

const DEFAULT_SONG_SECTION_KEYFRAMES: TimelineKeyframe[] = [
  {
    section: 'Intro',
    startTimeRatio: 0.0,
    fractalMode: 0,
    speedMultiplier: 0.9,
    bloomIntensity: 1.2,
    bulbPower: 8.0,
    kleinianScale: 1.38,
    foldLimit: 1.0,
    chaosMode: false,
    description: 'Opening atmospheric emergence',
  },
  {
    section: 'Buildup',
    startTimeRatio: 0.2,
    fractalMode: 3,
    speedMultiplier: 1.35,
    bloomIntensity: 1.45,
    bulbPower: 9.0,
    kleinianScale: 1.48,
    foldLimit: 1.15,
    chaosMode: false,
    description: 'Rising harmonic tension & riser acceleration',
  },
  {
    section: 'Drop',
    startTimeRatio: 0.42,
    fractalMode: 2,
    speedMultiplier: 2.1,
    bloomIntensity: 1.9,
    bulbPower: 10.5,
    kleinianScale: 1.52,
    foldLimit: 1.25,
    chaosMode: true,
    description: 'Peak bass drop & shockwave impact',
  },
  {
    section: 'Breakdown',
    startTimeRatio: 0.68,
    fractalMode: 10,
    speedMultiplier: 0.95,
    bloomIntensity: 1.5,
    bulbPower: 7.5,
    kleinianScale: 1.4,
    foldLimit: 0.95,
    chaosMode: true,
    description: 'Melodic breakdown & 3D depth morph',
  },
  {
    section: 'Outro',
    startTimeRatio: 0.86,
    fractalMode: 8,
    speedMultiplier: 0.75,
    bloomIntensity: 1.4,
    bulbPower: 8.0,
    kleinianScale: 1.35,
    foldLimit: 1.0,
    chaosMode: false,
    description: 'Closing dissolution & optical trails',
  },
];

function sectionNameToModeId(
  section: TimelineKeyframe['section']
): SongSectionTimeRange['modeId'] {
  switch (section) {
    case 'Intro':
      return 'section-intro';
    case 'Buildup':
      return 'section-buildup';
    case 'Drop':
      return 'section-drop';
    case 'Breakdown':
      return 'section-breakdown';
    case 'Outro':
    default:
      return 'section-outro';
  }
}

/**
 * Computes contiguous time windows [startSec, endSec] for each song section
 * (Intro, Buildup, Drop, Breakdown, Outro) across a given trackDuration.
 */
export function getSongSectionsWithTimeRanges(
  keyframes: TimelineKeyframe[] | undefined | null,
  trackDuration: number
): SongSectionTimeRange[] {
  const safeDur = Math.max(5, Number.isFinite(trackDuration) && trackDuration > 0 ? trackDuration : 180);
  const sourceKfs =
    keyframes && keyframes.length > 0 ? keyframes : DEFAULT_SONG_SECTION_KEYFRAMES;
  const sorted = [...sourceKfs].sort((a, b) => a.startTimeRatio - b.startTimeRatio);

  return sorted.map((kf, idx) => {
    const startRatio = Math.max(0, Math.min(0.99, idx === 0 ? 0 : kf.startTimeRatio));
    const nextKf = sorted[idx + 1];
    const endRatio = nextKf
      ? Math.max(startRatio + 0.01, Math.min(1.0, nextKf.startTimeRatio))
      : 1.0;
    const startSec = Number((startRatio * safeDur).toFixed(2));
    const endSec = Number((endRatio * safeDur).toFixed(2));
    const durationSec = Number(Math.max(1, endSec - startSec).toFixed(2));

    return {
      section: kf.section,
      modeId: sectionNameToModeId(kf.section),
      index: idx,
      startSec,
      endSec,
      durationSec,
      startTimeRatio: startRatio,
      endTimeRatio: endRatio,
      fractalMode: kf.fractalMode,
      description: kf.description,
    };
  });
}

/**
 * Resolves the exact [startSec, endSec] time window, duration, and filename tag
 * for any ExportDurationMode (including individual song sections: Intro, Buildup, Drop, Breakdown, Outro,
 * A/B Loop region, or Custom Start->End range).
 */
export function resolveExportSegmentRange(options: {
  mode: ExportDurationMode;
  trackDuration: number;
  keyframes?: TimelineKeyframe[] | null;
  customStartSec?: number | null;
  customEndSec?: number | null;
  loopA?: number | null;
  loopB?: number | null;
}): ResolvedExportSegment {
  const safeTrackDur = Math.max(
    5,
    Number.isFinite(options.trackDuration) && options.trackDuration > 0
      ? options.trackDuration
      : 180
  );
  const sections = getSongSectionsWithTimeRanges(options.keyframes, safeTrackDur);

  const findSection = (modeId: SongSectionTimeRange['modeId'], fallbackIdx: number) =>
    sections.find((s) => s.modeId === modeId) ?? sections[fallbackIdx] ?? sections[0];

  switch (options.mode) {
    case 'section-intro': {
      const sec = findSection('section-intro', 0);
      return {
        mode: 'section-intro',
        label: `Part 1: Intro (${formatTimestamp(sec.startSec)} → ${formatTimestamp(sec.endSec)})`,
        shortTag: 'Part1-Intro',
        sectionName: 'Intro',
        startSec: sec.startSec,
        endSec: sec.endSec,
        durationSec: sec.durationSec,
      };
    }
    case 'section-buildup': {
      const sec = findSection('section-buildup', 1);
      return {
        mode: 'section-buildup',
        label: `Part 2: Buildup (${formatTimestamp(sec.startSec)} → ${formatTimestamp(sec.endSec)})`,
        shortTag: 'Part2-Buildup',
        sectionName: 'Buildup',
        startSec: sec.startSec,
        endSec: sec.endSec,
        durationSec: sec.durationSec,
      };
    }
    case 'section-drop': {
      const sec = findSection('section-drop', 2);
      return {
        mode: 'section-drop',
        label: `Part 3: Drop (${formatTimestamp(sec.startSec)} → ${formatTimestamp(sec.endSec)})`,
        shortTag: 'Part3-Drop',
        sectionName: 'Drop',
        startSec: sec.startSec,
        endSec: sec.endSec,
        durationSec: sec.durationSec,
      };
    }
    case 'section-breakdown': {
      const sec = findSection('section-breakdown', 3);
      return {
        mode: 'section-breakdown',
        label: `Part 4: Breakdown (${formatTimestamp(sec.startSec)} → ${formatTimestamp(sec.endSec)})`,
        shortTag: 'Part4-Breakdown',
        sectionName: 'Breakdown',
        startSec: sec.startSec,
        endSec: sec.endSec,
        durationSec: sec.durationSec,
      };
    }
    case 'section-outro': {
      const sec = findSection('section-outro', 4);
      return {
        mode: 'section-outro',
        label: `Part 5: Outro (${formatTimestamp(sec.startSec)} → ${formatTimestamp(sec.endSec)})`,
        shortTag: 'Part5-Outro',
        sectionName: 'Outro',
        startSec: sec.startSec,
        endSec: sec.endSec,
        durationSec: sec.durationSec,
      };
    }
    case 'ab-loop': {
      const hasLoop =
        typeof options.loopA === 'number' &&
        typeof options.loopB === 'number' &&
        options.loopB > options.loopA + 0.5;
      const startSec = hasLoop
        ? Number(Math.max(0, Math.min(safeTrackDur - 1, options.loopA!)).toFixed(2))
        : 0;
      const endSec = hasLoop
        ? Number(Math.max(startSec + 1, Math.min(safeTrackDur, options.loopB!)).toFixed(2))
        : Math.min(safeTrackDur, 30);
      const durationSec = Number(Math.max(1, endSec - startSec).toFixed(2));
      return {
        mode: 'ab-loop',
        label: `A/B Loop (${formatTimestamp(startSec)} → ${formatTimestamp(endSec)})`,
        shortTag: `ABLoop-${formatTimestamp(startSec).replace(':', 'm')}s-${formatTimestamp(endSec).replace(':', 'm')}s`,
        sectionName: null,
        startSec,
        endSec,
        durationSec,
      };
    }
    case 'custom-range': {
      const rawStart =
        typeof options.customStartSec === 'number' && Number.isFinite(options.customStartSec)
          ? options.customStartSec
          : 0;
      const startSec = Number(Math.max(0, Math.min(safeTrackDur - 1, rawStart)).toFixed(2));
      const rawEnd =
        typeof options.customEndSec === 'number' && Number.isFinite(options.customEndSec)
          ? options.customEndSec
          : Math.min(safeTrackDur, startSec + 30);
      const endSec = Number(Math.max(startSec + 1, Math.min(safeTrackDur, rawEnd)).toFixed(2));
      const durationSec = Number(Math.max(1, endSec - startSec).toFixed(2));
      return {
        mode: 'custom-range',
        label: `Custom Section (${formatTimestamp(startSec)} → ${formatTimestamp(endSec)})`,
        shortTag: `Custom-${formatTimestamp(startSec).replace(':', 'm')}s-${formatTimestamp(endSec).replace(':', 'm')}s`,
        sectionName: null,
        startSec,
        endSec,
        durationSec,
      };
    }
    case '5s-test': {
      const endSec = Math.min(safeTrackDur, 5);
      return {
        mode: '5s-test',
        label: `5s Fast Test (00:00 → ${formatTimestamp(endSec)})`,
        shortTag: '5s-Test',
        sectionName: null,
        startSec: 0,
        endSec,
        durationSec: endSec,
      };
    }
    case '15s-clip':
    case '15s': {
      const endSec = Math.min(safeTrackDur, 15);
      return {
        mode: options.mode,
        label: `15s Shorts Clip (00:00 → ${formatTimestamp(endSec)})`,
        shortTag: '15s-Shorts',
        sectionName: null,
        startSec: 0,
        endSec,
        durationSec: endSec,
      };
    }
    case '30s': {
      const endSec = Math.min(safeTrackDur, 30);
      return {
        mode: '30s',
        label: `30s Clip (00:00 → ${formatTimestamp(endSec)})`,
        shortTag: '30s-Clip',
        sectionName: null,
        startSec: 0,
        endSec,
        durationSec: endSec,
      };
    }
    case '60s': {
      const endSec = Math.min(safeTrackDur, 60);
      return {
        mode: '60s',
        label: `60s Clip (00:00 → ${formatTimestamp(endSec)})`,
        shortTag: '60s-Clip',
        sectionName: null,
        startSec: 0,
        endSec,
        durationSec: endSec,
      };
    }
    case 'full-song':
    default:
      return {
        mode: 'full-song',
        label: `Full Song (00:00 → ${formatTimestamp(safeTrackDur)})`,
        shortTag: 'Full-Song',
        sectionName: null,
        startSec: 0,
        endSec: safeTrackDur,
        durationSec: safeTrackDur,
      };
  }
}

/**
 * Returns capped preview buffer dimensions (1080p max or 720p) for 16:9, 9:16, or 1:1 Square.
 */
export function getPreviewResolutionDimensions(
  aspectRatio: AspectRatioMode,
  cap: PreviewResolutionCap = '1080p'
): { width: number; height: number } {
  if (aspectRatio === '1:1') {
    const side = cap === '720p' ? 720 : 1080;
    return { width: side, height: side };
  }
  const isVertical = aspectRatio === '9:16';
  if (cap === '720p') {
    return {
      width: isVertical ? 720 : 1280,
      height: isVertical ? 1280 : 720,
    };
  }
  return {
    width: isVertical ? 1080 : 1920,
    height: isVertical ? 1920 : 1080,
  };
}

/**
 * Returns exact even-integer pixel resolution for 16:9 (YouTube), 9:16 (Shorts/TikTok), or 1:1 (Square)
 * and target encoder bitrate for video export.
 */
export function getExportResolutionDimensions(
  aspectRatio: AspectRatioMode,
  preset: ExportResolutionPreset
): {
  width: number;
  height: number;
  bitrate: number;
  recommendedRaymarchScale: number;
  label: string;
  shortLabel: string;
} {
  const isVertical = aspectRatio === '9:16';
  const isSquare = aspectRatio === '1:1';

  switch (preset) {
    case '4k': {
      const width = isSquare ? 2160 : isVertical ? 2160 : 3840;
      const height = isSquare ? 2160 : isVertical ? 3840 : 2160;
      return {
        width,
        height,
        bitrate: 50_000_000,
        recommendedRaymarchScale: 0.5,
        label: isSquare
          ? '4K Square (2160×2160)'
          : isVertical
            ? '4K UHD Shorts (2160×3840)'
            : '4K UHD (3840×2160)',
        shortLabel: '4K UHD',
      };
    }
    case '1440p': {
      const width = isSquare ? 1440 : isVertical ? 1440 : 2560;
      const height = isSquare ? 1440 : isVertical ? 2560 : 1440;
      return {
        width,
        height,
        bitrate: 35_000_000,
        recommendedRaymarchScale: 0.65,
        label: isSquare
          ? '1440p Square (1440×1440)'
          : isVertical
            ? '1440p QHD Shorts (1440×2560)'
            : '1440p QHD (2560×1440)',
        shortLabel: '1440p QHD',
      };
    }
    case '720p': {
      const width = isSquare ? 720 : isVertical ? 720 : 1280;
      const height = isSquare ? 720 : isVertical ? 1280 : 720;
      return {
        width,
        height,
        bitrate: 12_000_000,
        recommendedRaymarchScale: 0.9,
        label: isSquare
          ? '720p Square (720×720)'
          : isVertical
            ? '720p HD Shorts (720×1280)'
            : '720p HD (1280×720)',
        shortLabel: '720p HD',
      };
    }
    case '1080p':
    default: {
      const width = isSquare ? 1080 : isVertical ? 1080 : 1920;
      const height = isSquare ? 1080 : isVertical ? 1920 : 1080;
      return {
        width,
        height,
        bitrate: 25_000_000,
        recommendedRaymarchScale: 0.75,
        label: isSquare
          ? '1080p Square (1080×1080)'
          : isVertical
            ? '1080p FHD Shorts (1080×1920)'
            : '1080p FHD (1920×1080)',
        shortLabel: '1080p FHD',
      };
    }
  }
}

/**
 * Dynamic 60FPS Resolution Scaling Governor:
 * Adjusts the internal raymarch render target scale in [minScale, maxScale]
 * based on measured frame time (target <= 15.8ms for locked 60 FPS).
 */
export function computeDynamicRenderScale(
  currentScale: number,
  frameTimeMs: number,
  minScale = 0.35,
  maxScale = 1.0
): number {
  if (!Number.isFinite(frameTimeMs) || frameTimeMs <= 0) {
    return Math.max(minScale, Math.min(maxScale, currentScale));
  }
  let next = currentScale;
  if (frameTimeMs > 16.8) {
    const overloadRatio = Math.min(0.15, (frameTimeMs - 16.0) * 0.008);
    next = currentScale - Math.max(0.04, overloadRatio);
  } else if (frameTimeMs < 11.5 && currentScale < maxScale) {
    next = currentScale + 0.015;
  }
  return Number(Math.max(minScale, Math.min(maxScale, next)).toFixed(3));
}

/**
 * Returns container, extension, MIME candidates, and encoder metadata for the selected Video Format
 * (MP4 H.264, WebM VP9, WebM VP8, or QuickTime MOV).
 */
export function getVideoFormatSpecification(format: ExportVideoFormat): {
  id: ExportVideoFormat;
  label: string;
  shortLabel: string;
  badge: string;
  ext: string;
  blobType: string;
  description: string;
  mimeCandidates: string[];
} {
  switch (format) {
    case 'mp4-h264':
      return {
        id: 'mp4-h264',
        label: 'MP4 (H.264 / AAC)',
        shortLabel: 'MP4 H.264',
        badge: '.MP4',
        ext: 'mp4',
        blobType: 'video/mp4',
        description: 'Universal MP4 for YouTube, TikTok, Instagram, Premiere & QuickTime',
        mimeCandidates: [
          'video/mp4;codecs=avc1.640034,mp4a.40.2',
          'video/mp4;codecs=avc1.640033,mp4a.40.2',
          'video/mp4;codecs=avc1.64002A,mp4a.40.2',
          'video/mp4;codecs=avc1,mp4a.40.2',
          'video/mp4;codecs=h264,aac',
          'video/mp4',
        ],
      };
    case 'webm-vp8':
      return {
        id: 'webm-vp8',
        label: 'WebM (VP8 / Opus)',
        shortLabel: 'WebM VP8',
        badge: '.WEBM',
        ext: 'webm',
        blobType: 'video/webm',
        description: 'Ultra-fast real-time hardware encoding with lowest GPU overhead',
        mimeCandidates: [
          'video/webm;codecs=vp8,opus',
          'video/webm;codecs=vp8',
          'video/webm',
        ],
      };
    case 'mov-h264':
      return {
        id: 'mov-h264',
        label: 'MOV (QuickTime H.264)',
        shortLabel: 'MOV Pro',
        badge: '.MOV',
        ext: 'mov',
        blobType: 'video/quicktime',
        description: 'Apple QuickTime / Final Cut Pro / DaVinci Resolve workflow',
        mimeCandidates: [
          'video/mp4;codecs=avc1.640034,mp4a.40.2',
          'video/mp4;codecs=avc1.640033,mp4a.40.2',
          'video/mp4;codecs=avc1,mp4a.40.2',
          'video/mp4',
        ],
      };
    case 'webm-vp9':
    default:
      return {
        id: 'webm-vp9',
        label: 'WebM (VP9 / Opus)',
        shortLabel: 'WebM VP9',
        badge: '.WEBM',
        ext: 'webm',
        blobType: 'video/webm',
        description: 'High-efficiency 4K 60FPS YouTube mastering codec',
        mimeCandidates: [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp9',
          'video/webm',
        ],
      };
  }
}

/**
 * Formats seconds into MM:SS tabular timestamp string.
 */
export function formatTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const totalSec = Math.floor(seconds);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export interface JitOfflineAudioAnalyzerOptions {
  reactivityGain?: number;
  peakExponent?: number;
  bounceIntensity?: number;
  spikeSensitivity?: number;
  estimatedBpm?: number;
  cameraSpeed?: number;
}

export interface JitOfflineAudioAnalyzer {
  stepFrameAtTime: (frameIndex: number, explicitTimeSec?: number) => PrecomputedAudioFrame;
}

/**
 * Just-In-Time (JIT) Per-Frame 2048-Sample PCM Spectral & Envelope Analyzer:
 * Slices a 2048-sample window directly from `channelData` at `sampleIndex = Math.floor(t * sampleRate)`
 * for a single frame `i` at time `t = i / exportFps` (<0.15ms per frame, zero upfront main-thread block).
 */
export function createJitOfflineAudioAnalyzer(
  channelData: Float32Array,
  sampleRate: number,
  exportFps: number,
  options?: JitOfflineAudioAnalyzerOptions
): JitOfflineAudioAnalyzer {
  const safeFps = Math.max(1, exportFps || 60);
  const dt = 1 / safeFps;
  const gain = options?.reactivityGain ?? 1.25;
  const peakExp = options?.peakExponent ?? 1.45;
  const bounceIntensity = options?.bounceIntensity ?? 1.0;
  const spikeSens = options?.spikeSensitivity ?? 1.5;
  const bpm = options?.estimatedBpm ?? 124;
  const baseCameraSpeed = Math.max(0.35, options?.cameraSpeed ?? 1.2);

  // 2048-sample PCM window per frame as specified for JIT spectral analysis
  const windowSize = 2048;
  const probeSamples = 64;
  const fixedStride = Math.max(1, Math.floor(windowSize / probeSamples)); // 32
  const totalSamples = channelData.length;

  // Precompute Hann-windowed cosine/sine quadrature tables once (<0.05ms)
  const bandFreqs = [40, 125, 360, 1000, 2800, 4800, 9500];
  const safeSr = Math.max(8000, sampleRate || 48000);
  const cosTable = new Float32Array(7 * probeSamples);
  const sinTable = new Float32Array(7 * probeSamples);
  for (let b = 0; b < 7; b++) {
    const omega = (2 * Math.PI * bandFreqs[b]) / safeSr;
    for (let k = 0; k < probeSamples; k++) {
      const w = 0.5 * (1 - Math.cos((2 * Math.PI * k) / Math.max(1, probeSamples - 1)));
      const phase = omega * (k * fixedStride);
      cosTable[b * probeSamples + k] = w * Math.cos(phase);
      sinTable[b * probeSamples + k] = w * Math.sin(phase);
    }
  }

  let smoothedBands: FrequencyBands = {
    subBass: 0,
    bass: 0,
    lowMid: 0,
    mid: 0,
    upperMid: 0,
    presence: 0,
    brilliance: 0,
  };

  let prevLowEnergy = 0;
  let prevSnareEnergy = 0;
  let prevHatEnergy = 0;
  let kickTransient = 0;
  let snareTransient = 0;
  let hiHatSparkle = 0;
  let bassCumulative = 0;
  let midCumulative = 0;
  let dynamicTime = 1.25;
  let mirrorPhase = 0;
  let smoothedPitchHue = 0;

  const stepFrameAtTime = (frameIndex: number, explicitTimeSec?: number): PrecomputedAudioFrame => {
    const timeSec = typeof explicitTimeSec === 'number' ? explicitTimeSec : frameIndex / safeFps;
    const sampleIndex = Math.floor(timeSec * safeSr);
    const startSample = Math.max(0, Math.min(Math.max(0, totalSamples - 1), sampleIndex));
    const endSample = Math.min(totalSamples, startSample + windowSize);
    const count = Math.max(1, endSample - startSample);

    let sumSq = 0;
    let zeroCrossings = 0;
    let sampledCount = 0;
    for (let i = startSample; i < endSample; i += 4) {
      const s = channelData[i] ?? 0;
      sumSq += s * s;
      sampledCount++;
      if (i > startSample) {
        const prev = channelData[i - 4] ?? 0;
        if ((s >= 0 && prev < 0) || (s < 0 && prev >= 0)) {
          zeroCrossings += 4;
        }
      }
    }
    const rawRms = Math.sqrt(sumSq / Math.max(1, sampledCount));

    const rawBandVals = [0, 0, 0, 0, 0, 0, 0];
    if (rawRms > 1e-5 && totalSamples > 0) {
      for (let b = 0; b < 7; b++) {
        const baseOffset = b * probeSamples;
        let re = 0;
        let im = 0;
        for (let k = 0; k < probeSamples; k++) {
          const idx = startSample + k * fixedStride;
          const sample = idx < totalSamples ? channelData[idx] : 0;
          re += sample * cosTable[baseOffset + k];
          im += sample * sinTable[baseOffset + k];
        }
        const mag = Math.sqrt(re * re + im * im) / (probeSamples * 0.22);
        rawBandVals[b] = applyPeakExaggeration(
          Math.min(1.5, mag * 2.1 + rawRms * 0.35),
          gain,
          peakExp
        );
      }
    }

    const rawBands: FrequencyBands = {
      subBass: Math.min(1.5, rawBandVals[0]),
      bass: Math.min(1.5, rawBandVals[1]),
      lowMid: Math.min(1.5, rawBandVals[2]),
      mid: Math.min(1.5, rawBandVals[3]),
      upperMid: Math.min(1.5, rawBandVals[4]),
      presence: Math.min(1.5, rawBandVals[5]),
      brilliance: Math.min(1.5, rawBandVals[6]),
    };

    smoothedBands = {
      subBass: adaptiveHalfLifeSmooth(smoothedBands.subBass, rawBands.subBass, dt, 0.005, 0.11),
      bass: adaptiveHalfLifeSmooth(smoothedBands.bass, rawBands.bass, dt, 0.006, 0.12),
      lowMid: adaptiveHalfLifeSmooth(smoothedBands.lowMid, rawBands.lowMid, dt, 0.009, 0.14),
      mid: adaptiveHalfLifeSmooth(smoothedBands.mid, rawBands.mid, dt, 0.01, 0.15),
      upperMid: adaptiveHalfLifeSmooth(smoothedBands.upperMid, rawBands.upperMid, dt, 0.01, 0.14),
      presence: adaptiveHalfLifeSmooth(smoothedBands.presence, rawBands.presence, dt, 0.008, 0.12),
      brilliance: adaptiveHalfLifeSmooth(smoothedBands.brilliance, rawBands.brilliance, dt, 0.006, 0.1),
    };

    // Multi-Band Onset Detection: Kick, Snare, Hi-Hat
    const lowEnergy = rawBands.subBass * 0.6 + rawBands.bass * 0.4;
    const lowDelta = lowEnergy - prevLowEnergy;
    prevLowEnergy = lowEnergy;
    if (lowDelta > 0.12 && lowEnergy > 0.25) {
      kickTransient = Math.min(1.0, kickTransient + lowDelta * 2.4);
      mirrorPhase = (mirrorPhase + 1) % 4;
    } else {
      kickTransient = Math.max(0, kickTransient * Math.pow(0.5, dt / 0.095));
    }

    const snareEnergy = rawBands.mid * 0.5 + rawBands.upperMid * 0.5;
    const snareDelta = snareEnergy - prevSnareEnergy;
    prevSnareEnergy = snareEnergy;
    if (snareDelta > 0.1 && snareEnergy > 0.2) {
      snareTransient = Math.min(1.0, snareTransient + snareDelta * 2.5);
    } else {
      snareTransient = Math.max(0, snareTransient * Math.pow(0.5, dt / 0.08));
    }

    const hatEnergy = rawBands.presence * 0.45 + rawBands.brilliance * 0.55;
    const hatDelta = hatEnergy - prevHatEnergy;
    prevHatEnergy = hatEnergy;
    if (hatDelta > 0.08 && hatEnergy > 0.15) {
      hiHatSparkle = Math.min(1.5, hiHatSparkle + hatDelta * 2.8);
    } else {
      hiHatSparkle = Math.max(
        0,
        adaptiveHalfLifeSmooth(hiHatSparkle, hatEnergy * 0.85, dt, 0.005, 0.07)
      );
    }

    const juiceBounce = computeJuiceBounce(smoothedBands.bass, smoothedBands.mid) * bounceIntensity;
    const spikeEnv = computeAudioSpikeEnvelope(
      smoothedBands,
      kickTransient,
      snareTransient,
      spikeSens
    );

    const rmsEnergy = Math.min(1, rawRms * 1.8);
    // Always advance cumulative bass and dynamicTime deterministically every frame so video export never appears stuck on Frame 1
    bassCumulative +=
      (smoothedBands.bass + smoothedBands.subBass * 0.7) * dt * 4.2 + dt * 0.35 * baseCameraSpeed;
    midCumulative +=
      (smoothedBands.mid * 0.65 + smoothedBands.upperMid * 0.45) * dt * 2.6 +
      dt * 0.2 * baseCameraSpeed;
    dynamicTime += dt * Math.max(0.85 * baseCameraSpeed, spikeEnv.timeRateMultiplier);

    const estimatedFreqHz = Math.max(
      55,
      Math.min(2400, (zeroCrossings * safeSr) / (2 * count))
    );
    const pitchInfo = frequencyToPitchHue(estimatedFreqHz);
    smoothedPitchHue = adaptiveHalfLifeSmooth(
      smoothedPitchHue,
      pitchInfo.pitchHue,
      dt,
      0.03,
      0.22
    );

    const bpmPhase = computeBpmSawtoothPhase(timeSec, bpm);

    return {
      frameIndex,
      timeSec,
      bands: { ...smoothedBands },
      rmsEnergy,
      audioIntensity: spikeEnv.audioIntensity,
      fractalSpike: spikeEnv.fractalSpike,
      juiceBounce,
      kickTransient,
      snareTransient,
      hiHatSparkle,
      bpmPhase,
      pitchHue: smoothedPitchHue,
      bassCumulative,
      midCumulative,
      dynamicTime,
      mirrorPhase,
    };
  };

  return { stepFrameAtTime };
}

let activeJitExtractorInstance: JitOfflineAudioAnalyzer | null = null;
let activeJitExtractorPcmRef: Float32Array | null = null;

/**
 * Extracts Just-In-Time (JIT) 2048-sample audio bands, transients, and cumulative registers
 * from raw PCM samples at timestamp `t = frameIdx * dt` for `renderOfflineVideoGuaranteed`.
 */
export function extractJitAudioBandsAtTime(
  pcmData: Float32Array | null,
  sampleRate: number,
  t: number,
  dt: number,
  frameIdx: number,
  options?: JitOfflineAudioAnalyzerOptions
): PrecomputedAudioFrame {
  const safeData = pcmData ?? new Float32Array(0);
  const fps = Math.max(1, Math.round(1 / Math.max(0.001, dt)));
  if (
    frameIdx === 0 ||
    !activeJitExtractorInstance ||
    activeJitExtractorPcmRef !== pcmData
  ) {
    activeJitExtractorPcmRef = pcmData;
    activeJitExtractorInstance = createJitOfflineAudioAnalyzer(safeData, sampleRate, fps, options);
  }
  return activeJitExtractorInstance.stepFrameAtTime(frameIdx, t);
}

/**
 * Deterministic Offline Audio Timeline Pre-Computer:
 * Uses `createJitOfflineAudioAnalyzer` across `totalFrames`.
 * For zero-startup-delay video export, call `createJitOfflineAudioAnalyzer` directly inside the frame loop.
 */
export function precomputeOfflineAudioTimeline(
  channelData: Float32Array,
  sampleRate: number,
  totalFrames: number,
  exportFps: number,
  options?: JitOfflineAudioAnalyzerOptions
): PrecomputedAudioFrame[] {
  const safeFps = Math.max(1, exportFps || 60);
  const analyzer = createJitOfflineAudioAnalyzer(channelData, sampleRate, safeFps, options);
  const frames: PrecomputedAudioFrame[] = [];
  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    frames.push(analyzer.stepFrameAtTime(frameIndex, frameIndex / safeFps));
  }
  return frames;
}

/**
 * Computes the signed camera / fractal zoom direction multiplier:
 * - 'inward': +1.0 (continuous inward dive)
 * - 'outward': -1.0 (continuous outward emergence)
 * - 'pendulum': smooth BPM-locked sinusoidal oscillation in [-1, 1]
 */
export function computeZoomDirectionMultiplier(
  mode: 'inward' | 'outward' | 'pendulum',
  bpmPhase: number
): number {
  if (mode === 'outward') return -1.0;
  if (mode === 'pendulum') {
    const val = Math.sin(bpmPhase * Math.PI * 2);
    return Math.abs(val) < 0.15 ? (val >= 0 ? 0.15 : -0.15) : val;
  }
  return 1.0;
}

/**
 * Synthesizes a 3D Height / Depth Map in the Alpha channel (index + 3) of an RGBA Uint8ClampedArray
 * by combining perceptual luminance (0.299R + 0.587G + 0.114B), Sobel edge magnitude, and radial center weight.
 */
export function computeRgbaDepthMapInPlace(
  rgbaData: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): void {
  const w = Math.max(1, width | 0);
  const h = Math.max(1, height | 0);
  const totalPixels = w * h;
  if (rgbaData.length < totalPixels * 4) return;

  const luma = new Float32Array(totalPixels);
  for (let i = 0; i < totalPixels; i++) {
    const base = i * 4;
    luma[i] =
      (0.299 * rgbaData[base] + 0.587 * rgbaData[base + 1] + 0.114 * rgbaData[base + 2]) / 255;
  }

  for (let y = 0; y < h; y++) {
    const ny = (y / Math.max(1, h - 1)) * 2 - 1;
    for (let x = 0; x < w; x++) {
      const nx = (x / Math.max(1, w - 1)) * 2 - 1;
      const idx = y * w + x;

      const x0 = Math.max(0, x - 1);
      const x1 = Math.min(w - 1, x + 1);
      const y0 = Math.max(0, y - 1);
      const y1 = Math.min(h - 1, y + 1);

      // 3x3 Sobel gradient approximation
      const gx =
        -luma[y0 * w + x0] +
        luma[y0 * w + x1] -
        2 * luma[y * w + x0] +
        2 * luma[y * w + x1] -
        luma[y1 * w + x0] +
        luma[y1 * w + x1];
      const gy =
        -luma[y0 * w + x0] -
        2 * luma[y0 * w + x] -
        luma[y0 * w + x1] +
        luma[y1 * w + x0] +
        2 * luma[y1 * w + x] +
        luma[y1 * w + x1];

      const edgeMag = Math.min(1, Math.sqrt(gx * gx + gy * gy) * 0.85);
      const radialDist = Math.sqrt(nx * nx + ny * ny);
      const centerWeight = Math.max(0, 1 - radialDist * 0.55);

      const depthNorm = Math.max(
        0.04,
        Math.min(1.0, luma[idx] * 0.52 + edgeMag * 0.33 + centerWeight * 0.15)
      );
      rgbaData[idx * 4 + 3] = Math.round(depthNorm * 255);
    }
  }
}

