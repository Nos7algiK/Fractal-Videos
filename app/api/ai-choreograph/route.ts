import { GoogleGenAI, Type } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import {
  AcousticSummary,
  FractalMode,
  VisualChoreography,
  WorldBiomeMode,
} from '@/lib/types';

function buildDeterministicChoreography(
  prompt: string,
  acoustic: AcousticSummary,
  manifestCreationArc = false
): VisualChoreography {
  const lower = prompt.toLowerCase();
  const isDivineCreation =
    manifestCreationArc ||
    lower.includes('divine') ||
    lower.includes('fiat lux') ||
    lower.includes('sacred') ||
    lower.includes('metatron') ||
    lower.includes('merkaba') ||
    lower.includes('flower of life') ||
    lower.includes('god ray') ||
    lower.includes('creation');

  let mode: FractalMode = isDivineCreation ? 25 : 0;
  let worldBiome: WorldBiomeMode = 'auto';

  if (isDivineCreation) {
    mode = 25;
  } else if (lower.includes('4d') || lower.includes('tesseract') || lower.includes('hypercube') || lower.includes('polychora')) {
    mode = 0;
  } else if (lower.includes('dmt') || lower.includes('kaleidoscope') || lower.includes('psychedelic') || lower.includes('visionary')) {
    mode = 1;
  } else if (lower.includes('bass nation') || lower.includes('trap') || lower.includes('emblem') || lower.includes('medallion')) {
    mode = 2;
  } else if (
    lower.includes('world') ||
    lower.includes('genesis') ||
    lower.includes('mountain') ||
    lower.includes('ocean') ||
    lower.includes('nature') ||
    lower.includes('forest') ||
    lower.includes('flora') ||
    lower.includes('city') ||
    lower.includes('animal') ||
    lower.includes('phoenix') ||
    lower.includes('bird') ||
    lower.includes('jellyfish')
  ) {
    mode = 3;
    if (lower.includes('mountain') || lower.includes('ocean') || lower.includes('sea')) {
      worldBiome = 'mountains';
    } else if (lower.includes('flora') || lower.includes('nature') || lower.includes('forest') || lower.includes('tree')) {
      worldBiome = 'nature';
    } else if (lower.includes('city') || lower.includes('cyber') || lower.includes('skyscraper')) {
      worldBiome = 'cyber-city';
    } else if (lower.includes('animal') || lower.includes('phoenix') || lower.includes('bird') || lower.includes('jellyfish')) {
      worldBiome = 'animals';
    } else {
      worldBiome = 'auto';
    }
  } else if (lower.includes('wormhole') || lower.includes('tunnel') || lower.includes('kifs')) {
    mode = 4;
  } else if (lower.includes('mandelbulb') || lower.includes('quaternion')) {
    mode = 5;
  } else if (lower.includes('cathedral') || lower.includes('kleinian') || lower.includes('apollonian')) {
    mode = 6;
  } else if (lower.includes('julia') || lower.includes('ship') || lower.includes('2d')) {
    mode = 7;
  } else if (
    lower.includes('zeno') ||
    lower.includes('paradox') ||
    lower.includes('droste') ||
    lower.includes('escher') ||
    lower.includes('infinite zoom') ||
    lower.includes('dichotomy') ||
    lower.includes('arrow')
  ) {
    mode = 9;
  } else if (lower.includes('cymatic') || lower.includes('chladni') || lower.includes('feedback') || lower.includes('liquid')) {
    mode = 8;
  }

  const isGold = isDivineCreation || lower.includes('gold') || lower.includes('solar') || lower.includes('amber');
  const isCyber = lower.includes('cyber') || lower.includes('neon') || lower.includes('bass');
  const isBio = lower.includes('bio') || lower.includes('forest') || lower.includes('flora') || lower.includes('ocean');

  const palette = isDivineCreation
    ? {
        a: [0.68, 0.58, 0.44] as [number, number, number],
        b: [0.42, 0.38, 0.3] as [number, number, number],
        c: [1.0, 1.0, 0.85] as [number, number, number],
        d: [0.02, 0.1, 0.24] as [number, number, number],
      }
    : isGold
    ? {
        a: [0.55, 0.48, 0.35] as [number, number, number],
        b: [0.48, 0.45, 0.38] as [number, number, number],
        c: [1.0, 0.9, 0.5] as [number, number, number],
        d: [0.8, 0.9, 0.3] as [number, number, number],
      }
    : isBio
    ? {
        a: [0.35, 0.58, 0.52] as [number, number, number],
        b: [0.42, 0.48, 0.45] as [number, number, number],
        c: [0.85, 1.0, 0.9] as [number, number, number],
        d: [0.18, 0.58, 0.42] as [number, number, number],
      }
    : isCyber
    ? {
        a: [0.45, 0.52, 0.62] as [number, number, number],
        b: [0.48, 0.45, 0.5] as [number, number, number],
        c: [1.0, 1.0, 0.85] as [number, number, number],
        d: [0.05, 0.38, 0.72] as [number, number, number],
      }
    : {
        a: [0.55, 0.45, 0.58] as [number, number, number],
        b: [0.48, 0.48, 0.5] as [number, number, number],
        c: [1.0, 0.95, 1.0] as [number, number, number],
        d: [
          acoustic.dominantPitchHue,
          (acoustic.dominantPitchHue + 0.33) % 1,
          (acoustic.dominantPitchHue + 0.67) % 1,
        ] as [number, number, number],
      };

  const bpmFactor = Math.max(0.75, Math.min(1.6, (acoustic.estimatedBpm || 124) / 120));

  if (isDivineCreation) {
    return {
      name: 'Divine Creation: Fiat Lux Genesis Arc',
      vibeDescription: `Sacred Genesis Arc choreographed for ${acoustic.trackName} (${acoustic.estimatedBpm} BPM, ${acoustic.dominantKey}) — Primordial Fiat Lux Light -> Flower of Life & Metatron's 78 Filaments -> 5 Platonic IFS & Counter-Rotating Merkaba -> Living Planetary World -> Golden-Angle Phyllotaxis Cosmos.`,
      palette,
      fractalMode: 25,
      worldBiome: 'auto',
      bulbPower: 9.0,
      kleinianScale: 1.5,
      foldLimit: 1.05,
      bloomIntensity: 1.65,
      chromaticAberration: 0.0022,
      cameraSpeed: Number((1.18 * bpmFactor).toFixed(2)),
      chaosMode: false,
      timelineKeyframes: [
        {
          section: 'Intro',
          startTimeRatio: 0.0,
          fractalMode: 25,
          speedMultiplier: Number((0.8 * bpmFactor).toFixed(2)),
          bloomIntensity: 1.55,
          bulbPower: 8.0,
          kleinianScale: 1.46,
          foldLimit: 1.02,
          chaosMode: false,
          description: 'Stage 1-2: Fiat Lux core splitting into Vesica Piscis & 3D Seed/Flower of Life with Crepuscular God Rays',
        },
        {
          section: 'Buildup',
          startTimeRatio: 0.2,
          fractalMode: 25,
          speedMultiplier: Number((1.25 * bpmFactor).toFixed(2)),
          bloomIntensity: 1.68,
          bulbPower: 9.2,
          kleinianScale: 1.52,
          foldLimit: 1.08,
          chaosMode: false,
          description: "Stage 3-4: 13-Circle Fruit of Life, 78-line Metatron's Cube & 5 Platonic-Solid IFS Cathedrals",
        },
        {
          section: 'Drop',
          startTimeRatio: 0.42,
          fractalMode: 6,
          speedMultiplier: Number((1.85 * bpmFactor).toFixed(2)),
          bloomIntensity: 1.88,
          bulbPower: 10.5,
          kleinianScale: 1.56,
          foldLimit: 1.15,
          chaosMode: false,
          description: 'Climax Manifestation: Apollonian Stained-Glass Cathedral illuminated by Volumetric God Rays & Sacred Filigree Halo',
        },
        {
          section: 'Breakdown',
          startTimeRatio: 0.68,
          fractalMode: 3,
          speedMultiplier: Number((0.92 * bpmFactor).toFixed(2)),
          bloomIntensity: 1.45,
          bulbPower: 8.4,
          kleinianScale: 1.44,
          foldLimit: 1.0,
          chaosMode: false,
          description: 'Living Planetary Ecosystem: Procedural mountains, bioluminescent flora & soaring creatures under golden sunbeams',
        },
        {
          section: 'Outro',
          startTimeRatio: 0.86,
          fractalMode: 25,
          speedMultiplier: Number((0.75 * bpmFactor).toFixed(2)),
          bloomIntensity: 1.6,
          bulbPower: 8.8,
          kleinianScale: 1.48,
          foldLimit: 1.04,
          chaosMode: false,
          description: 'Stage 5-6: Counter-Rotating 3D Merkaba & 137.5° Golden-Angle Sunflower Phyllotaxis Ascension',
        },
      ],
    };
  }

  return {
    name: prompt.slice(0, 42) || 'AI Synesthetic Choreography',
    vibeDescription: `AI-directed visual choreography tuned to ${acoustic.trackName} (${acoustic.estimatedBpm} BPM, ${acoustic.dominantKey}) — "${prompt}"`,
    palette,
    fractalMode: mode,
    worldBiome,
    bulbPower: Number((7.5 + acoustic.bassToMidRatio * 1.4).toFixed(2)),
    kleinianScale: Number((1.38 + acoustic.meanRms * 0.22).toFixed(2)),
    foldLimit: Number((0.98 + acoustic.subBassEnergy * 0.25).toFixed(2)),
    bloomIntensity: Number((1.25 + acoustic.highFreqBrilliance * 0.65).toFixed(2)),
    chromaticAberration: 0.0028,
    cameraSpeed: Number((1.15 * bpmFactor).toFixed(2)),
    chaosMode: isCyber || acoustic.bassToMidRatio > 1.5,
    timelineKeyframes: [
      {
        section: 'Intro',
        startTimeRatio: 0.0,
        fractalMode: mode,
        speedMultiplier: Number((0.75 * bpmFactor).toFixed(2)),
        bloomIntensity: 1.1,
        bulbPower: 7.8,
        kleinianScale: 1.4,
        foldLimit: 1.0,
        chaosMode: false,
        description: `Atmospheric entry calibrated to ${acoustic.dominantKey} harmonic fundamental`,
      },
      {
        section: 'Buildup',
        startTimeRatio: 0.2,
        fractalMode: ((mode + 1) % 26) as FractalMode,
        speedMultiplier: Number((1.3 * bpmFactor).toFixed(2)),
        bloomIntensity: 1.45,
        bulbPower: 9.0,
        kleinianScale: 1.47,
        foldLimit: 1.12,
        chaosMode: false,
        description: 'Rising 4D rotational tension and spectral density',
      },
      {
        section: 'Drop',
        startTimeRatio: 0.42,
        fractalMode: mode,
        speedMultiplier: Number((2.05 * bpmFactor).toFixed(2)),
        bloomIntensity: 1.95,
        bulbPower: 10.8,
        kleinianScale: 1.54,
        foldLimit: 1.24,
        chaosMode: true,
        description: 'Peak sub-bass kinetic overdrive with Lyapunov chaos filaments',
      },
      {
        section: 'Breakdown',
        startTimeRatio: 0.68,
        fractalMode: 3,
        speedMultiplier: Number((0.85 * bpmFactor).toFixed(2)),
        bloomIntensity: 1.25,
        bulbPower: 7.6,
        kleinianScale: 1.41,
        foldLimit: 0.96,
        chaosMode: false,
        description: 'Procedural Genesis world horizon with deep ambient occlusion',
      },
      {
        section: 'Outro',
        startTimeRatio: 0.86,
        fractalMode: 25,
        speedMultiplier: Number((0.65 * bpmFactor).toFixed(2)),
        bloomIntensity: 1.4,
        bulbPower: 8.0,
        kleinianScale: 1.38,
        foldLimit: 1.0,
        chaosMode: false,
        description: 'Divine Creation golden-ratio phyllotaxis & volumetric light decay',
      },
    ],
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const manifestCreationArc = Boolean(body.manifestCreationArc);
    const prompt: string =
      body.prompt ||
      (manifestCreationArc
        ? 'Divine Creation Genesis Arc: Fiat Lux primordial light splitting into Vesica Piscis, Flower of Life, Metatron 78-line Cube, 5 Platonic IFS, Living Planetary World, and Golden-Angle Phyllotaxis Cosmos'
        : '4D Tesseract Hyperspace morphing into Bioluminescent Fractal World');
    const acoustic: AcousticSummary = body.acousticSummary || {
      trackName: 'Synesthetic Track',
      durationSeconds: 180,
      meanRms: 0.42,
      peakRms: 0.94,
      spectralCentroidHz: 1450,
      bassToMidRatio: 1.55,
      subBassEnergy: 0.7,
      highFreqBrilliance: 0.5,
      dynamicRangeDb: 13.5,
      estimatedBpm: 124,
      dominantKey: 'C Minor',
      dominantPitchHue: 0.0,
      transientDensity: 4.1,
      featureVector28D: new Array(28).fill(0.5),
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return NextResponse.json({
        choreography: buildDeterministicChoreography(prompt, acoustic, manifestCreationArc),
        source: 'deterministic-acoustic-engine',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const systemInstruction = `You are a Principal WebGL2/GLSL Synesthetic 4D Fractal, Sacred Geometry & Procedural World Art Director.
Given a user's creative visual prompt and a 28-dimensional acoustic track summary (BPM, key, spectral centroid, bass-to-mid ratio, RMS), design a cohesive VisualChoreography JSON preset across all 26 Visualizer Modes (0..25):
0 = 4D Tesseract & Polychora Hyperspace
1 = 4D Visionary DMT Kaleidoscope
2 = Bass Nation Emblem Reactor
3 = Fractal Genesis v2 (5-Layer AI Procedural World: Mountains, Flora, Cyber-City, Fractal Phoenix/Jellyfish)
4 = 3D KIFS / Mandelbox Wormhole
5 = 3D Mandelbulb & 4D Quaternion Morph
6 = 3D Apollonian Cathedral & Kleinian Sponge
7 = 2D Hyper-Julia / Burning Ship Filigree
8 = Liquid Optical Feedback & Cymatic Chladni
9 = Zeno's Paradox (Dichotomy Zoom, Escher-Droste & Arrow Time-Slicer)
10 = AI Image-to-3D-Fractal Converter
11..24 = Surreal, Cosmic, Physics & Organic Modes (Klüver V1, Non-Euclidean H3, Indra's Pearls, 4D Hopf Fibration, Relativistic Black Hole, Kali Star Nest, Gyroid Labyrinth, Tokamak Quantum Orbitals, Ferrofluid, Physarum Neural Net, Strange Attractors, Penrose Quasicrystal, Newton-Nova, Op-Art Oscilloscope)
25 = Divine Creation — Fiat Lux, Sacred Geometry (Vesica Piscis, Flower of Life, Metatron's 78-line Cube, 5 Platonic Solids IFS, Counter-Rotating 3D Merkaba, 137.5° Golden Phyllotaxis) & Volumetric God Rays
${
  manifestCreationArc
    ? 'IMPORTANT: Choreograph this song as a Divine Creation Genesis Arc starting at Mode 25 (Fiat Lux & Sacred Geometry), evolving through living planetary worlds (Mode 3) and sacred golden fractals (Mode 6 and Mode 25), with a Celestial Gold & Pure Light cosine palette.'
    : ''
}
Ensure Cosine Palette vectors (a, b, c, d) each have exactly 3 floats in [0.0, 1.0].
Provide exactly 5 timelineKeyframes for sections: Intro (0.0), Buildup (0.2), Drop (0.42), Breakdown (0.68), Outro (0.86).`;

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Creative Vibe Prompt: "${prompt}"
Manifest Creation Genesis Arc: ${manifestCreationArc}
Acoustic Summary (28D & Metadata):
${JSON.stringify(acoustic)}`,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            vibeDescription: { type: Type.STRING },
            palette: {
              type: Type.OBJECT,
              properties: {
                a: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                b: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                c: { type: Type.ARRAY, items: { type: Type.NUMBER } },
                d: { type: Type.ARRAY, items: { type: Type.NUMBER } },
              },
              required: ['a', 'b', 'c', 'd'],
            },
            fractalMode: { type: Type.INTEGER },
            worldBiome: { type: Type.STRING },
            bulbPower: { type: Type.NUMBER },
            kleinianScale: { type: Type.NUMBER },
            foldLimit: { type: Type.NUMBER },
            bloomIntensity: { type: Type.NUMBER },
            chromaticAberration: { type: Type.NUMBER },
            cameraSpeed: { type: Type.NUMBER },
            chaosMode: { type: Type.BOOLEAN },
            timelineKeyframes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  section: { type: Type.STRING },
                  startTimeRatio: { type: Type.NUMBER },
                  fractalMode: { type: Type.INTEGER },
                  speedMultiplier: { type: Type.NUMBER },
                  bloomIntensity: { type: Type.NUMBER },
                  bulbPower: { type: Type.NUMBER },
                  kleinianScale: { type: Type.NUMBER },
                  foldLimit: { type: Type.NUMBER },
                  chaosMode: { type: Type.BOOLEAN },
                  description: { type: Type.STRING },
                },
                required: [
                  'section',
                  'startTimeRatio',
                  'fractalMode',
                  'speedMultiplier',
                  'bloomIntensity',
                  'bulbPower',
                  'kleinianScale',
                  'foldLimit',
                  'chaosMode',
                  'description',
                ],
              },
            },
          },
          required: [
            'name',
            'vibeDescription',
            'palette',
            'fractalMode',
            'bulbPower',
            'kleinianScale',
            'foldLimit',
            'bloomIntensity',
            'chromaticAberration',
            'cameraSpeed',
            'chaosMode',
            'timelineKeyframes',
          ],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    const sanitizeVec3 = (
      arr: unknown,
      def: [number, number, number]
    ): [number, number, number] => {
      if (Array.isArray(arr) && arr.length >= 3) {
        return [
          Math.max(0, Math.min(1, Number(arr[0]) || def[0])),
          Math.max(0, Math.min(1, Number(arr[1]) || def[1])),
          Math.max(0, Math.min(1, Number(arr[2]) || def[2])),
        ];
      }
      return def;
    };

    const validBiomes: WorldBiomeMode[] = [
      'auto',
      'mountains',
      'nature',
      'cyber-city',
      'animals',
    ];
    const parsedBiome = validBiomes.includes(parsed.worldBiome as WorldBiomeMode)
      ? (parsed.worldBiome as WorldBiomeMode)
      : 'auto';

    const choreography: VisualChoreography = {
      name: parsed.name || prompt.slice(0, 36),
      vibeDescription: parsed.vibeDescription || prompt,
      palette: {
        a: sanitizeVec3(parsed.palette?.a, [0.68, 0.58, 0.44]),
        b: sanitizeVec3(parsed.palette?.b, [0.42, 0.38, 0.3]),
        c: sanitizeVec3(parsed.palette?.c, [1.0, 1.0, 0.85]),
        d: sanitizeVec3(parsed.palette?.d, [0.02, 0.1, 0.24]),
      },
      fractalMode: (manifestCreationArc
        ? 25
        : Math.max(0, Math.min(25, Number(parsed.fractalMode) || 0))) as FractalMode,
      worldBiome: parsedBiome,
      bulbPower: Math.max(4, Math.min(16, Number(parsed.bulbPower) || 8.5)),
      kleinianScale: Math.max(1.1, Math.min(1.85, Number(parsed.kleinianScale) || 1.48)),
      foldLimit: Math.max(0.5, Math.min(1.8, Number(parsed.foldLimit) || 1.05)),
      bloomIntensity: Math.max(0.2, Math.min(2.5, Number(parsed.bloomIntensity) || 1.55)),
      chromaticAberration: Math.max(
        0,
        Math.min(0.015, Number(parsed.chromaticAberration) || 0.0024)
      ),
      cameraSpeed: Math.max(0.2, Math.min(3.0, Number(parsed.cameraSpeed) || 1.2)),
      chaosMode: Boolean(parsed.chaosMode),
      timelineKeyframes:
        Array.isArray(parsed.timelineKeyframes) && parsed.timelineKeyframes.length > 0
          ? parsed.timelineKeyframes.map((kf: Record<string, unknown>) => ({
              section: (['Intro', 'Buildup', 'Drop', 'Breakdown', 'Outro'].includes(
                String(kf.section)
              )
                ? String(kf.section)
                : 'Drop') as 'Intro' | 'Buildup' | 'Drop' | 'Breakdown' | 'Outro',
              startTimeRatio: Math.max(0, Math.min(0.95, Number(kf.startTimeRatio) || 0)),
              fractalMode: Math.max(0, Math.min(25, Number(kf.fractalMode) || 0)) as FractalMode,
              speedMultiplier: Math.max(0.4, Math.min(3.0, Number(kf.speedMultiplier) || 1.0)),
              bloomIntensity: Math.max(0.4, Math.min(2.5, Number(kf.bloomIntensity) || 1.4)),
              bulbPower: Math.max(4, Math.min(16, Number(kf.bulbPower) || 8.5)),
              kleinianScale: Math.max(1.1, Math.min(1.8, Number(kf.kleinianScale) || 1.45)),
              foldLimit: Math.max(0.5, Math.min(1.8, Number(kf.foldLimit) || 1.05)),
              chaosMode: Boolean(kf.chaosMode),
              description: String(kf.description || 'Audio-reactive fractal section transition'),
            }))
          : buildDeterministicChoreography(prompt, acoustic, manifestCreationArc).timelineKeyframes,
    };

    return NextResponse.json({ choreography, source: 'gemini-ai' });
  } catch {
    const fallback = buildDeterministicChoreography(
      'Divine Creation Genesis Arc: Fiat Lux primordial light splitting into Vesica Piscis, Flower of Life, Metatron 78-line Cube, 5 Platonic IFS, Living Planetary World, and Golden-Angle Phyllotaxis Cosmos',
      {
        trackName: 'Synesthetic Track',
        durationSeconds: 180,
        meanRms: 0.42,
        peakRms: 0.94,
        spectralCentroidHz: 1450,
        bassToMidRatio: 1.55,
        subBassEnergy: 0.7,
        highFreqBrilliance: 0.5,
        dynamicRangeDb: 13.5,
        estimatedBpm: 124,
        dominantKey: 'C Minor',
        dominantPitchHue: 0.0,
        transientDensity: 4.1,
        featureVector28D: new Array(28).fill(0.5),
      },
      true
    );
    return NextResponse.json({ choreography: fallback, source: 'fallback' });
  }
}
