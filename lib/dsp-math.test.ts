import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dbToLinear,
  applyPeakExaggeration,
  computeBpmSawtoothPhase,
  computeFrequencyBands,
  adaptiveHalfLifeSmooth,
  computeJuiceBounce,
  computeAudioSpikeEnvelope,
  frequencyToPitchHue,
  evaluateCosinePalette,
  getActiveChoreographyKeyframe,
  getExportResolutionDimensions,
  getPreviewResolutionDimensions,
  getVideoFormatSpecification,
  computeDynamicRenderScale,
  formatTimestamp,
  precomputeOfflineAudioTimeline,
  computeZoomDirectionMultiplier,
  computeRgbaDepthMapInPlace,
} from './dsp-math';
import {
  BUILTIN_CHOREOGRAPHIES,
  COSINE_PALETTE_PRESETS,
  FACTORY_STUDIO_PRESETS,
  FRACTAL_MODE_INFO,
  SETTING_TOOLTIPS,
  WORLD_BIOME_PRESETS,
} from './presets';
import {
  buildFractalFragmentShader,
  buildFractalVertexShader,
  buildStandaloneWebGl2FragmentShader,
} from './fractal-shaders';

test('dbToLinear converts decibels to bounded [0, 1] linear magnitude', () => {
  assert.equal(dbToLinear(-100), 0);
  assert.equal(dbToLinear(-95), 0);
  assert.equal(dbToLinear(-5), 1);
  const midVal = dbToLinear(-40);
  assert.ok(midVal > 0.1 && midVal < 0.9, `Expected midVal in (0.1, 0.9), got ${midVal}`);
});

test('applyPeakExaggeration and computeBpmSawtoothPhase compute deterministic values', () => {
  assert.equal(applyPeakExaggeration(0, 1.5, 1.5), 0);
  const boosted = applyPeakExaggeration(0.8, 1.5, 1.5);
  assert.ok(boosted > 1.0, `Expected boosted peak > 1.0, got ${boosted}`);

  // At 120 BPM (2 beats per second), t = 0.25s is 0.5 phase, t = 0.5s wraps to 0 phase
  assert.ok(Math.abs(computeBpmSawtoothPhase(0.25, 120) - 0.5) < 1e-6);
  assert.ok(Math.abs(computeBpmSawtoothPhase(0.5, 120) - 0.0) < 1e-6);
});

test('computeFrequencyBands separates low-end and high-end FFT energy accurately', () => {
  const fft = new Float32Array(1024);
  fft[3] = 0.9;
  fft[4] = 0.95;
  fft[5] = 0.85;
  const bands = computeFrequencyBands(fft, 48000, 2048);
  assert.ok(bands.bass > 0.35, `Expected strong bass energy, got ${bands.bass}`);
  assert.equal(bands.brilliance, 0);
});

test('adaptiveHalfLifeSmooth reacts rapidly on attack and decays smoothly', () => {
  const attacked = adaptiveHalfLifeSmooth(0, 1, 0.016, 0.008, 0.14);
  assert.ok(attacked > 0.85, `Expected fast attack > 0.85, got ${attacked}`);

  const decayed = adaptiveHalfLifeSmooth(1, 0, 0.016, 0.016, 0.14);
  assert.ok(decayed > 0.88 && decayed < 0.98, `Expected smooth decay in (0.88, 0.98), got ${decayed}`);
});

test('computeJuiceBounce implements mechanical bounce formula pow(bass + bass/max(mids,0.001), 0.15)', () => {
  assert.equal(computeJuiceBounce(0, 0.5), 0);
  const punch = computeJuiceBounce(0.8, 0.2);
  assert.ok(Math.abs(punch - Math.pow(4.8, 0.15)) < 1e-4);
});

