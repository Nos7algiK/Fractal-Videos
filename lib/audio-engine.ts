import {
  adaptiveHalfLifeSmooth,
  applyPeakExaggeration,
  computeAudioSpikeEnvelope,
  computeBpmSawtoothPhase,
  computeFrequencyBands,
  computeJuiceBounce,
  dbToLinear,
  frequencyToPitchHue,
  getActiveChoreographyKeyframe,
} from './dsp-math';
import { transientState, useStudioStore } from './store';
import { AcousticSummary, FrequencyBands } from './types';

export class AudioAnalyzerEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private streamDest: MediaStreamAudioDestinationNode | null = null;

  // File playback element & decoded PCM buffer for Offline Frame-by-Frame Rendering & Live WebAudio Playback
  private audioEl: HTMLAudioElement | null = null;
  private mediaSourceNode: MediaElementAudioSourceNode | null = null;
  private decodedAudioBuffer: AudioBuffer | null = null;
  private fileBufferSource: AudioBufferSourceNode | null = null;
  private fileStartTime = 0;
  private filePauseOffset = 0;
  private isUsingFileBufferSource = false;

  // Built-in procedural synth scheduler
  private synthTimer: number | null = null;
  private synthStep = 0;
  private synthStartTime = 0;

  // FFT buffers
  private freqDbBuffer: Float32Array<ArrayBuffer> = new Float32Array(1024);
  private freqLinearBuffer: Float32Array<ArrayBuffer> = new Float32Array(1024);

  // Rolling history for Kick, Snare & BPM detection
  private bassHistory: number[] = [];
  private snareHistory: number[] = [];
  private kickTimestamps: number[] = [];
  private lastKickTime = 0;
  private lastSnareTime = 0;

  private smoothedBands: FrequencyBands = {
    subBass: 0,
    bass: 0,
    lowMid: 0,
    mid: 0,
    upperMid: 0,
    presence: 0,
    brilliance: 0,
  };

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.0;

      this.filterNode = this.ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.value = 18000;
      this.filterNode.Q.value = 1.4;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = useStudioStore.getState().audioVolume;

      this.streamDest = this.ctx.createMediaStreamDestination();

      this.filterNode.connect(this.analyser);
      this.analyser.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.connect(this.streamDest);

      this.freqDbBuffer = new Float32Array(this.analyser.frequencyBinCount);
      this.freqLinearBuffer = new Float32Array(this.analyser.frequencyBinCount);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private stopFileBufferSource() {
    if (this.fileBufferSource) {
      try {
        this.fileBufferSource.onended = null;
        this.fileBufferSource.stop();
      } catch {
        // Ignore if already stopped
      }
      try {
        this.fileBufferSource.disconnect();
      } catch {
        // Ignore disconnect error
      }
      this.fileBufferSource = null;
    }
  }

  private startFileBufferSource(offsetSec = 0, loop = true) {
    const ctx = this.ensureContext();
    if (!this.decodedAudioBuffer || !this.filterNode) return false;
    this.stopFileBufferSource();
    if (this.audioEl && !this.audioEl.paused) {
      try {
        this.audioEl.pause();
      } catch {}
    }

    const dur = Math.max(0.1, this.decodedAudioBuffer.duration);
    const safeOffset = ((offsetSec % dur) + dur) % dur;

    const src = ctx.createBufferSource();
    src.buffer = this.decodedAudioBuffer;
    src.loop = loop;
    src.connect(this.filterNode);
    src.start(0, safeOffset);

    this.fileBufferSource = src;
    this.fileStartTime = ctx.currentTime - safeOffset;
    this.filePauseOffset = safeOffset;
    this.isUsingFileBufferSource = true;
    return true;
  }

  public getAudioStream(): MediaStream | null {
    this.ensureContext();
    return this.streamDest ? this.streamDest.stream : null;
  }

  public setVolume(vol: number) {
    useStudioStore.getState().setShaderParam('audioVolume', vol);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.02);
    }
  }

  /**
   * Instant Touch Timeline Seek & Shader Clock Synchronization:
   * Updates the WebAudio buffer source / HTMLAudioElement / procedural synth offset AND immediately synchronizes
   * `transientState.dynamicTime`, `u_bassCumulative`, and `u_midCumulative` so the
   * 4D Tesseract, Bass Reactor, or Procedural World jumps cleanly to timestamp `timeSec`.
   */
  public seekToTime(timeSec: number) {
    const store = useStudioStore.getState();
    const duration = Math.max(1, store.trackDuration || transientState.duration || 180);
    const clampedTime = Math.max(0, Math.min(duration, timeSec));

    if (store.audioSourceType === 'file') {
      this.filePauseOffset = clampedTime;
      if (this.decodedAudioBuffer) {
        if (store.isPlaying) {
          this.startFileBufferSource(clampedTime, true);
        } else if (this.ctx) {
          this.fileStartTime = this.ctx.currentTime - clampedTime;
        }
      } else if (this.audioEl) {
        try {
          this.audioEl.currentTime = clampedTime;
        } catch {
          // Ignore DOMException if media isn't ready
        }
      }
    } else if (this.ctx) {
      this.synthStartTime = this.ctx.currentTime - clampedTime;
      const stepSec = 60 / 124 / 4;
      this.synthStep = Math.floor(clampedTime / stepSec);
    }

    // Deterministically synchronize shader clocks to the exact musical timestamp
    transientState.currentTime = clampedTime;
    transientState.dynamicTime = 1.25 + clampedTime * 1.15;
    transientState.bassCumulative = clampedTime * 1.45;
    transientState.midCumulative = clampedTime * 0.92;
    transientState.bpmPhase = computeBpmSawtoothPhase(
      clampedTime,
      transientState.estimatedBpm || 124
    );

    // Sync AI choreography section marker for the new timestamp
    const activeChoreo = store.choreographies[store.activeChoreographyIndex];
    if (activeChoreo && activeChoreo.timelineKeyframes.length > 0) {
      const progress = (clampedTime % duration) / duration;
      const activeKf = getActiveChoreographyKeyframe(activeChoreo.timelineKeyframes, progress);
      if (activeKf) {
        useStudioStore.setState({
          activeSectionName: activeKf.section,
          ...(store.autoChoreographyEnabled
            ? {
                cameraSpeed: activeKf.speedMultiplier,
                bloomIntensity: activeKf.bloomIntensity,
                bulbPower: activeKf.bulbPower,
                kleinianScale: activeKf.kleinianScale,
                foldLimit: activeKf.foldLimit,
                chaosMode: activeKf.chaosMode,
              }
            : {}),
        });
        if (store.autoChoreographyEnabled && activeKf.fractalMode !== store.fractalMode) {
          store.setFractalMode(activeKf.fractalMode);
        }
      }
    }
  }

  public skipRelative(deltaSec: number) {
    const duration = Math.max(1, useStudioStore.getState().trackDuration || transientState.duration || 180);
    const target = Math.max(0, Math.min(duration, transientState.currentTime + deltaSec));
    this.seekToTime(target);
  }

  public async loadAudioFile(file: File): Promise<AcousticSummary> {
    const ctx = this.ensureContext();
    try {
      await ctx.resume();
    } catch {}
    this.stopAll();

    // Ensure the live preview window is visible and active immediately when user uploads music
    useStudioStore.setState({
      isPreviewHidden: false,
      loopA: null,
      loopB: null,
      abLoopActive: false,
    });
    useStudioStore.getState().setAudioStatus(true, file.name, 'file');

    // Decode full audio buffer for direct WebAudio playback, offline rendering, 120-bar seek waveform & 28D acoustic summary
    const summary = await this.extractAcousticSummaryFromFile(file, ctx, 180);

    let playSucceeded = false;
    if (this.decodedAudioBuffer) {
      playSucceeded = this.startFileBufferSource(0, true);
    }

    // Fallback to HTMLAudioElement only if WebAudio decodeAudioData did not support the container
    if (!playSucceeded) {
      this.isUsingFileBufferSource = false;
      const objectUrl = URL.createObjectURL(file);
      if (!this.audioEl) {
        this.audioEl = new Audio();
        this.audioEl.preload = 'auto';
        this.audioEl.loop = true;
      }
      this.audioEl.src = objectUrl;
      this.audioEl.load();

      if (!this.mediaSourceNode && this.audioEl && this.filterNode) {
        try {
          this.mediaSourceNode = ctx.createMediaElementSource(this.audioEl);
          this.mediaSourceNode.connect(this.filterNode);
        } catch {}
      }
      try {
        await this.audioEl.play();
        playSucceeded = true;
      } catch {
        playSucceeded = false;
      }
    }

    const finalDuration =
      summary.durationSeconds > 0
        ? summary.durationSeconds
        : this.decodedAudioBuffer?.duration
          ? Math.round(this.decodedAudioBuffer.duration)
          : 180;

    transientState.duration = finalDuration;
    transientState.currentTime = 0;
    useStudioStore.setState({
      trackDuration: finalDuration,
      isPreviewHidden: false,
    });
    useStudioStore.getState().setAcousticSummary(summary);
    useStudioStore.getState().setAudioStatus(playSucceeded || Boolean(this.decodedAudioBuffer), file.name, 'file');
    return summary;
  }

  private async extractAcousticSummaryFromFile(
    file: File,
    ctx: AudioContext,
    fallbackDuration = 180
  ): Promise<AcousticSummary> {
    try {
      const fullArrayBuffer = await file.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(fullArrayBuffer.slice(0));
      this.decodedAudioBuffer = audioBuffer;
      const channelData = audioBuffer.getChannelData(0);
      const len = channelData.length;
      const step = Math.max(1, Math.floor(len / 28000));

      let sumSq = 0;
      let peak = 0;
      let zeroCrossings = 0;
      const buckets = new Array(28).fill(0);
      const waveformBins = new Array(120).fill(0);
      const waveformCounts = new Array(120).fill(0);

      for (let i = 0; i < len; i += step) {
        const sample = channelData[i];
        const abs = Math.abs(sample);
        sumSq += sample * sample;
        if (abs > peak) peak = abs;
        if (i > step && Math.sign(channelData[i]) !== Math.sign(channelData[i - step])) {
          zeroCrossings++;
        }
        const bucketIdx = Math.min(27, Math.floor((i / len) * 28));
        buckets[bucketIdx] += abs;

        const waveIdx = Math.min(119, Math.floor((i / len) * 120));
        waveformBins[waveIdx] += abs;
        waveformCounts[waveIdx] += 1;
      }

      const avgWave = waveformBins.map((sum, idx) =>
        waveformCounts[idx] > 0 ? sum / waveformCounts[idx] : 0.1
      );
      const maxWave = Math.max(...avgWave, 0.0001);
      const waveformPeaks = avgWave.map((v) =>
        Number(Math.max(0.1, Math.min(1.0, v / maxWave)).toFixed(3))
      );
      useStudioStore.setState({ waveformPeaks });

      // Offload high-resolution 120-bin RMS + peak envelope refinement to an inline Web Worker
      // so the Android main touch thread stays 100% responsive
      if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
        try {
          const workerScript = `
            self.onmessage = function(e) {
              const samples = e.data.samples;
              const bins = 120;
              const out = new Array(bins).fill(0.12);
              if (samples && samples.length > 0) {
                const blockSize = Math.max(1, Math.floor(samples.length / bins));
                let maxVal = 0.0001;
                for (let b = 0; b < bins; b++) {
                  const start = b * blockSize;
                  const end = Math.min(samples.length, start + blockSize);
                  let sum = 0;
                  let count = 0;
                  const stride = Math.max(1, Math.floor((end - start) / 256));
                  for (let i = start; i < end; i += stride) {
                    sum += Math.abs(samples[i]);
                    count++;
                  }
                  const avg = count > 0 ? sum / count : 0.1;
                  out[b] = avg;
                  if (avg > maxVal) maxVal = avg;
                }
                for (let b = 0; b < bins; b++) {
                  out[b] = Number(Math.max(0.1, Math.min(1.0, out[b] / maxVal)).toFixed(3));
                }
              }
              self.postMessage({ peaks: out });
            };
          `;
          const blob = new Blob([workerScript], { type: 'application/javascript' });
          const workerUrl = URL.createObjectURL(blob);
          const worker = new Worker(workerUrl);
          const transferCopy = new Float32Array(channelData);
          worker.onmessage = (ev) => {
            if (ev.data && Array.isArray(ev.data.peaks)) {
              useStudioStore.setState({ waveformPeaks: ev.data.peaks });
            }
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
          };
          worker.onerror = () => {
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
          };
          worker.postMessage({ samples: transferCopy }, [transferCopy.buffer]);
        } catch {
          // Synchronous fallback already populated waveformPeaks above
        }
      }

      const count = Math.ceil(len / step);
      const meanRms = Math.min(1, Math.sqrt(sumSq / Math.max(1, count)));
      const maxBucket = Math.max(...buckets, 0.0001);
      const featureVector28D = buckets.map((v) => Number((v / maxBucket).toFixed(3)));

      const zcrRate = zeroCrossings / Math.max(1, audioBuffer.duration);
      const spectralCentroidHz = Math.round(Math.max(220, Math.min(6400, zcrRate * 0.85)));
      const keys = ['C Minor', 'D# Major', 'F Minor', 'G Minor', 'A Minor', 'E Minor', 'G# Major'];
      const keyIdx = Math.abs(Math.round(spectralCentroidHz + meanRms * 100)) % keys.length;
      const estimatedBpm = Math.round(110 + ((spectralCentroidHz % 45) + meanRms * 20));
      const { pitchHue } = frequencyToPitchHue(spectralCentroidHz * 0.25);

      return {
        trackName: file.name,
        durationSeconds: Math.round(audioBuffer.duration),
        meanRms: Number(meanRms.toFixed(3)),
        peakRms: Number(peak.toFixed(3)),
        spectralCentroidHz,
        bassToMidRatio: Number((1.2 + meanRms * 0.9).toFixed(2)),
        subBassEnergy: Number(Math.min(1, meanRms * 1.45).toFixed(2)),
        highFreqBrilliance: Number(Math.min(1, spectralCentroidHz / 5000).toFixed(2)),
        dynamicRangeDb: Number((20 * Math.log10(Math.max(peak, 0.01) / Math.max(meanRms, 0.005))).toFixed(1)),
        estimatedBpm,
        dominantKey: keys[keyIdx],
        dominantPitchHue: Number(pitchHue.toFixed(3)),
        transientDensity: Number((estimatedBpm / 30).toFixed(2)),
        featureVector28D,
      };
    } catch {
      const existing = useStudioStore.getState().acousticSummary;
      return {
        ...(existing || {
          meanRms: 0.42,
          peakRms: 0.94,
          spectralCentroidHz: 1480,
          bassToMidRatio: 1.55,
          subBassEnergy: 0.68,
          highFreqBrilliance: 0.44,
          dynamicRangeDb: 12.4,
          estimatedBpm: 124,
          dominantKey: 'F Minor',
          dominantPitchHue: 0.42,
          transientDensity: 4.1,
          featureVector28D: new Array(28).fill(0.5),
        }),
        trackName: file.name,
        durationSeconds: fallbackDuration,
      };
    }
  }

  /**
   * Returns a decoded or deterministically synthesized PCM buffer (`Float32Array` + `AudioBuffer`)
   * sliced from `startOffsetSec` for `durationSec` seconds for the Zero-Lag Offline Video Exporter.
   */
  public async getOrSynthesizeOfflineAudioBuffer(
    durationSec: number,
    startOffsetSec = 0
  ): Promise<{
    leftChannel: Float32Array;
    rightChannel: Float32Array;
    sampleRate: number;
  }> {
    const store = useStudioStore.getState();
    const targetDuration = Math.max(1, Math.min(600, durationSec));
    const safeOffsetSec = Math.max(0, Number.isFinite(startOffsetSec) ? startOffsetSec : 0);

    if (store.audioSourceType === 'file' && this.decodedAudioBuffer) {
      const sr = this.decodedAudioBuffer.sampleRate;
      const totalBufSamples = this.decodedAudioBuffer.length;
      const startSample = Math.min(
        Math.max(0, totalBufSamples - 1),
        Math.floor(safeOffsetSec * sr)
      );
      const endSample = Math.min(
        totalBufSamples,
        startSample + Math.max(1, Math.floor(targetDuration * sr))
      );
      const left = this.decodedAudioBuffer.getChannelData(0).slice(startSample, endSample);
      const right =
        this.decodedAudioBuffer.numberOfChannels > 1
          ? this.decodedAudioBuffer.getChannelData(1).slice(startSample, endSample)
          : new Float32Array(left);
      return { leftChannel: left, rightChannel: right, sampleRate: sr };
    }

    // Synthesize one 64-step phrase (~7.74s) of the 124 BPM Bass Odyssey (offset by safeOffsetSec)
    // and tile via fast memory copy so even 3-minute Full Song or Section renders never block the UI thread
    const sampleRate = 48000;
    const totalSamples = Math.floor(targetDuration * sampleRate);
    const leftChannel = new Float32Array(totalSamples);
    const rightChannel = new Float32Array(totalSamples);

    const stepSec = 60 / 124 / 4; // 16th note at 124 BPM = 0.1209677s
    const phraseSamples = Math.min(totalSamples, Math.max(1, Math.round(64 * stepSec * sampleRate)));
    const bassNotesHz = [65.41, 65.41, 77.78, 87.31, 98.0, 77.78, 65.41, 58.27];
    const arpNotesHz = [261.63, 311.13, 392.0, 523.25, 622.25, 783.99, 523.25, 392.0];

    for (let i = 0; i < phraseSamples; i++) {
      const t = safeOffsetSec + i / sampleRate;
      const step = Math.floor(t / stepSec);
      const stepTime = t - step * stepSec;
      const phraseStep = step % 64;
      const isQuietBreakdown = phraseStep >= 48 && phraseStep < 60;

      if (isQuietBreakdown) {
        const padFreq = arpNotesHz[Math.floor(step / 8) % arpNotesHz.length] * 0.5;
        const padSample = Math.sin(2 * Math.PI * padFreq * t) * Math.exp(-stepTime * 5.0) * 0.08;
        leftChannel[i] = padSample;
        rightChannel[i] = padSample;
        continue;
      }

      let sampleL = 0;
      let sampleR = 0;

      // 1. 4-on-the-floor Kick Drum
      if (step % 4 === 0 || step % 16 === 14) {
        if (stepTime < 0.26) {
          const kickFreq = 36 + 110 * Math.exp(-stepTime * 22);
          const kickEnv = Math.exp(-stepTime * 11);
          const kickVal = Math.sin(2 * Math.PI * kickFreq * stepTime) * kickEnv * 0.58;
          sampleL += kickVal;
          sampleR += kickVal;
        }
      }

      // 2. Snare / Clap on steps 4 and 12
      if (step % 8 === 4 && stepTime < 0.15) {
        const noise = Math.sin(i * 12.9898) * 43758.5453;
        const white = (noise - Math.floor(noise)) * 2 - 1;
        const snareEnv = Math.exp(-stepTime * 24);
        const snareVal = white * snareEnv * 0.28;
        sampleL += snareVal;
        sampleR += snareVal * 0.92;
      }

      // 3. Rolling Sub-Bass on off-beats
      if (step % 2 === 1 && stepTime < 0.18) {
        const bassFreq = bassNotesHz[Math.floor(step / 4) % bassNotesHz.length];
        const bassEnv = Math.exp(-stepTime * 10);
        const saw = 2 * ((t * bassFreq) - Math.floor(0.5 + t * bassFreq));
        const bassVal = saw * bassEnv * 0.26;
        sampleL += bassVal;
        sampleR += bassVal;
      }

      // 4. Melodic Arpeggio
      if (stepTime < 0.12) {
        const arpFreq = arpNotesHz[step % arpNotesHz.length] * (step % 32 >= 16 ? 1.5 : 1.0);
        const arpEnv = Math.exp(-stepTime * 18);
        const arpVal = Math.sin(2 * Math.PI * arpFreq * stepTime) * arpEnv * 0.18;
        sampleL += arpVal * 1.05;
        sampleR += arpVal * 0.95;
      }

      leftChannel[i] = Math.max(-0.98, Math.min(0.98, sampleL));
      rightChannel[i] = Math.max(-0.98, Math.min(0.98, sampleR));
    }

    for (let offset = phraseSamples; offset < totalSamples; offset += phraseSamples) {
      const copyLen = Math.min(phraseSamples, totalSamples - offset);
      leftChannel.set(leftChannel.subarray(0, copyLen), offset);
      rightChannel.set(rightChannel.subarray(0, copyLen), offset);
    }

    return { leftChannel, rightChannel, sampleRate };
  }

  /**
   * Returns a standard WebAudio `AudioBuffer` trimmed/synthesized from `startOffsetSec` for `durationSec`
   * for the standalone raw WebGL2 + `gl.readPixels` binary video exporter (`renderOfflineVideoGuaranteed`).
   */
  public async getOrSynthesizeOfflineWebAudioBuffer(
    durationSec: number,
    startOffsetSec = 0
  ): Promise<AudioBuffer | null> {
    try {
      const { leftChannel, rightChannel, sampleRate } =
        await this.getOrSynthesizeOfflineAudioBuffer(durationSec, startOffsetSec);
      const ctx = this.ensureContext();
      const frameCount = Math.max(1, leftChannel.length);
      const audioBuffer = ctx.createBuffer(2, frameCount, sampleRate);
      audioBuffer.copyToChannel(new Float32Array(leftChannel), 0);
      audioBuffer.copyToChannel(
        new Float32Array(rightChannel.length === frameCount ? rightChannel : leftChannel),
        1
      );
      return audioBuffer;
    } catch {
      return null;
    }
  }

  /**
   * Creates a WebAudio `MediaStreamDestination` track playing the given PCM `leftChannel`/`rightChannel`
   * buffer so the Frame-Paced 2D `recCanvas.captureStream(fps)` + `MediaRecorder` fallback records
   * synchronized stereo audio when AAC `AudioEncoder` is unavailable on an Android device.
   */
  public createExportMediaStreamAudioTrack(
    leftChannel: Float32Array,
    rightChannel: Float32Array,
    sampleRate: number
  ): { audioTrack: MediaStreamTrack | null; stop: () => void } {
    try {
      const ctx = this.ensureContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const frameCount = Math.max(1, leftChannel.length);
      const buffer = ctx.createBuffer(2, frameCount, sampleRate);
      buffer.copyToChannel(new Float32Array(leftChannel), 0);
      buffer.copyToChannel(
        new Float32Array(rightChannel.length === frameCount ? rightChannel : leftChannel),
        1
      );

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const dest = ctx.createMediaStreamDestination();
      source.connect(dest);
      source.start(0);

      const audioTrack = dest.stream.getAudioTracks()[0] || null;
      return {
        audioTrack,
        stop: () => {
          try {
            source.stop();
          } catch {}
          try {
            source.disconnect();
          } catch {}
          if (audioTrack) {
            try {
              audioTrack.stop();
            } catch {}
          }
        },
      };
    } catch {
      return { audioTrack: null, stop: () => {} };
    }
  }

  public togglePlayPause() {
    const store = useStudioStore.getState();
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    if (store.isPlaying) {
      this.pause();
    } else {
      if (store.audioSourceType === 'file') {
        if (this.decodedAudioBuffer) {
          this.startFileBufferSource(this.filePauseOffset || transientState.currentTime || 0, true);
          store.setAudioStatus(true);
          return;
        } else if (this.audioEl && this.audioEl.src) {
          this.audioEl.play().catch(() => {});
          store.setAudioStatus(true);
          return;
        }
      }
      this.startProceduralSynth(transientState.currentTime);
      store.setAudioStatus(true, 'Built-in Synesthetic Bass Odyssey (124 BPM)', 'synth');
    }
  }

  public useBuiltInSynth() {
    this.stopAll();
    const store = useStudioStore.getState();
    transientState.currentTime = 0;
    transientState.duration = 180;
    useStudioStore.setState({
      trackDuration: 180,
      loopA: null,
      loopB: null,
      abLoopActive: false,
      isPreviewHidden: false,
    });
    this.startProceduralSynth(0);
    store.setAudioStatus(true, 'Built-in Synesthetic Bass Odyssey (124 BPM)', 'synth');
  }

  public startFullSongExportPlayback(onEnded: () => void): number {
    const ctx = this.ensureContext();
    const store = useStudioStore.getState();

    transientState.currentTime = 0;
    transientState.bassCumulative = 0;
    transientState.midCumulative = 0;

    useStudioStore.setState({
      activeSectionName: 'Intro',
    });

    if (store.audioSourceType === 'file' && this.decodedAudioBuffer) {
      const dur = Math.max(1, Math.ceil(this.decodedAudioBuffer.duration));
      transientState.duration = dur;
      useStudioStore.setState({ trackDuration: dur });
      this.startFileBufferSource(0, false);
      if (this.fileBufferSource) {
        this.fileBufferSource.onended = () => {
          onEnded();
        };
      }
      store.setAudioStatus(true);
      return dur;
    } else if (store.audioSourceType === 'file' && this.audioEl && this.audioEl.src) {
      this.audioEl.pause();
      this.audioEl.currentTime = 0;
      this.audioEl.loop = false;
      this.audioEl.onended = () => {
        onEnded();
      };
      const dur =
        this.audioEl.duration && Number.isFinite(this.audioEl.duration) && this.audioEl.duration > 0
          ? Math.ceil(this.audioEl.duration)
          : store.trackDuration || 180;
      transientState.duration = dur;
      useStudioStore.setState({ trackDuration: dur });
      this.audioEl.play().catch(() => {});
      store.setAudioStatus(true);
      return dur;
    } else {
      this.synthStep = 0;
      this.synthStartTime = ctx.currentTime;
      this.startProceduralSynth(0);
      const synthDur = 120;
      transientState.duration = synthDur;
      useStudioStore.setState({ trackDuration: synthDur });
      store.setAudioStatus(true, 'Built-in Synesthetic Bass Odyssey (124 BPM)', 'synth');
      return synthDur;
    }
  }

  public restoreLoopingAfterExport() {
    if (this.audioEl) {
      this.audioEl.loop = true;
      this.audioEl.onended = null;
    }
    if (this.fileBufferSource) {
      this.fileBufferSource.loop = true;
      this.fileBufferSource.onended = null;
    }
  }

  public pause() {
    if (this.isUsingFileBufferSource && this.ctx && this.decodedAudioBuffer) {
      const dur = Math.max(0.1, this.decodedAudioBuffer.duration);
      this.filePauseOffset = Math.max(0, (this.ctx.currentTime - this.fileStartTime) % dur);
    }
    this.stopFileBufferSource();
    if (this.audioEl) {
      this.audioEl.pause();
    }
    if (this.synthTimer !== null) {
      window.clearInterval(this.synthTimer);
      this.synthTimer = null;
    }
    useStudioStore.getState().setAudioStatus(false);
  }

  public stopAll() {
    this.pause();
    this.filePauseOffset = 0;
    this.synthStep = 0;
  }

  private startProceduralSynth(startOffsetSec = 0) {
    const ctx = this.ensureContext();
    if (this.synthTimer !== null) {
      window.clearInterval(this.synthTimer);
    }
    this.synthStartTime = ctx.currentTime - startOffsetSec;
    if (transientState.duration <= 0) {
      transientState.duration = 180;
    }

    const stepMs = (60 / 124 / 4) * 1000;
    const bassNotesHz = [65.41, 65.41, 77.78, 87.31, 98.0, 77.78, 65.41, 58.27];
    const arpNotesHz = [261.63, 311.13, 392.0, 523.25, 622.25, 783.99, 523.25, 392.0];

    this.synthTimer = window.setInterval(() => {
      if (!this.ctx || !this.filterNode) return;
      const now = this.ctx.currentTime;
      const step = this.synthStep++;

      const phraseStep = step % 64;
      const isQuietBreakdown = phraseStep >= 48 && phraseStep < 60;
      const isRiser = phraseStep >= 60;

      if (isQuietBreakdown) {
        if (step % 8 === 0) {
          const padOsc = this.ctx.createOscillator();
          const padGain = this.ctx.createGain();
          padOsc.type = 'sine';
          padOsc.frequency.setValueAtTime(arpNotesHz[(step / 8) % arpNotesHz.length] * 0.5, now);
          padGain.gain.setValueAtTime(0.025, now);
          padGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.35);
          padOsc.connect(padGain);
          padGain.connect(this.filterNode);
          padOsc.start(now);
          padOsc.stop(now + 0.36);
        }
        return;
      }

      const intensityGain = isRiser ? 1.25 : 1.0;

      if (step % 4 === 0 || step % 16 === 14 || isRiser) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(145, now);
        osc.frequency.exponentialRampToValueAtTime(34, now + 0.15);
        gain.gain.setValueAtTime(0.92 * intensityGain, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.connect(gain);
        gain.connect(this.filterNode);
        osc.start(now);
        osc.stop(now + 0.29);
      }

      if (step % 8 === 4 || (isRiser && step % 2 === 0)) {
        const bufferSize = this.ctx.sampleRate * 0.15;
        const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.28));
        }
        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;

        const bandpass = this.ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.setValueAtTime(1850, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.65 * intensityGain, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

        whiteNoise.connect(bandpass);
        bandpass.connect(gain);
        gain.connect(this.filterNode);
        whiteNoise.start(now);
      }

      if (step % 2 === 1) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        const noteFreq = bassNotesHz[Math.floor(step / 4) % bassNotesHz.length];
        osc.frequency.setValueAtTime(noteFreq, now);
        gain.gain.setValueAtTime(0.38 * intensityGain, now);
        gain.gain.exponentialRampToValueAtTime(0.008, now + 0.18);
        osc.connect(gain);
        gain.connect(this.filterNode);
        osc.start(now);
        osc.stop(now + 0.19);
      }

      const arpOsc = this.ctx.createOscillator();
      const arpGain = this.ctx.createGain();
      arpOsc.type = 'triangle';
      const arpFreq = arpNotesHz[step % arpNotesHz.length] * (step % 32 >= 16 ? 1.5 : 1.0);
      arpOsc.frequency.setValueAtTime(arpFreq, now);
      arpGain.gain.setValueAtTime(0.24 * intensityGain, now);
      arpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      arpOsc.connect(arpGain);
      arpGain.connect(this.filterNode);
      arpOsc.start(now);
      arpOsc.stop(now + 0.13);
    }, stepMs);
  }

  /**
   * Called once per frame inside the 60FPS WebGL render loop.
   * Updates `transientState` in-place with zero React re-renders.
   */
  public updateFrame(dt: number, elapsedTime: number) {
    if (this.filterNode && this.ctx) {
      const cutoffNorm = Math.max(0.05, Math.min(1.0, transientState.xyPad2[0]));
      const targetHz = 180 * Math.pow(100, cutoffNorm);
      this.filterNode.frequency.setTargetAtTime(targetHz, this.ctx.currentTime, 0.015);
    }

    const store = useStudioStore.getState();

    if (store.isPlaying) {
      if (store.audioSourceType === 'file') {
        if (this.isUsingFileBufferSource && this.ctx && this.decodedAudioBuffer) {
          const dur = Math.max(0.5, this.decodedAudioBuffer.duration || store.trackDuration || 180);
          transientState.duration = dur;
          transientState.currentTime = Math.max(0, (this.ctx.currentTime - this.fileStartTime) % dur);
        } else if (this.audioEl) {
          transientState.currentTime = this.audioEl.currentTime;
          transientState.duration = this.audioEl.duration || store.trackDuration || 180;
        }
      } else if (this.ctx) {
        const dur = Math.max(10, store.trackDuration || transientState.duration || 180);
        transientState.duration = dur;
        transientState.currentTime = Math.max(0, (this.ctx.currentTime - this.synthStartTime) % dur);
      }

      // Enforce A/B Loop Region if active
      if (
        store.abLoopActive &&
        store.loopA !== null &&
        store.loopB !== null &&
        store.loopB > store.loopA + 0.5
      ) {
        if (transientState.currentTime >= store.loopB || transientState.currentTime < store.loopA - 0.25) {
          this.seekToTime(store.loopA);
        }
      }
    }

    let rawBands: FrequencyBands;
    let dominantFreqHz = transientState.dominantFreqHz || 261.63;

    if (this.analyser && this.ctx && store.isPlaying) {
      this.analyser.getFloatFrequencyData(this.freqDbBuffer);
      const binCount = this.freqDbBuffer.length;
      let maxMag = 0;
      let maxBin = 6;
      const binWidth = this.ctx.sampleRate / this.analyser.fftSize;

      for (let i = 0; i < binCount; i++) {
        const lin = dbToLinear(this.freqDbBuffer[i]);
        this.freqLinearBuffer[i] = lin;
        const freq = i * binWidth;
        if (freq >= 55 && freq <= 1800 && lin > maxMag) {
          maxMag = lin;
          maxBin = i;
        }
      }

      const unboosted = computeFrequencyBands(
        this.freqLinearBuffer,
        this.ctx.sampleRate,
        this.analyser.fftSize
      );
      const gain = store.reactivityGain;
      const exp = store.peakExponent;
      rawBands = {
        subBass: applyPeakExaggeration(unboosted.subBass * store.subBassKickGain, gain, exp),
        bass: applyPeakExaggeration(unboosted.bass * store.bassMorphGain, gain, exp),
        lowMid: applyPeakExaggeration(unboosted.lowMid * store.lowMidGain, gain, exp),
        mid: applyPeakExaggeration(unboosted.mid * store.midTwistGain, gain, exp),
        upperMid: applyPeakExaggeration(unboosted.upperMid * store.upperMidGain, gain, exp),
        presence: applyPeakExaggeration(unboosted.presence * store.trebleSparkleGain, gain, exp),
        brilliance: applyPeakExaggeration(unboosted.brilliance * store.brillianceGain, gain, exp),
      };

      if (maxMag > 0.08) {
        dominantFreqHz = maxBin * binWidth;
      }
    } else {
      rawBands = {
        subBass: 0.0,
        bass: 0.0,
        lowMid: 0.0,
        mid: 0.0,
        upperMid: 0.0,
        presence: 0.0,
        brilliance: 0.0,
      };
    }

    this.smoothedBands.subBass = adaptiveHalfLifeSmooth(this.smoothedBands.subBass, rawBands.subBass, dt, 0.005, 0.11);
    this.smoothedBands.bass = adaptiveHalfLifeSmooth(this.smoothedBands.bass, rawBands.bass, dt, 0.006, 0.11);
    this.smoothedBands.lowMid = adaptiveHalfLifeSmooth(this.smoothedBands.lowMid, rawBands.lowMid, dt, 0.009, 0.13);
    this.smoothedBands.mid = adaptiveHalfLifeSmooth(this.smoothedBands.mid, rawBands.mid, dt, 0.009, 0.13);
    this.smoothedBands.upperMid = adaptiveHalfLifeSmooth(this.smoothedBands.upperMid, rawBands.upperMid, dt, 0.007, 0.11);
    this.smoothedBands.presence = adaptiveHalfLifeSmooth(this.smoothedBands.presence, rawBands.presence, dt, 0.006, 0.10);
    this.smoothedBands.brilliance = adaptiveHalfLifeSmooth(this.smoothedBands.brilliance, rawBands.brilliance, dt, 0.005, 0.09);

    transientState.bands = this.smoothedBands;

    // Hi-Hat / Cymbal Sparkle envelope
    const hatEnergy = (this.smoothedBands.presence * 0.45 + this.smoothedBands.brilliance * 0.55) * store.trebleSparkleGain;
    transientState.hiHatSparkle = adaptiveHalfLifeSmooth(transientState.hiHatSparkle, hatEnergy, dt, 0.004, 0.08);

    // Continuous BPM Phase Lock
    transientState.bpmPhase = store.bpmCameraSurgeEnabled
      ? computeBpmSawtoothPhase(store.isPlaying ? transientState.currentTime : elapsedTime, transientState.estimatedBpm)
      : 0;

    // Rolling Energy History for Kick & Snare Transients + Real-Time BPM Detector
    const lowEnergy = rawBands.subBass * 0.55 + rawBands.bass * 0.45;
    this.bassHistory.push(lowEnergy);
    if (this.bassHistory.length > 45) this.bassHistory.shift();
    const avgBass = this.bassHistory.reduce((a, b) => a + b, 0) / this.bassHistory.length;

    const nowMs = performance.now();
    if (lowEnergy > avgBass * 1.32 && lowEnergy > 0.22 && nowMs - this.lastKickTime > 190) {
      this.lastKickTime = nowMs;
      transientState.kickTransient = Math.min(1.5, store.subBassKickGain);
      this.kickTimestamps.push(nowMs);
      if (this.kickTimestamps.length > 12) this.kickTimestamps.shift();
      if (this.kickTimestamps.length >= 4) {
        const intervals: number[] = [];
        for (let i = 1; i < this.kickTimestamps.length; i++) {
          const diff = this.kickTimestamps[i] - this.kickTimestamps[i - 1];
          if (diff >= 280 && diff <= 950) intervals.push(diff);
        }
        if (intervals.length > 0) {
          const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          const bpm = Math.round(60000 / avgInterval);
          if (bpm >= 70 && bpm <= 190) {
            transientState.estimatedBpm = bpm;
          }
        }
      }
    } else {
      transientState.kickTransient = Math.max(0, transientState.kickTransient - dt / 0.38);
    }

    const highMidEnergy = rawBands.upperMid * 0.5 + rawBands.presence * 0.5;
    this.snareHistory.push(highMidEnergy);
    if (this.snareHistory.length > 45) this.snareHistory.shift();
    const avgSnare = this.snareHistory.reduce((a, b) => a + b, 0) / this.snareHistory.length;

    if (highMidEnergy > avgSnare * 1.38 && highMidEnergy > 0.18 && nowMs - this.lastSnareTime > 220) {
      this.lastSnareTime = nowMs;
      transientState.snareTransient = 1.0;
      if (store.snareKaleidoJumpEnabled) {
        transientState.mirrorPhase = (transientState.mirrorPhase + 1) % 4;
      }
    } else {
      transientState.snareTransient = Math.max(0, transientState.snareTransient - dt / 0.3);
    }

    transientState.manualBeatFlash = Math.max(0, transientState.manualBeatFlash - dt / 0.4);

    const spikeEnv = computeAudioSpikeEnvelope(
      this.smoothedBands,
      transientState.kickTransient,
      transientState.snareTransient,
      store.spikeSensitivity
    );

    transientState.audioIntensity = adaptiveHalfLifeSmooth(
      transientState.audioIntensity,
      spikeEnv.audioIntensity,
      dt,
      0.006,
      0.14
    );
    transientState.fractalSpike = adaptiveHalfLifeSmooth(
      transientState.fractalSpike,
      spikeEnv.fractalSpike,
      dt,
      0.004,
      0.16
    );

    // Guarantee smooth continuous preview animation even during quiet track intros or when paused
    const minBaselineRate = 0.55 * Math.max(0.35, store.cameraSpeed);
    transientState.dynamicTime += dt * Math.max(minBaselineRate, spikeEnv.timeRateMultiplier);

    if (transientState.audioIntensity > 0.02) {
      transientState.bassCumulative +=
        (this.smoothedBands.bass * 1.85 + this.smoothedBands.subBass * 1.45) * dt;
      transientState.midCumulative += this.smoothedBands.mid * 1.35 * dt;
    }

    const rawBounce = computeJuiceBounce(this.smoothedBands.bass, this.smoothedBands.mid) * store.bounceIntensity;
    transientState.juiceBounce =
      transientState.audioIntensity > 0.03 ? Math.max(0.95, rawBounce) : 1.0;

    transientState.rmsEnergy =
      (this.smoothedBands.subBass +
        this.smoothedBands.bass * 1.4 +
        this.smoothedBands.mid +
        this.smoothedBands.presence +
        this.smoothedBands.brilliance) /
      5.4;

    if (store.pitchSynesthesiaEnabled) {
      const pitchInfo = frequencyToPitchHue(dominantFreqHz);
      transientState.dominantFreqHz = dominantFreqHz;
      transientState.dominantNote = pitchInfo.noteName;
      transientState.pitchHue = adaptiveHalfLifeSmooth(
        transientState.pitchHue,
        pitchInfo.pitchHue,
        dt,
        0.04,
        0.18
      );
    } else {
      transientState.pitchHue = 0;
    }

    if (transientState.modeMorphProgress < 1.0) {
      const morphDur = Math.max(0.5, store.transitionMorphSeconds || 2.0);
      transientState.modeMorphProgress = Math.min(
        1.0,
        transientState.modeMorphProgress + Math.max(dt, 0.016) / morphDur
      );
    }
  }
}

export const audioEngine = new AudioAnalyzerEngine();
