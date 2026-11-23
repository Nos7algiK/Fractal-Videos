import { GoogleGenAI, Type, Schema } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { COSINE_PALETTE_PRESETS } from '@/lib/presets';
import { Image3DConversionStyle, ImageFractalProfile, MultiImageBlendMethod } from '@/lib/types';

const profileResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: 'Concise artistic summary of how the uploaded images are converted into a 3D fractal.',
    },
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
    img3DStyle: {
      type: Type.INTEGER,
      description:
        '0 = 3D Raymarched Fractal Relief & KIFS Canyon, 1 = 3D Image-Mandelbulb & Quaternion Sculpture, 2 = 3D Infinite Image Wormhole & Kleinian Cathedral, 3 = 3D Volumetric Fractal Particle / Splat Nebula',
    },
    kifsFoldAngle: {
      type: Type.NUMBER,
      description: '3D KIFS mirror fold rotation angle in radians between 0.22 and 1.35',
    },
    bulbPower: {
      type: Type.NUMBER,
      description: '3D Mandelbulb spherical triplex power between 5.5 and 12.0',
    },
    imageDepth3D: {
      type: Type.NUMBER,
      description: '3D heightfield extrusion depth between 0.35 and 1.65',
    },
    imageFractalizeIterations: {
      type: Type.INTEGER,
      description: 'Recursive 3D KIFS/Droste folding iterations between 2 and 10',
    },
    imageMorphTurbulence: {
      type: Type.NUMBER,
      description: 'FBM domain-warp displacement turbulence between 0.15 and 1.15',
    },
    trapScale: {
      type: Type.NUMBER,
      description: 'UV orbit-trap tiling scale between 0.45 and 1.6',
    },
    imageBlendMethod: {
      type: Type.STRING,
      description: 'One of: liquid-fbm, crystal-shatter, droste-nest, kaleido-trap',
    },
  },
  required: [
    'summary',
    'palette',
    'img3DStyle',
    'kifsFoldAngle',
    'bulbPower',
    'imageDepth3D',
    'imageFractalizeIterations',
    'imageMorphTurbulence',
    'trapScale',
    'imageBlendMethod',
  ],
};

function sanitizeVec3(arr: unknown, fallback: [number, number, number]): [number, number, number] {
  if (!Array.isArray(arr) || arr.length < 3) return fallback;
  return [
    Math.max(0, Math.min(1, Number(arr[0]) || fallback[0])),
    Math.max(0, Math.min(1, Number(arr[1]) || fallback[1])),
    Math.max(0, Math.min(1, Number(arr[2]) || fallback[2])),
  ];
}

function sanitizeBlendMethod(raw: unknown): MultiImageBlendMethod {
  if (
    raw === 'liquid-fbm' ||
    raw === 'crystal-shatter' ||
    raw === 'droste-nest' ||
    raw === 'kaleido-trap'
  ) {
    return raw;
  }
  return 'liquid-fbm';
}

function sanitizeStyle(raw: unknown, fallback: Image3DConversionStyle = 0): Image3DConversionStyle {
  const n = Math.round(Number(raw));
  if (n === 0 || n === 1 || n === 2 || n === 3) return n;
  return fallback;
}