test('computeAudioSpikeEnvelope keeps silent sections still and generates fractal spikes on intense drops', () => {
  const silentBands = {
    subBass: 0.01,
    bass: 0.01,
    lowMid: 0.01,
    mid: 0.01,
    upperMid: 0.01,
    presence: 0.01,
    brilliance: 0.01,
  };
  const silentEnv = computeAudioSpikeEnvelope(silentBands, 0, 0, 1.35);
  assert.equal(silentEnv.fractalSpike, 0);
  assert.ok(silentEnv.timeRateMultiplier <= 0.03, `Expected near-frozen timeRate in silence, got ${silentEnv.timeRateMultiplier}`);

  const intenseBands = {
    subBass: 0.88,
    bass: 0.92,
    lowMid: 0.65,
    mid: 0.72,
    upperMid: 0.68,
    presence: 0.75,
    brilliance: 0.6,
  };
  const dropEnv = computeAudioSpikeEnvelope(intenseBands, 0.95, 0.6, 1.35);
  assert.ok(dropEnv.fractalSpike > 1.8, `Expected strong fractalSpike > 1.8 on intense drop, got ${dropEnv.fractalSpike}`);
  assert.ok(dropEnv.timeRateMultiplier > 1.5, `Expected accelerated timeRate > 1.5 on drop, got ${dropEnv.timeRateMultiplier}`);
});

test('frequencyToPitchHue maps 12-tone semitones to 30-degree steps around chromatic wheel', () => {
  const c4 = frequencyToPitchHue(261.625565);
  assert.equal(c4.noteName, 'C');
  assert.ok(c4.degrees < 1 || c4.degrees > 359);

  const e4 = frequencyToPitchHue(329.627557);
  assert.equal(e4.noteName, 'E');
  assert.ok(Math.abs(e4.degrees - 120) < 1.5);

  const gs4 = frequencyToPitchHue(415.304698);
  assert.equal(gs4.noteName, 'G#');
  assert.ok(Math.abs(gs4.degrees - 240) < 1.5);
});

test('evaluateCosinePalette computes Inigo Quilez cosine color vector', () => {
  const pal = BUILTIN_CHOREOGRAPHIES[0].palette;
  const rgb = evaluateCosinePalette(0.25, pal);
  assert.equal(rgb.length, 3);
  for (const ch of rgb) {
    assert.ok(ch >= 0 && ch <= 1);
  }
});

test('getActiveChoreographyKeyframe selects matching song section', () => {
  const kfs = BUILTIN_CHOREOGRAPHIES[0].timelineKeyframes;
  const intro = getActiveChoreographyKeyframe(kfs, 0.05);
  assert.equal(intro?.section, 'Intro');
  const drop = getActiveChoreographyKeyframe(kfs, 0.5);
  assert.equal(drop?.section, 'Drop');
  const outro = getActiveChoreographyKeyframe(kfs, 0.95);
  assert.equal(outro?.section, 'Outro');
});

test('getExportResolutionDimensions and getPreviewResolutionDimensions return even integer dimensions for 16:9, 9:16, and 1:1', () => {
  const uhd16x9 = getExportResolutionDimensions('16:9', '4k');
  assert.equal(uhd16x9.width, 3840);
  assert.equal(uhd16x9.height, 2160);
  assert.equal(uhd16x9.bitrate, 50_000_000);

  const sq1080 = getExportResolutionDimensions('1:1', '1080p');
  assert.equal(sq1080.width, 1080);
  assert.equal(sq1080.height, 1080);
  assert.equal(sq1080.width % 2, 0);

  const fhd9x16 = getExportResolutionDimensions('9:16', '1080p');
  assert.equal(fhd9x16.width, 1080);
  assert.equal(fhd9x16.height, 1920);

  const prevSq = getPreviewResolutionDimensions('1:1', '720p');
  assert.equal(prevSq.width, 720);
  assert.equal(prevSq.height, 720);
});

test('getVideoFormatSpecification returns MP4, WebM VP9, WebM VP8, and MOV format specs', () => {
  const mp4 = getVideoFormatSpecification('mp4-h264');
  assert.equal(mp4.ext, 'mp4');
  assert.equal(mp4.blobType, 'video/mp4');
  assert.ok(mp4.mimeCandidates.some((m) => m.startsWith('video/mp4')));

  const vp9 = getVideoFormatSpecification('webm-vp9');
  assert.equal(vp9.ext, 'webm');
  assert.equal(vp9.blobType, 'video/webm');

  const vp8 = getVideoFormatSpecification('webm-vp8');
  assert.equal(vp8.ext, 'webm');
  assert.ok(vp8.mimeCandidates.some((m) => m.includes('vp8')));

  const mov = getVideoFormatSpecification('mov-h264');
  assert.equal(mov.ext, 'mov');
  assert.equal(mov.blobType, 'video/quicktime');
});

test('computeDynamicRenderScale steps down when frame time exceeds 60FPS budget and steps up when fast', () => {
  const steppedDown = computeDynamicRenderScale(0.75, 24.0, 0.35, 1.0);
  assert.ok(steppedDown < 0.75, `Expected scale to decrease on 24ms frame, got ${steppedDown}`);

  const steppedUp = computeDynamicRenderScale(0.6, 8.5, 0.35, 1.0);
  assert.ok(steppedUp > 0.6, `Expected scale to increase on 8.5ms frame, got ${steppedUp}`);
});

test('precomputeOfflineAudioTimeline deterministically computes frame-accurate audio uniforms', () => {
  const sampleRate = 48000;
  const durationSec = 0.5;
  const samples = new Float32Array(sampleRate * durationSec);
  // Inject a 90Hz bass sine wave in the second half
  for (let i = Math.floor(samples.length / 2); i < samples.length; i++) {
    samples[i] = Math.sin((2 * Math.PI * 90 * i) / sampleRate) * 0.85;
  }

  const timeline = precomputeOfflineAudioTimeline(samples, sampleRate, 30, 60, {
    reactivityGain: 1.5,
    peakExponent: 1.4,
    estimatedBpm: 120,
  });

  assert.equal(timeline.length, 30);
  assert.equal(timeline[0].frameIndex, 0);
  assert.ok(timeline[0].rmsEnergy < 0.01, 'First frame in silent half should have near-zero RMS');
  assert.ok(timeline[25].rmsEnergy > 0.4, 'Frame in active bass half should have strong RMS');
  assert.ok(timeline[25].bands.bass > timeline[0].bands.bass, 'Bass band should rise during 90Hz tone');
});

test('formatTimestamp formats seconds as MM:SS', () => {
  assert.equal(formatTimestamp(0), '00:00');
  assert.equal(formatTimestamp(65), '01:05');
  assert.equal(formatTimestamp(180), '03:00');
});