const STYLE_LABELS: Record<Image3DConversionStyle, string> = {
  0: 'Style A (3D Raymarched KIFS Relief Canyon)',
  1: 'Style B (3D Image-Mandelbulb & Quaternion Sculpture)',
  2: 'Style C (3D Infinite Image Wormhole & Kleinian Cathedral)',
  3: 'Style D (3D Volumetric Fractal Particle Nebula)',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      imageNames = [],
      imageDataUrls = [],
      imageDataUrl = null,
      variationSeed = 0,
      prompt = 'High-depth 3D psychedelic fractal extrusion with liquid beat-synced morphing',
    } = body as {
      imageNames?: string[];
      imageDataUrls?: string[];
      imageDataUrl?: string | null;
      variationSeed?: number;
      prompt?: string;
    };

    const allDataUrls: string[] = [
      ...(Array.isArray(imageDataUrls) ? imageDataUrls : []),
      ...(typeof imageDataUrl === 'string' ? [imageDataUrl] : []),
    ];

    const seedOffset = Math.abs(Math.round(Number(variationSeed) || 0)) + imageNames.length;
    const styleCycle = (seedOffset % 4) as Image3DConversionStyle;
    const blendChoices: MultiImageBlendMethod[] = [
      'liquid-fbm',
      'crystal-shatter',
      'droste-nest',
      'kaleido-trap',
    ];

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
      const palIdx = seedOffset % COSINE_PALETTE_PRESETS.length;
      const fallbackProfile: ImageFractalProfile = {
        summary: `AI 3D Fractal DNA synthesized (${STYLE_LABELS[styleCycle]}) for ${Math.max(1, imageNames.length)} image(s): Sobel + luminance 3D heightfield relief with beat-reactive KIFS folding.`,
        palette: COSINE_PALETTE_PRESETS[palIdx].palette,
        img3DStyle: styleCycle,
        kifsFoldAngle: Number((0.42 + (seedOffset % 5) * 0.14).toFixed(2)),
        bulbPower: Number((7.2 + (seedOffset % 4) * 1.1).toFixed(1)),
        imageDepth3D: Number((0.82 + (seedOffset % 3) * 0.18).toFixed(2)),
        imageFractalizeIterations: 5 + (seedOffset % 4),
        imageMorphTurbulence: Number((0.55 + (seedOffset % 3) * 0.14).toFixed(2)),
        trapScale: Number((0.85 + (seedOffset % 3) * 0.15).toFixed(2)),
        imageBlendMethod: blendChoices[seedOffset % blendChoices.length],
      };
      return NextResponse.json({
        ...fallbackProfile,
        profile: fallbackProfile,
        source: 'deterministic-vision',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    > = [];

    for (const dataUrl of allDataUrls.slice(0, 3)) {
      if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
        const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
        if (match) {
          parts.push({
            inlineData: {
              mimeType: match[1],
              data: match[2],
            },
          });
        }
      }
    }

    parts.push({
      text: `You are an elite WebGL2 GLSL 3D Fractal Shader Director.
Analyze the uploaded user artwork(s) (${imageNames.join(', ') || 'Multi-Image Set'}), variation seed #${variationSeed}, and user goal: "${prompt}".
Design a bespoke Image3DFractalDNA profile that converts the 2D image(s) into a raymarched 3D fractal structure:
- Extract a matching Inigo Quilez Cosine Palette (a, b, c, d in [0..1])
- Select img3DStyle (0 = 3D KIFS Relief Canyon, 1 = 3D Image-Mandelbulb Sculpture, 2 = 3D Infinite Image Wormhole Cathedral, 3 = 3D Volumetric Particle Nebula)
- Tune kifsFoldAngle (0.22 to 1.35), bulbPower (5.5 to 12.0), imageDepth3D (0.35 to 1.65), imageFractalizeIterations (2 to 10), imageMorphTurbulence (0.15 to 1.15), trapScale (0.45 to 1.6), and imageBlendMethod ('liquid-fbm' | 'crystal-shatter' | 'droste-nest' | 'kaleido-trap').`,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: parts,
      config: {
        responseMimeType: 'application/json',
        responseSchema: profileResponseSchema,
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const defPal = COSINE_PALETTE_PRESETS[seedOffset % COSINE_PALETTE_PRESETS.length].palette;
    const profile: ImageFractalProfile = {
      summary:
        typeof parsed.summary === 'string'
          ? parsed.summary
          : `AI Vision 3D Fractal DNA (${STYLE_LABELS[sanitizeStyle(parsed.img3DStyle, styleCycle)]}) calibrated.`,
      palette: {
        a: sanitizeVec3(parsed.palette?.a, defPal.a),
        b: sanitizeVec3(parsed.palette?.b, defPal.b),
        c: sanitizeVec3(parsed.palette?.c, defPal.c),
        d: sanitizeVec3(parsed.palette?.d, defPal.d),
      },
      img3DStyle: sanitizeStyle(parsed.img3DStyle, styleCycle),
      kifsFoldAngle: Math.max(0.2, Math.min(1.4, Number(parsed.kifsFoldAngle) || 0.58)),
      bulbPower: Math.max(4.5, Math.min(13.0, Number(parsed.bulbPower) || 8.0)),
      imageDepth3D: Math.max(0.25, Math.min(1.8, Number(parsed.imageDepth3D) || 0.88)),
      imageFractalizeIterations: Math.max(
        1,
        Math.min(12, Math.round(Number(parsed.imageFractalizeIterations) || 6))
      ),
      imageMorphTurbulence: Math.max(
        0.1,
        Math.min(1.3, Number(parsed.imageMorphTurbulence) || 0.58)
      ),
      trapScale: Math.max(0.35, Math.min(2.0, Number(parsed.trapScale) || 0.9)),
      imageBlendMethod: sanitizeBlendMethod(parsed.imageBlendMethod),
    };

    return NextResponse.json({
      ...profile,
      profile,
      source: 'gemini-2.5-flash',
    });
  } catch {
    const fallbackProfile: ImageFractalProfile = {
      summary:
        'AI 3D Relief & Multi-Image Morph DNA: Sobel depth extrusion with recursive 3D KIFS folding and beat-synced transitions.',
      palette: COSINE_PALETTE_PRESETS[0].palette,
      img3DStyle: 0,
      kifsFoldAngle: 0.58,
      bulbPower: 8.0,
      imageDepth3D: 0.88,
      imageFractalizeIterations: 6,
      imageMorphTurbulence: 0.6,
      trapScale: 0.9,
      imageBlendMethod: 'liquid-fbm',
    };
    return NextResponse.json({
      ...fallbackProfile,
      profile: fallbackProfile,
      source: 'fallback',
    });
  }
}