test('buildFractalFragmentShader and buildFractalVertexShader enforce highp, include all 26 visualizer modes (with Mode 25 Divine Creation and no Infinite Mode), and avoid duplicate GLSL functions', () => {
  assert.equal(FRACTAL_MODE_INFO.length, 26);
  assert.equal(FRACTAL_MODE_INFO[25].id, 25);
  assert.equal(FRACTAL_MODE_INFO[25].badge, 'DIVINE CREATION');
  assert.equal(FRACTAL_MODE_INFO[25].isFeaturedTop, true);
  assert.equal(FRACTAL_MODE_INFO[25].category, 'Surreal & Visionary');
  assert.equal(FRACTAL_MODE_INFO[25].secondaryCategory, 'Fractals & 4D');
  assert.equal(COSINE_PALETTE_PRESETS.length, 28);
  assert.equal(WORLD_BIOME_PRESETS.length, 5);
  assert.equal(FACTORY_STUDIO_PRESETS.length, 39);
  assert.ok(Object.keys(SETTING_TOOLTIPS).length >= 22);

  const validCategories = new Set([
    'Fractals & 4D',
    'Surreal & Visionary',
    'Cosmic & Physics',
    'Organic & Liquid',
    'Audio & Optical',
  ]);
  for (let i = 0; i < 26; i++) {
    assert.equal(FRACTAL_MODE_INFO[i].id, i);
    assert.ok(
      validCategories.has(FRACTAL_MODE_INFO[i].category),
      `Mode ${i} should have a valid category, got ${FRACTAL_MODE_INFO[i].category}`
    );
  }

  for (const presetPal of COSINE_PALETTE_PRESETS) {
    const rgb = evaluateCosinePalette(0.45, presetPal.palette);
    assert.equal(rgb.length, 3);
    assert.ok(rgb[0] >= 0 && rgb[0] <= 1);
  }

  for (const fp of FACTORY_STUDIO_PRESETS) {
    assert.ok(fp.snapshot, `Factory preset ${fp.id} should have snapshot`);
    assert.ok(
      typeof fp.snapshot.clarity === 'number' && fp.snapshot.clarity > 0,
      `Factory preset ${fp.id} should define clarity`
    );
    assert.ok(
      fp.snapshot.fractalMode >= 0 && fp.snapshot.fractalMode <= 25,
      `Factory preset ${fp.id} has out-of-range fractalMode ${fp.snapshot.fractalMode}`
    );
  }

  const heavyFrag = buildFractalFragmentShader(true);
  const heavyVert = buildFractalVertexShader(true);
  assert.ok(heavyFrag.includes('precision highp float;'));
  assert.ok(heavyFrag.includes('precision highp int;'));
  assert.ok(heavyFrag.includes('#define GPU_HEAVY_PRECISION 1'));
  assert.ok(heavyFrag.includes('uniform float u_clarity;'));
  assert.ok(heavyFrag.includes('uniform int u_divineStage;'));
  assert.ok(heavyFrag.includes('uniform bool u_divineGodRays;'));
  assert.ok(heavyFrag.includes('renderMode24_OpArtPleochroicOscilloscope'));
  assert.ok(heavyFrag.includes('renderMode26_DivineCreation'));
  assert.ok(!heavyFrag.includes('renderMode25_AiInfiniteOverdrive'));
  assert.ok(!heavyFrag.includes('u_chimeraOps'));
  assert.equal(
    (heavyFrag.match(/float phaseHG\(/g) || []).length,
    1,
    'phaseHG must be defined exactly once to prevent WebGL2 GLSL compile failure'
  );
  assert.ok(heavyVert.includes('precision highp float;'));

  const standaloneWebGl2 = buildStandaloneWebGl2FragmentShader(true);
  assert.ok(standaloneWebGl2.includes('#version 300 es'));
  assert.ok(standaloneWebGl2.includes('renderMode26_DivineCreation'));
  assert.ok(!standaloneWebGl2.includes('renderMode25_AiInfiniteOverdrive'));

  const lightFrag = buildFractalFragmentShader(false);
  assert.ok(lightFrag.includes('precision mediump float;'));
  assert.ok(!lightFrag.includes('#define GPU_HEAVY_PRECISION 1'));

  for (let m = 0; m < 26; m++) {
    const lockedFrag = buildFractalFragmentShader(true, m);
    assert.ok(
      lockedFrag.includes(`#define LOCKED_FRACTAL_MODE ${m}`),
      `Expected LOCKED_FRACTAL_MODE ${m} define in locked shader`
    );
    const lockedWebGl2 = buildStandaloneWebGl2FragmentShader(true, m);
    assert.ok(lockedWebGl2.includes('#version 300 es'));
    assert.ok(lockedWebGl2.includes(`#define LOCKED_FRACTAL_MODE ${m}`));
  }
});

test('computeZoomDirectionMultiplier and computeRgbaDepthMapInPlace compute accurate 3D depth and zoom signs', () => {
  assert.equal(computeZoomDirectionMultiplier('inward', 1.0), 1.0);
  assert.equal(computeZoomDirectionMultiplier('outward', 1.0), -1.0);
  const pendulumVal = computeZoomDirectionMultiplier('pendulum', 0.25);
  assert.ok(pendulumVal >= -1.0 && pendulumVal <= 1.0);

  // 4x4 RGBA buffer with bright center pixel
  const rgba = new Uint8ClampedArray(4 * 4 * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = 20;
    rgba[i + 1] = 20;
    rgba[i + 2] = 20;
    rgba[i + 3] = 255;
  }
  // Make pixel (1,1) bright white
  const centerIdx = (1 * 4 + 1) * 4;
  rgba[centerIdx] = 255;
  rgba[centerIdx + 1] = 255;
  rgba[centerIdx + 2] = 255;

  computeRgbaDepthMapInPlace(rgba, 4, 4);
  assert.ok(
    rgba[centerIdx + 3] > rgba[3],
    `Expected bright center pixel depth (${rgba[centerIdx + 3]}) > dark corner depth (${rgba[3]})`
  );
});

test('getSongSectionsWithTimeRanges and resolveExportSegmentRange slice individual song sections accurately', async () => {
  const { getSongSectionsWithTimeRanges, resolveExportSegmentRange } = await import('./dsp-math');
  const kfs = BUILTIN_CHOREOGRAPHIES[0].timelineKeyframes;
  const sections = getSongSectionsWithTimeRanges(kfs, 180);

  assert.equal(sections.length, 5);
  assert.equal(sections[0].section, 'Intro');
  assert.equal(sections[0].modeId, 'section-intro');
  assert.equal(sections[0].startSec, 0);
  assert.equal(sections[0].endSec, 36);
  assert.equal(sections[0].durationSec, 36);

  assert.equal(sections[1].section, 'Buildup');
  assert.equal(sections[1].modeId, 'section-buildup');
  assert.equal(sections[1].startSec, 36);
  assert.equal(sections[1].endSec, 75.6);

  assert.equal(sections[2].section, 'Drop');
  assert.equal(sections[2].modeId, 'section-drop');
  assert.equal(sections[2].startSec, 75.6);
  assert.equal(sections[2].endSec, 122.4);

  assert.equal(sections[3].section, 'Breakdown');
  assert.equal(sections[3].modeId, 'section-breakdown');
  assert.equal(sections[3].startSec, 122.4);
  assert.equal(sections[3].endSec, 154.8);

  assert.equal(sections[4].section, 'Outro');
  assert.equal(sections[4].modeId, 'section-outro');
  assert.equal(sections[4].startSec, 154.8);
  assert.equal(sections[4].endSec, 180);

  const dropSeg = resolveExportSegmentRange({
    mode: 'section-drop',
    trackDuration: 180,
    keyframes: kfs,
  });
  assert.equal(dropSeg.sectionName, 'Drop');
  assert.equal(dropSeg.startSec, 75.6);
  assert.equal(dropSeg.endSec, 122.4);
  assert.equal(dropSeg.durationSec, 46.8);
  assert.equal(dropSeg.shortTag, 'Part3-Drop');

  const customSeg = resolveExportSegmentRange({
    mode: 'custom-range',
    trackDuration: 180,
    keyframes: kfs,
    customStartSec: 45,
    customEndSec: 90,
  });
  assert.equal(customSeg.startSec, 45);
  assert.equal(customSeg.endSec, 90);
  assert.equal(customSeg.durationSec, 45);

  const loopSeg = resolveExportSegmentRange({
    mode: 'ab-loop',
    trackDuration: 180,
    keyframes: kfs,
    loopA: 60,
    loopB: 105,
  });
  assert.equal(loopSeg.startSec, 60);
  assert.equal(loopSeg.endSec, 105);
  assert.equal(loopSeg.durationSec, 45);
});



