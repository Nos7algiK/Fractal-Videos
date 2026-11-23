export function buildFractalVertexShader(gpuHeavyMode = true): string {
  const precisionHeader = gpuHeavyMode
    ? `precision highp float;\nprecision highp int;`
    : `precision mediump float;\nprecision mediump int;`;

  return /* glsl */ `
${precisionHeader}
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;
}

export const FRACTAL_VERTEX_SHADER = buildFractalVertexShader(true);

const FRACTAL_FRAGMENT_BODY = /* glsl */ `
varying vec2 vUv;

uniform float u_time;
uniform vec2 u_resolution;
uniform int u_fractalMode;
uniform int u_prevFractalMode;
uniform float u_morph;
uniform int u_maxSteps;
uniform int u_iterationDetail;
uniform bool u_exportTurbo;
uniform bool u_gpuHeavyMode;

// 4D Hyperspace, Zeno's Paradox & Procedural World Uniforms
uniform int u_polychoraType; // 0 = 8-Cell Tesseract, 1 = 5-Cell Pentachoron, 2 = 16-Cell Orthoplex, 3 = 24-Cell Octaplex, 4 = 120-Cell Dodeca, 5 = Clifford Hypertorus
uniform float u_zenoSpeed;
uniform float u_halvingRate;
uniform float u_escherTwist;
uniform float u_arrowParadoxMix;
uniform float u_sliceHz;
uniform float u_rot4dXW;
uniform float u_rot4dYW;
uniform float u_rot4dZW;
uniform float u_wCameraDist;
uniform float u_worldBiome; // -1.0 = Auto-Evolve, 0.0 = Mountains/Oceans, 1.0 = Flora/Nature, 2.0 = Cyber-City, 3.0 = Fractal Animals
uniform float u_transcendence; // 0.0 = Planetary Ecosystem -> 1.0 = 4D Celestial Cathedral
uniform int u_collageJoinMode; // 0 = Smooth smin, 1 = Terraced Stairs, 2 = Chamfer Bevel, 3 = Subtraction Cutout
uniform float u_cloudDensity;
uniform float u_creatureSpeed;
uniform float u_cameraShake;
uniform float u_feedbackTrail;
uniform float u_emblemSize;
uniform float u_spectrumBars;

// Audio DSP Uniforms (7 Perceptual Bands + Derived Transients + Silence/Spike Envelope)
uniform float u_subBass;
uniform float u_bass;
uniform float u_lowMid;
uniform float u_mid;
uniform float u_upperMid;
uniform float u_presence;
uniform float u_brilliance;
uniform float u_bassCumulative;
uniform float u_midCumulative;
uniform float u_juiceBounce;
uniform float u_audioIntensity;
uniform float u_fractalSpike;
uniform float u_kickTransient;
uniform float u_snareTransient;
uniform float u_hiHatSparkle;
uniform float u_bpmPhase;
uniform float u_mirrorPhase;
uniform float u_pitchHue;
uniform bool u_beatShockwave;

// Fractal Parameters
uniform float u_speed;
uniform float u_scale;
uniform float u_tunnelCurvature;
uniform float u_cameraFov;
uniform float u_bulbPower;
uniform float u_kleinianScale;
uniform float u_foldLimit;
uniform bool u_chaosMode;

// Cosine Palette Vectors (a, b, c, d)
uniform vec3 u_palA;
uniform vec3 u_palB;
uniform vec3 u_palC;
uniform vec3 u_palD;

// Camera & Multi-Touch / XY-Pad Uniforms
uniform vec2 u_cameraOrbit;
uniform float u_cameraRoll;
uniform vec2 u_cameraLateral;
uniform float u_cameraZoom;
uniform vec2 u_xyPad1; // Geometry & 4D Slice / Julia Constant (c.x, c.y)
uniform vec2 u_xyPad2; // [Filter/Kaleido Warp, Texture Orbit Trap Mix]

// Global Meta, High-Clarity Grading & Kaleidoscope Uniforms
uniform float u_clarity;
uniform float u_kaleidoSlices;
uniform bool u_mirrorX;
uniform bool u_mirrorY;
uniform float u_fbmWarp;
uniform float u_metaBrightness;
uniform float u_metaContrast;
uniform float u_metaGamma;
uniform float u_metaSaturation;
uniform float u_metaHueSpeed;
uniform bool u_colorInvert;

// Custom User Image / Logo Orbit Trap, Triplanar, Center Bass Emblem & Multi-Image 3D Morph Uniforms
uniform sampler2D u_userTexture;
uniform sampler2D u_userTextureB;
uniform bool u_hasTexture;
uniform int u_textureMappingMode; // 0 = Orbit Trap, 1 = 3D Triplanar, 2 = Both, 3 = Center Bass Emblem, 4 = Escher-Droste
uniform float u_textureMix;
uniform float u_textureAspect;
uniform float u_textureAspectB;
uniform float u_textureScale;
uniform float u_trapScale;
uniform float u_imageSpinSpeed;
uniform float u_imageBeatPulse;
uniform float u_imageMorphT;
uniform float u_imageDepth3D;
uniform int u_imgFractalIter;
uniform float u_morphTurbulence;
uniform int u_imageBlendMethod; // 0 = Liquid FBM, 1 = Crystal Shatter, 2 = Droste Nest, 3 = Kaleido Trap
uniform int u_img3DStyle;       // 0 = 3D KIFS Relief Canyon, 1 = 3D Image-Mandelbulb Sculpture, 2 = 3D Infinite Image Wormhole, 3 = 3D Volumetric Particle Nebula
uniform float u_kifsFoldAngle;  // KIFS mirror plane rotation angle (radians)
uniform float u_zoomDirection;  // +1.0 = Inward Dive, -1.0 = Outward Emerge, or BPM Pendulum

// Ping-Pong Previous Frame Buffer for Optical Feedback Loop (Modes 1 & 8)
uniform sampler2D u_prevFrame;

// Post-Processing Uniforms
uniform float u_bloomIntensity;
uniform float u_chromaticAberration;
uniform float u_vignetteDarkness;
uniform float u_filmGrain;
uniform bool u_glitchActive;

// Mode 25: Divine Creation (Fiat Lux, Sacred Geometry) & Global Volumetric God Rays Sculptor Uniforms
uniform int u_divineStage;         // 0 = Auto-Evolve (Stages 1-6), 1..6 = Locked Stage
uniform bool u_divineGodRays;      // Global Volumetric Crepuscular God Rays ON/OFF
uniform float u_godRayIntensity;   // 0.0..1.5 (0% to 150%)
uniform float u_godRayDensity;     // 0.2..1.5
uniform float u_godRayWeight;      // 0.05..1.0
uniform float u_godRayDecay;       // 0.92..0.99
uniform float u_godRayExposure;    // 0.1..2.0
uniform bool u_sacredHaloEnabled;  // Global Golden-Ratio & Sacred Geometry Halo Overlay ON/OFF
uniform float u_sacredFiligreeMix; // 0.0..1.0 (0% to 100%)

// --- Utility & Smooth Blending Functions ---
mat2 rotate2D(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

// Polynomial Smooth Minimum (Inigo Quilez smin) for organic biome & creature blending
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / max(k, 1e-4), 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// Multi-Piece SDF Collage Join Operator (Smooth smin, Terraced Stairs, Chamfer Bevel, Subtraction Cutout)
float collageJoin(float a, float b, float k, float steps) {
  if (u_collageJoinMode == 1) {
    // Terraced Stair-Step Union (hg_sdf fOpUnionStairs)
    float s = k / max(steps, 2.0);
    float u = b - k;
    return min(min(a, b), 0.5 * (u + a + abs(mod(u - a + s, 2.0 * s) - s)));
  } else if (u_collageJoinMode == 2) {
    // Architectural Chamfer Bevel Union
    return min(min(a, b), (a - k + b) * 0.70710678);
  } else if (u_collageJoinMode == 3) {
    // Fractured Cutout / Carve Hybrid
    float cut = max(a, -(b - k * 0.45));
    return min(cut, b);
  }
  return smin(a, b, k);
}

// Full 6-Plane 4D Hyperspace Rotation (XW, YW, ZW, XY, XZ, YZ)
vec4 rotate4D(vec4 p, float xw, float yw, float zw, float xy, float xz, float yz) {
  p.xw *= rotate2D(xw);
  p.yw *= rotate2D(yw);
  p.zw *= rotate2D(zw);
  p.xy *= rotate2D(xy);
  p.xz *= rotate2D(xz);
  p.yz *= rotate2D(yz);
  return p;
}

// Fast 3D Trigonometric FBM Domain Warp
vec3 fbmWarp3D(vec3 p, float strength) {
  if (strength <= 0.001) return vec3(0.0);
  vec3 w = sin(p.yzx * 2.1 + u_time * 0.45) * 0.55 +
           cos(p.zxy * 4.3 - u_time * 0.35) * 0.28;
  return w * (strength * (0.12 + u_hiHatSparkle * 0.08));
}

// Inigo Quilez Cosine Palette
vec3 palette(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
  float hueShift = u_pitchHue * 0.65 + u_time * u_metaHueSpeed * 0.08;
  return clamp(a + b * cos(6.2831853 * (c * (t + hueShift) + d)), 0.0, 1.0);
}

// Thin-Film Iridescence Helper
vec3 thinFilmIridescence(float cosTheta, float phaseShift) {
  return 0.5 + 0.5 * cos(6.2831853 * (cosTheta * 2.4 + phaseShift + vec3(0.0, 0.33, 0.67)));
}

// Aspect Ratio + Beat-Pulse + Spin Helper for User Uploaded Texture A & B
vec2 correctUV(vec2 uv) {
  float beatZoom = 1.0 - min(0.45, u_kickTransient * u_imageBeatPulse * 0.35);
  vec2 centered = uv * u_textureScale * beatZoom;
  centered *= rotate2D(u_time * u_imageSpinSpeed * 0.35 + u_snareTransient * 0.25);
  centered.x *= u_textureAspect;
  return fract(centered + 0.5);
}

vec2 correctUV_B(vec2 uv) {
  float beatZoom = 1.0 - min(0.45, u_kickTransient * u_imageBeatPulse * 0.35);
  vec2 centered = uv * u_textureScale * beatZoom;
  centered *= rotate2D(u_time * u_imageSpinSpeed * 0.35 + u_snareTransient * 0.25);
  centered.x *= max(0.25, u_textureAspectB);
  return fract(centered + 0.5);
}

// Samples both Image A and Image B (RGBA where .a holds the synthesized 3D Height/Depth map)
vec4 sampleMultiImagePair(vec2 uv) {
  float tMorph = clamp(u_imageMorphT, 0.0, 1.0);
  vec2 warp = vec2(
    sin(uv.y * 7.5 + u_time * 1.4),
    cos(uv.x * 7.5 - u_time * 1.2)
  ) * (u_morphTurbulence * 0.14 * sin(tMorph * 3.14159265));
  vec4 texA = texture2D(u_userTexture, correctUV(uv + warp));
  vec4 texB = texture2D(u_userTextureB, correctUV_B(uv - warp));
  return mix(texA, texB, smoothstep(0.0, 1.0, tMorph));
}

// 3D Triplanar Surface Mapping (sampled ONLY once at surface hit, never inside raymarch loop)
vec3 sampleTriplanar(vec3 p, vec3 n) {
  vec3 w = pow(abs(n), vec3(4.0));
  w /= max(w.x + w.y + w.z, 1e-5);
  vec3 cx = sampleMultiImagePair(p.yz * 0.45).rgb;
  vec3 cy = sampleMultiImagePair(p.xz * 0.45).rgb;
  vec3 cz = sampleMultiImagePair(p.xy * 0.45).rgb;
  return cx * w.x + cy * w.y + cz * w.z;
}

// Complex Arithmetic Helpers for Zeno's Paradox Escher-Droste Log-Polar Spiral
vec2 cLog(vec2 z) {
  return vec2(log(max(length(z), 1e-5)), atan(z.y, z.x));
}

vec2 cExp(vec2 z) {
  return exp(clamp(z.x, -12.0, 12.0)) * vec2(cos(z.y), sin(z.y));
}

vec2 cMul(vec2 a, vec2 b) {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

vec2 cDiv(vec2 a, vec2 b) {
  float denom = max(dot(b, b), 1e-6);
  return vec2(a.x * b.x + a.y * b.y, a.y * b.x - a.x * b.y) / denom;
}

// Zeno Recursive Picture-in-Picture Droste Orbit Trap (nested 1/2^n image zoom)
vec3 sampleZenoDrosteTrap(vec2 uv) {
  float r1 = 0.25;
  float r2 = 1.0;
  float scaleRatio = log(r2 / r1); // ln(4) = 2 * ln(2) dyadic halving octave
  float angle = atan((scaleRatio * u_escherTwist) / 6.2831853);
  vec2 z = cLog(uv + vec2(1e-4));
  vec2 twistBase = cExp(vec2(0.0, angle)) * cos(angle);
  z = cDiv(z, twistBase);
  z.x = mod(z.x - u_time * u_zenoSpeed - u_bassCumulative * 1.5, scaleRatio);
  vec2 drosteUv = cExp(z) * r1;
  return texture2D(u_userTexture, correctUV(drosteUv * 1.35)).rgb;
}

// Sinusoidal 3D Wormhole Path (Mode 4)
vec2 wormholePath(float z) {
  float curv = max(0.0, u_tunnelCurvature);
  return vec2(sin(z * 0.15) * 1.35, cos(z * 0.12) * 1.05) * curv;
}

// ============================================================================
// MODE 0: 4D TESSERACT (HYPERCUBE) & POLYCHORA HYPERSPACE PROJECTION
// ============================================================================
vec4 evaluateMode0_Tesseract4D(vec3 pos, out vec2 minTrapUV) {
  minTrapUV = vec2(0.0);
  float rBound = length(pos);
  if (rBound > 3.25) {
    return vec4(rBound - 2.6, 1.0, 0.0, 0.0);
  }

  // Lift 3D ray point into 4D Hyperspace (x, y, z, w)
  float wSlice = sin(u_time * 0.35 + u_bassCumulative * 0.45) * 0.42 + u_xyPad1.x * 0.45;
  vec4 p4 = vec4(pos + fbmWarp3D(pos, u_fbmWarp * 0.28), wSlice);

  // Full 6-plane 4D rotation driven by user sliders + bass/mid audio energy
  float xw = u_rot4dXW + u_time * 0.38 + u_bassCumulative * 0.55 + u_xyPad1.x * 1.4;
  float yw = u_rot4dYW + u_time * 0.29 + u_midCumulative * 0.48 + u_xyPad1.y * 1.4;
  float zw = u_rot4dZW + u_time * 0.21 + u_subBass * 0.65;
  float xy = u_time * 0.14 + u_snareTransient * 0.25;
  float xz = u_time * 0.18;
  float yz = u_time * 0.12;
  p4 = rotate4D(p4, xw, yw, zw, xy, xz, yz);

  // Stereographic projection from 4D to 3D: p3d = p4d.xyz / (wDist - p4d.w)
  float wDist = clamp(u_wCameraDist, 1.45, 3.6);
  float denom = max(0.38, wDist - p4.w * 0.65);
  vec3 proj3 = p4.xyz / denom;

  float strutThickness = 0.052 + u_subBass * 0.022 + u_fractalSpike * 0.015;
  vec4 ad = abs(abs(p4) - vec4(0.68 + u_bass * 0.14 + u_kickTransient * 0.09));
  float e1 = length(max(ad.xy, 0.0)) + min(max(ad.x, ad.y), 0.0);
  float e2 = length(max(ad.zw, 0.0)) + min(max(ad.z, ad.w), 0.0);
  float e3 = length(max(ad.xz, 0.0)) + min(max(ad.x, ad.z), 0.0);
  float e4 = length(max(ad.yw, 0.0)) + min(max(ad.y, ad.w), 0.0);
  float tesseract8 = min(min(e1, e2), min(e3, e4)) - strutThickness;

  // Polychora Selector (0=8-Cell, 1=5-Cell, 2=16-Cell, 3=24-Cell, 4=120-Cell, 5=Clifford Hypertorus)
  float primaryPolychora = tesseract8;
  float polyRadius = 0.92 + u_mid * 0.20 + u_kickTransient * 0.08;
  if (u_polychoraType == 1) {
    // 5-Cell Pentachoron (4D Simplex tetrahedral hyper-lattice)
    float s1 = (p4.x + p4.y + p4.z - p4.w) * 0.5;
    float s2 = (p4.x - p4.y - p4.z - p4.w) * 0.5;
    float s3 = (-p4.x + p4.y - p4.z - p4.w) * 0.5;
    float s4 = (-p4.x - p4.y + p4.z - p4.w) * 0.5;
    float simplexBody = max(max(s1, s2), max(s3, max(s4, p4.w))) - polyRadius * 0.68;
    primaryPolychora = min(abs(simplexBody) - strutThickness * 0.85, tesseract8 * 1.15);
  } else if (u_polychoraType == 2) {
    // 16-Cell Orthoplex (4D Cross-Polytope)
    float ortho = (abs(p4.x) + abs(p4.y) + abs(p4.z) + abs(p4.w) - polyRadius * 1.12) * 0.5;
    primaryPolychora = min(abs(ortho) - strutThickness * 0.85, e1 - strutThickness);
  } else if (u_polychoraType == 3) {
    // 24-Cell Octaplex (Self-dual 4D polytope: intersection of 8-cell and 16-cell duals)
    vec4 ap = abs(p4);
    float c24 = max(
      max(ap.x + ap.y, ap.z + ap.w),
      max(max(ap.x + ap.z, ap.y + ap.w), max(ap.x + ap.w, ap.y + ap.z))
    ) * 0.7071 - polyRadius * 0.82;
    primaryPolychora = min(abs(c24) - strutThickness * 0.82, tesseract8);
  } else if (u_polychoraType == 4) {
    // 120-Cell Hyper-Dodecahedron (Golden-Ratio 4D Coxeter H4 folding)
    vec4 gp = abs(p4);
    const float phi = 1.6180339887;
    vec4 n1 = normalize(vec4(phi, 1.0, 1.0 / phi, 0.0));
    vec4 n2 = normalize(vec4(1.0, phi, 0.0, 1.0 / phi));
    for (int k = 0; k < 3; k++) {
      gp = abs(gp);
      gp -= 2.0 * min(0.0, dot(gp, n1)) * n1;
      gp -= 2.0 * min(0.0, dot(gp, n2)) * n2;
    }
    float dodeca120 = abs(length(gp.xy) - 0.48 - u_bass * 0.12) - strutThickness * 0.78;
    primaryPolychora = min(dodeca120, tesseract8 * 1.1);
  } else if (u_polychoraType == 5) {
    // 4D Clifford Duocylinder / Hypertorus (S1 x S1 in S3)
    float rA = length(p4.xy) - (0.64 + u_bass * 0.14);
    float rB = length(p4.zw) - (0.52 + u_mid * 0.14);
    float cliffordBody = abs(length(vec2(rA, rB)) - 0.16) - strutThickness * 0.65;
    float cliffordRings = length(vec2(rA, rB)) - strutThickness * 1.15;
    primaryPolychora = min(cliffordBody, cliffordRings);
  } else {
    // Default 0: 8-Cell Tesseract + 16-Cell Inner Core
    float poly16 = (abs(p4.x) + abs(p4.y) + abs(p4.z) + abs(p4.w) - polyRadius) * 0.5;
    primaryPolychora = min(tesseract8, (abs(poly16) - 0.038) * 0.85);
  }

  // Hybridize struts with a 4D KIFS Fractal Field so edges pulse with recursive filaments
  vec4 z = vec4(proj3, p4.w);
  float scaleAcc = 1.0;
  float minTrap = 1e10;
  float kScale = 1.88 + u_bass * 0.18 + u_fractalSpike * 0.08;
  int folds = clamp(u_iterationDetail - 3, 3, u_exportTurbo ? 5 : 7);

  for (int i = 0; i < 8; i++) {
    if (i >= folds) break;
    z = abs(z);
    if (z.x < z.y) z.xy = z.yx;
    if (z.x < z.z) z.xz = z.zx;
    if (z.y < z.w) z.yw = z.wy;
    z = z * kScale - vec4(0.92, 0.85, 0.78, 0.65 + u_kickTransient * 0.15) * (kScale - 1.0);
    scaleAcc *= kScale;

    float td = length(z.xy);
    if (td < minTrap) {
      minTrap = td;
      minTrapUV = z.xy * u_trapScale;
    }
  }

  float kifsFilaments = (length(z) - 1.25) / max(scaleAcc, 1.0);
  float combined4D = collageJoin(primaryPolychora, kifsFilaments, 0.09, 4.0);

  // Correct distance by stereographic projection conformal factor
  float d = combined4D * denom * 0.65;
  return vec4(d, clamp(minTrap * 0.55, 0.0, 1.0), log(scaleAcc + 1.0) * 0.16 + abs(p4.w) * 0.35, 0.0);
}

// ============================================================================
// MODE 3: "FRACTAL GENESIS V2" — 5-LAYER AI PROCEDURAL WORLD GENERATION
// (Layer 1: Voronoi/FBM Tectonic Terrain & Ocean, Layer 2: Benesi Pine/Romanesco Flora,
//  Layer 3: Amazing Surf Cyber-Cities, Layer 4: Phoenix/Jellyfish/Lorenz Fauna,
//  plus Transcendental 4D Sky-Cathedral Ascension & Multi-Piece SDF Collage Join)
// ============================================================================
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Fast Cellular Voronoi Cracks / Tectonic Ridges (F2 - F1, 2x2 neighborhood for zero linker bloat)
vec2 voronoiCrack2D(vec2 x) {
  vec2 n = floor(x);
  vec2 f = fract(x);
  float f1 = 8.0;
  float f2 = 8.0;
  for (int j = 0; j <= 1; j++) {
    for (int i = 0; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = vec2(hash21(n + g), hash21(n + g + vec2(17.0, 31.0)));
      o = 0.5 + 0.35 * sin(u_time * 0.35 + 6.2831 * o);
      vec2 r = g - f + o;
      float d = dot(r, r);
      if (d < f1) {
        f2 = f1;
        f1 = d;
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  return vec2(sqrt(f1), sqrt(f2) - sqrt(f1));
}

// Domain-Warped Multi-Octave Tectonic FBM Terrain
float fbmTerrain2D(vec2 p) {
  vec2 warp = vec2(
    sin(p.y * 1.35 + u_time * 0.12),
    cos(p.x * 1.35 - u_time * 0.10)
  ) * (0.28 + u_fbmWarp * 0.18);
  p += warp;
  float v = 0.0;
  float amp = 0.54;
  mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 4; i++) {
    v += amp * (sin(p.x) * cos(p.y));
    p = rot * p * 2.06 + vec2(1.3, 0.7);
    amp *= 0.48;
  }
  return v;
}

vec4 evaluateMode3_FractalGenesisWorld(vec3 pos, out vec2 minTrapUV) {
  minTrapUV = pos.xz * 0.25 * u_trapScale;

  // Analytical Bounding-Plane Early Exit when ray is high above world ceiling and transcendence is low
  if (pos.y > 2.45 && u_transcendence < 0.08) {
    return vec4((pos.y - 2.15) * 0.85, 0.2, 0.1, 0.0);
  }

  // Transcendental Ascension: smoothly fold world coordinates into a 4D Kleinian Sky-Cathedral
  vec3 wPos = pos;
  if (u_transcendence > 0.01) {
    vec3 skyFold = wPos;
    skyFold.xy *= rotate2D(sin(wPos.z * 0.18 + u_time * 0.2) * u_transcendence * 0.65);
    skyFold.y = mix(skyFold.y, -abs(skyFold.y) + 0.85 * u_transcendence, u_transcendence * 0.65);
    wPos = mix(wPos, skyFold, u_transcendence);
  }

  // Determine active biome phase (0 = Mountains/Oceans, 1 = Flora/Nature, 2 = Cyber-City, 3 = Fractal Animals)
  float biomePhase = u_worldBiome < -0.5
    ? mod(u_time * 0.075 + u_bassCumulative * 0.06, 4.0)
    : clamp(u_worldBiome, 0.0, 3.0);

  float wMountains = clamp(1.0 - abs(biomePhase - 0.0), 0.0, 1.0);
  float wNature    = clamp(1.0 - abs(biomePhase - 1.0), 0.0, 1.0);
  float wCity      = clamp(1.0 - abs(biomePhase - 2.0), 0.0, 1.0);
  float wAnimals   = clamp(1.0 - abs(biomePhase - 3.0), 0.0, 1.0);
  if (u_worldBiome < -0.5 && biomePhase > 3.0) {
    wMountains = max(wMountains, biomePhase - 3.0);
  }

  float dWorld = 1e5;
  float trapMetric = 0.5;
  float derivMetric = 0.4;

  // --- LAYER 1 (BIOME A): Tectonic Geology, Voronoi Fault Cracks, Strata Terracing & Gerstner Ocean ---
  if (wMountains > 0.01 || wNature > 0.01) {
    vec2 tp = wPos.xz * 0.62;
    vec2 vor = u_exportTurbo ? vec2(0.4, 0.25) : voronoiCrack2D(tp * 0.85);
    float mountainElevation = fbmTerrain2D(tp) * (0.95 + u_bass * 0.55 + u_xyPad1.y * 0.45);
    float faultRidges = (1.0 - smoothstep(0.0, 0.22, vor.y)) * (0.24 + u_subBass * 0.28 + u_kickTransient * 0.22);
    float strataTerrace = (abs(fract(wPos.y * 5.5) - 0.5) - 0.25) * 0.055;
    float ridgeSpikes = abs(sin(tp.x * 3.5) * sin(tp.y * 3.5)) * (0.16 + u_fractalSpike * 0.14);
    float terrainH = -0.84 + mountainElevation + faultRidges + ridgeSpikes + strataTerrace;

    // Gerstner-style multi-directional ocean swells + sub-bass ripples
    float swell1 = sin(wPos.x * 2.8 + wPos.z * 1.4 + u_time * 2.3);
    float swell2 = cos(wPos.z * 3.4 - wPos.x * 1.1 - u_time * 1.9);
    float oceanWave = -0.78 + (swell1 * 0.6 + swell2 * 0.4) * (0.045 + u_subBass * 0.065);
    float dTerrain = (wPos.y - max(terrainH, oceanWave)) * 0.66;
    dWorld = min(dWorld, dTerrain);
    trapMetric = clamp(abs(terrainH - oceanWave) * 1.35 + (1.0 - vor.y) * 0.35, 0.0, 1.0);
  }

  // --- LAYER 2 (BIOME B): Recursive Botanical Flora, 3D Benesi Pine Canopies & Romanesco Spirals ---
  if (wNature > 0.01) {
    vec3 fp = wPos;
    fp.y += 0.32;
    float cell = 2.55;
    fp.xz = mod(fp.xz + 0.5 * cell, cell) - 0.5 * cell;

    float scaleF = 1.0;
    float sway = sin(u_time * 1.4 + wPos.z * 0.5) * (0.18 + u_lowMid * 0.25 + u_mid * 0.22);
    int floraIters = u_exportTurbo ? 4 : 5;
    for (int i = 0; i < 5; i++) {
      if (i >= floraIters) break;
      // Benesi-inspired cylindrical pine-tree folding + phyllotaxis golden angle twist
      fp.xz = abs(fp.xz);
      fp.xy *= rotate2D(0.54 + sway * 0.35);
      fp.xz *= rotate2D(2.399963); // Golden angle 137.5 deg phyllotaxis spiral
      fp.yz *= rotate2D(0.36 - sway * 0.25);
      fp = fp * 1.76 - vec3(0.36, 0.62 + u_presence * 0.18 + u_upperMid * 0.12, 0.36);
      scaleF *= 1.76;
    }
    float dFlora = (length(fp) - 0.56) / scaleF;
    dWorld = dWorld > 1e4 ? dFlora : mix(dWorld, collageJoin(dWorld, dFlora, 0.22, 5.0), wNature);
    derivMetric = mix(derivMetric, log(scaleF) * 0.22, wNature);
  }

  // --- LAYER 3 (BIOME C): Cyber-Kleinian & "Amazing Surf" Megacities ---
  if (wCity > 0.01) {
    vec3 cp = wPos;
    float cityCell = 2.4;
    vec2 cellId = floor((cp.xz + 0.5 * cityCell) / cityCell);
    cp.xz = mod(cp.xz + 0.5 * cityCell, cityCell) - 0.5 * cityCell;

    float towerHash = hash21(cellId);
    float towerHeight = 0.55 + towerHash * (1.28 + u_bass * 0.85 + u_kickTransient * 0.45);
    vec3 boxD = abs(cp - vec3(0.0, -0.85 + towerHeight * 0.5, 0.0)) - vec3(0.42, towerHeight, 0.42);
    float dSkyscraper = length(max(boxD, 0.0)) + min(max(boxD.x, max(boxD.y, boxD.z)), 0.0);

    // Amazing Surf 2-Axis Box Folding + Sphere Inversion Architectural Arches
    vec3 surfP = cp;
    float surfScale = 1.0;
    for (int i = 0; i < 3; i++) {
      surfP.xz = clamp(surfP.xz, -0.52, 0.52) * 2.0 - surfP.xz;
      float r2 = clamp(dot(surfP, surfP), 0.28, 1.0);
      surfP /= r2;
      surfScale /= r2;
      surfP = surfP * 1.35 - vec3(0.22, 0.35, 0.22);
      surfScale *= 1.35;
    }
    float dArches = (length(surfP.xz) - 0.18) / max(surfScale, 1.0);
    dSkyscraper = collageJoin(dSkyscraper, dArches, 0.12, 4.0);

    // Kleinian facade grooves & FFT equalizer windows
    vec3 kp = cp * 3.2;
    kp = -1.0 + 2.0 * fract(0.5 * kp + 0.5);
    float groove = (0.14 - max(abs(kp.x), abs(kp.z))) / 3.2;
    dSkyscraper = max(dSkyscraper, -groove);

    float dGround = wPos.y + 0.92;
    float dCityTotal = min(dGround, dSkyscraper * 0.82);

    float winGrid = step(0.35, fract(wPos.y * 8.0)) * step(0.35, fract((wPos.x + wPos.z) * 6.0));
    dWorld = dWorld > 1e4 ? dCityTotal : mix(dWorld, collageJoin(dWorld, dCityTotal, 0.18, 4.0), wCity);
    trapMetric = mix(trapMetric, clamp(towerHash + winGrid * (0.45 + u_mid * 0.6 + u_upperMid * 0.35), 0.0, 1.0), wCity);
    derivMetric = mix(derivMetric, 0.55 + winGrid * 0.65, wCity);
  }

  // --- LAYER 4 (BIOME D): Living Biomimetic Fractal Animals & Strange-Attractor Fauna ---
  if (wAnimals > 0.01) {
    vec3 ap = wPos;
    float zCenter = 0.85 + u_time * u_speed * 0.55 + u_bassCumulative * 0.85 + 2.35;
    ap.z -= zCenter;
    ap.y -= sin(u_time * 1.8) * 0.18;

    // 1) Aerial Fractal Phoenix / Manta Flyer with kinematic flapping wings
    float wingSpanX = abs(ap.x);
    float flapPhase = u_time * (2.6 * max(0.3, u_creatureSpeed)) + u_bassCumulative * 1.2 - wingSpanX * 1.65;
    float flapY = sin(flapPhase) * wingSpanX * (0.58 + u_bass * 0.28 + u_kickTransient * 0.22);

    vec3 wingP = vec3(wingSpanX, ap.y - flapY, ap.z + wingSpanX * 0.25);
    float bodyCapsule = length(vec3(ap.x * 2.2, ap.y * 1.8, ap.z * 0.75)) - 0.28;

    vec3 fk = wingP;
    float wScale = 1.0;
    for (int i = 0; i < 4; i++) {
      fk = abs(fk) - vec3(0.34 + u_mid * 0.08, 0.06, 0.14);
      fk.xy *= rotate2D(0.28 + sin(flapPhase) * 0.15);
      fk *= 1.55;
      wScale *= 1.55;
    }
    float dWings = (length(vec3(fk.x * 0.55, fk.y * 2.2, fk.z * 0.9)) - 0.35) / wScale;

    // 2) Bioluminescent Abyssal Jellyfish Bell pulsing with u_bpmPhase
    float bpmPulse = sin(u_bpmPhase * 6.2831853 + ap.y * 3.8);
    float bellRadius = 0.54 + 0.14 * bpmPulse + u_subBass * 0.08;
    float dBell = abs(length(ap - vec3(0.0, 0.25, 0.0)) - bellRadius) - 0.038;
    dBell = max(dBell, -ap.y + 0.14);

    // 3) Lorenz / De Jong Strange-Attractor Spirit Ribbon orbiting the creature
    float ribbonAngle = ap.z * 2.6 + u_time * 2.4;
    vec2 orbitCenter = vec2(sin(ribbonAngle) * 0.65, cos(ribbonAngle * 1.5) * 0.38);
    float dSpiritRibbon = length(ap.xy - orbitCenter) - (0.045 + u_brilliance * 0.035);

    float dCreature = collageJoin(bodyCapsule, dWings, 0.14, 4.0);
    dCreature = collageJoin(dCreature, dBell, 0.18, 4.0);
    dCreature = smin(dCreature, dSpiritRibbon, 0.12);

    minTrapUV = wingP.xz * u_trapScale;
    dWorld = dWorld > 1e4 ? dCreature : mix(dWorld, collageJoin(dWorld, dCreature, 0.25, 5.0), wAnimals);
    trapMetric = mix(trapMetric, clamp(wingSpanX * 0.75 + u_kickTransient * 0.35, 0.0, 1.0), wAnimals);
    derivMetric = mix(derivMetric, 0.75 + abs(sin(flapPhase)) * 0.5, wAnimals);
  }

  // Transcendental Ascension Overlay: blend 4D Kleinian Sky-Cathedral lattice when u_transcendence > 0
  if (u_transcendence > 0.02) {
    vec3 tp4 = wPos * (1.25 + u_transcendence * 0.6);
    float tScale = 1.0;
    for (int i = 0; i < 4; i++) {
      tp4 = -1.0 + 2.0 * fract(0.5 * tp4 + 0.5);
      float r2 = max(dot(tp4, tp4), 0.18);
      float k = (1.32 + u_mid * 0.18) / r2;
      tp4 *= k;
      tScale *= k;
    }
    float dAscended = (length(tp4.xz) - 0.28) / max(tScale, 1.0);
    dWorld = collageJoin(dWorld, dAscended, 0.28 * u_transcendence + 0.05, 5.0);
    derivMetric = mix(derivMetric, log(tScale + 1.0) * 0.18, u_transcendence * 0.65);
  }

  return vec4(dWorld * 0.78, trapMetric, derivMetric, biomePhase);
}

// ============================================================================
// MODE 4: 3D INFINITE KIFS / MANDELBOX WORMHOLE TUNNEL
// ============================================================================
vec4 evaluateMode4_Wormhole(vec3 pos, out vec2 minTrapUV) {
  minTrapUV = vec2(0.0);
  vec3 p = pos + fbmWarp3D(pos, u_fbmWarp * 0.45);
  p.xy -= wormholePath(p.z);

  p.xy *= rotate2D(p.z * (0.12 + u_fractalSpike * 0.035) + u_mid * 0.45 + u_snareTransient * 0.22);

  float radialDist = length(p.xy);
  float innerClearance = 0.34 - radialDist;

  float cellZ = 2.85;
  vec3 q = p;
  q.z = mod(q.z + 0.5 * cellZ, cellZ) - 0.5 * cellZ;

  vec4 z = vec4(q, 1.0);
  float minTrap = 1e10;
  float minR2 = 0.25;
  float fixedR2 = 1.0;
  float dynamicFold = max(0.68, u_foldLimit - u_fractalSpike * 0.11);
  float scale = u_scale + u_bass * 0.18 + u_fractalSpike * 0.12;
  vec3 offsetC = vec3(
    -1.08 + u_xyPad1.x * 0.32,
    -0.98 + u_xyPad1.y * 0.32,
    -1.18 - u_kickTransient * 0.14
  );

  int folds = clamp(u_iterationDetail, 4, u_exportTurbo ? 8 : 11);
  for (int i = 0; i < 12; i++) {
    if (i >= folds) break;
    z.xyz = clamp(z.xyz, -dynamicFold, dynamicFold) * 2.0 - z.xyz;

    z.xyz = abs(z.xyz);
    if (z.x < z.y) z.xy = z.yx;
    if (z.y < z.z) z.yz = z.zy;

    float r2 = dot(z.xyz, z.xyz);
    if (r2 < minR2) {
      z *= (fixedR2 / minR2);
    } else if (r2 < fixedR2) {
      z *= (fixedR2 / r2);
    }

    z.xyz = z.xyz * scale + offsetC;
    z.w = z.w * abs(scale) + 1.0;

    float trapDist = length(z.xy);
    if (trapDist < minTrap) {
      minTrap = trapDist;
      minTrapUV = z.xy * u_trapScale;
    }
  }

  float spikeThorns =
    abs(sin(q.x * 7.0) * sin(q.y * 7.0) * cos(q.z * 7.0)) *
    min(0.24, (u_fractalSpike * 0.085 + u_hiHatSparkle * 0.05));

  float kifsDist = (length(z.xyz) - 1.45) / abs(z.w) - spikeThorns;
  float outerWall = (1.02 + 0.16 * sin(p.z * 0.9) - radialDist) + kifsDist * 0.65;
  float d = max(innerClearance, min(kifsDist, outerWall)) * 0.75;
  return vec4(d, clamp(minTrap * 0.48, 0.0, 1.0), log(abs(z.w) + 1.0) * 0.14, 0.0);
}

// ============================================================================
// MODE 5: 3D RAYMARCHED MANDELBULB & 4D QUATERNION MORPH
// ============================================================================
vec4 evaluateMode5_Mandelbulb(vec3 pos, out vec2 minTrapUV) {
  minTrapUV = vec2(0.0);
  float rBound = length(pos);
  if (rBound > 2.45) {
    return vec4(rBound - 1.95, 1.0, 0.0, 0.0);
  }

  vec3 p = pos + fbmWarp3D(pos, u_fbmWarp * 0.35);
  p.xz *= rotate2D(u_time * 0.22 + u_midCumulative * 0.35 + 0.4);
  p.yz *= rotate2D(u_time * 0.14 + 0.35);

  vec3 z = p;
  float dr = 1.0;
  float r = 0.0;
  float power = u_bulbPower + u_bass * 2.8 + u_fractalSpike * 1.35;
  float minTrap = 1e10;
  vec3 juliaShift = vec3(u_xyPad1.x * 0.28, u_xyPad1.y * 0.28, u_presence * 0.22);

  int bulbLoops = clamp(u_iterationDetail - 2, 4, u_exportTurbo ? 6 : 8);
  for (int i = 0; i < 9; i++) {
    if (i >= bulbLoops) break;
    r = length(z);
    if (r > 2.2) break;

    float trapD = length(z.xy);
    if (trapD < minTrap) {
      minTrap = trapD;
      minTrapUV = z.xy * u_trapScale;
    }

    float theta = acos(clamp(z.z / max(r, 1e-5), -1.0, 1.0));
    float phi = atan(z.y, z.x);
    dr = pow(max(r, 1e-4), power - 1.0) * power * dr + 1.0;

    float spikeHarmonic = 1.0 + min(0.32, (u_fractalSpike * 0.14 + u_hiHatSparkle * 0.06)) * cos(theta * 8.0) * sin(phi * 8.0);
    float zr = pow(max(r, 1e-4), power) * spikeHarmonic;
    theta *= power;
    phi *= power;

    z = zr * vec3(sin(theta) * cos(phi), sin(phi) * sin(theta), cos(theta)) +
        mix(p, juliaShift + p * 0.72, 0.28 + u_snareTransient * 0.1);
  }

  float de = 0.5 * log(max(r, 1.0001)) * r / max(dr, 1e-4);
  return vec4(de * 0.85, clamp(minTrap * 0.65, 0.0, 1.0), log(dr + 1.0) * 0.14, 0.0);
}

// ============================================================================
// MODE 6: 3D APOLLONIAN CATHEDRAL & PSEUDO-KLEINIAN SPONGE
// ============================================================================
vec4 evaluateMode6_Kleinian(vec3 pos, out vec2 minTrapUV) {
  minTrapUV = vec2(0.0);
  vec3 p = pos + fbmWarp3D(pos, u_fbmWarp * 0.4);
  float corridorClearance = 0.30 - length(p.xy);
  p.xy *= rotate2D(sin(p.z * 0.1 + u_time * 0.15) * (0.22 + u_fractalSpike * 0.09));

  float scale = 1.0;
  float trap = 1e10;
  float kScale = u_kleinianScale + u_mid * 0.22 + u_fractalSpike * 0.08 + u_xyPad1.x * 0.12;

  int kLoops = clamp(u_iterationDetail - 2, 4, u_exportTurbo ? 6 : 8);
  for (int i = 0; i < 9; i++) {
    if (i >= kLoops) break;
    p = -1.0 + 2.0 * fract(0.5 * p + 0.5);
    float r2 = dot(p, p);
    if (r2 < trap) {
      trap = r2;
      minTrapUV = p.xy * u_trapScale;
    }
    float k = kScale / max(r2, 1e-4);
    p *= k;
    scale *= k;
  }

  float needleSpike = abs(sin(p.x * 5.0) * sin(p.z * 5.0)) * min(0.16, (u_fractalSpike * 0.06 + u_hiHatSparkle * 0.04));
  float kleinianDist = max(0.0, (0.25 * abs(p.y) - needleSpike)) / max(scale, 1e-4);
  float d = max(corridorClearance, kleinianDist * 0.82);
  return vec4(d, clamp(sqrt(trap) * 0.75, 0.0, 1.0), log(scale + 1.0) * 0.14, 0.0);
}

vec4 mapMode(vec3 p, int mode, out vec2 minTrapUV) {
#if defined(LOCKED_FRACTAL_MODE)
  #if LOCKED_FRACTAL_MODE == 0
    return evaluateMode0_Tesseract4D(p, minTrapUV);
  #elif LOCKED_FRACTAL_MODE == 3
    return evaluateMode3_FractalGenesisWorld(p, minTrapUV);
  #elif LOCKED_FRACTAL_MODE == 5
    return evaluateMode5_Mandelbulb(p, minTrapUV);
  #elif LOCKED_FRACTAL_MODE == 6
    return evaluateMode6_Kleinian(p, minTrapUV);
  #else
    return evaluateMode4_Wormhole(p, minTrapUV);
  #endif
#else
  if (mode == 0) {
    return evaluateMode0_Tesseract4D(p, minTrapUV);
  } else if (mode == 3) {
    return evaluateMode3_FractalGenesisWorld(p, minTrapUV);
  } else if (mode == 5) {
    return evaluateMode5_Mandelbulb(p, minTrapUV);
  } else if (mode == 6) {
    return evaluateMode6_Kleinian(p, minTrapUV);
  }
  return evaluateMode4_Wormhole(p, minTrapUV);
#endif
}

float mapDistanceOnly(vec3 p, int mode) {
  vec2 dummyUV;
  return mapMode(p, mode, dummyUV).x;
}

// Lightweight Distance Proxy for AO & Soft Shadows (prevents 30x full-SDF linker unrolling on ANGLE/Mobile GPUs)
float mapFastLightingProxy(vec3 p, int mode) {
  if (mode == 0) {
    vec4 ad = abs(abs(vec4(p, sin(u_time * 0.35) * 0.4)) - vec4(0.68 + u_bass * 0.14));
    float e1 = length(max(ad.xy, 0.0)) + min(max(ad.x, ad.y), 0.0);
    float e2 = length(max(ad.zw, 0.0)) + min(max(ad.z, ad.w), 0.0);
    return min(e1, e2) - 0.055;
  } else if (mode == 3) {
    float h = -0.78 + sin(p.x * 1.4) * cos(p.z * 1.4) * 0.45;
    return (p.y - h) * 0.7;
  } else if (mode == 5) {
    return length(p) - 1.15;
  } else if (mode == 6) {
    vec3 q = -1.0 + 2.0 * fract(0.5 * p + 0.5);
    return (abs(q.y) - 0.15) * 0.5;
  }
  vec2 pathOffset = wormholePath(p.z);
  return 1.35 - length(p.xy - pathOffset);
}

// 4-Point Tetrahedron Surface Normal Evaluation
vec3 calcNormal(vec3 p, int mode) {
  #ifdef GPU_HEAVY_PRECISION
  float eps = u_gpuHeavyMode ? 0.00065 : 0.0012;
  #else
  float eps = 0.0014;
  #endif
  const vec2 k = vec2(1.0, -1.0);
  return normalize(
    k.xyy * mapDistanceOnly(p + k.xyy * eps, mode) +
    k.yyx * mapDistanceOnly(p + k.yyx * eps, mode) +
    k.yxy * mapDistanceOnly(p + k.yxy * eps, mode) +
    k.xxx * mapDistanceOnly(p + k.xxx * eps, mode)
  );
}

// High-Clarity 5-Tap Ambient Occlusion (carves deep dark crevices so 3D folds pop)
float calcAO(vec3 pos, vec3 nor, int mode) {
  float occ = 0.0;
  float sca = 1.0;
  for (int i = 0; i < 5; i++) {
    float h = 0.018 + 0.095 * float(i) / 4.0;
    float d = mapFastLightingProxy(pos + h * nor, mode);
    occ += (h - d) * sca;
    sca *= 0.72;
  }
  return clamp(1.0 - 2.45 * occ, 0.14, 1.0);
}

// Soft Shadows with Early Exit
float softShadow(vec3 ro, vec3 rd, float mint, float maxt, int mode) {
  if (u_exportTurbo) return 0.88;
  float res = 1.0;
  float t = mint;
  for (int i = 0; i < 8; i++) {
    if (t >= maxt) break;
    float h = mapFastLightingProxy(ro + rd * t, mode);
    res = min(res, 8.0 * h / max(t, 1e-3));
    if (res < 0.003) break;
    t += clamp(h, 0.04, 0.35);
  }
  return clamp(res, 0.22, 1.0);
}

// Henyey-Greenstein Anisotropic Phase Function for Volumetric Cloud Rim Scattering
float phaseHG(float cosTheta, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * 3.14159265 * pow(max(1.0 + g2 - 2.0 * g * cosTheta, 1e-3), 1.5));
}

// Render 3D Raymarched Modes (Mode 0, 3, 4, 5, 6) with Over-Relaxed Sphere Tracing & Secant Refinement
vec3 render3DMode(vec2 uv, int mode) {
  vec3 ro;
  vec3 ta;
  float bpmSurge = sin(u_bpmPhase * 6.2831853) * 0.14 * u_audioIntensity;

  float dirSign = (abs(u_zoomDirection) < 0.05) ? 1.0 : u_zoomDirection;

  if (mode == 4) {
    // Mode 4: Infinite KIFS Wormhole Tunnel
    float zCam = 0.85 + (u_time * u_speed * 1.25 + u_bassCumulative * 1.65 + bpmSurge) * dirSign;
    ro = vec3(0.0, 0.0, zCam);
    ro.xy += wormholePath(ro.z) + u_cameraLateral * 0.22;
    ta = vec3(0.0, 0.0, zCam + 2.0 * sign(dirSign));
    ta.xy += wormholePath(ta.z) + u_cameraOrbit * 1.15 + vec2(0.28, 0.19);
  } else if (mode == 0 || mode == 5) {
    // Mode 0 (4D Tesseract) & Mode 5 (3D Mandelbulb): Orbital Hyperspace Camera
    float baseDist = (mode == 0) ? 2.45 : 2.15;
    float camDist = (baseDist - clamp(u_cameraZoom - 1.0, -0.7, 0.7) * dirSign) / max(0.84, u_juiceBounce * 0.92);
    float angX = u_cameraOrbit.x * 3.14 + u_time * 0.18 * dirSign;
    float angY = clamp(u_cameraOrbit.y * 1.4, -1.1, 1.1);
    ro = vec3(sin(angX) * cos(angY), sin(angY), cos(angX) * cos(angY)) * camDist;
    ta = vec3(u_cameraLateral * 0.25, 0.0);
  } else if (mode == 3) {
    // Mode 3: Fractal Genesis AI Procedural World Flight Camera
    float zWalk = 0.85 + (u_time * u_speed * 0.55 + u_bassCumulative * 0.85 + bpmSurge) * dirSign;
    ro = vec3(u_cameraLateral.x * 0.45, 0.28 + u_cameraLateral.y * 0.35 + sin(u_time * 0.5) * 0.08, zWalk);
    ta = ro + vec3(sin(u_cameraOrbit.x * 1.6), -0.08 + sin(u_cameraOrbit.y * 1.1), 1.8 * cos(u_cameraOrbit.x * 1.6));
  } else {
    // Mode 6: Apollonian & Kleinian Cathedral
    float zWalk = (u_time * u_speed * 0.55 + u_bassCumulative * 0.85 + bpmSurge) * dirSign;
    ro = vec3(u_cameraLateral.x * 0.2, u_cameraLateral.y * 0.2, zWalk);
    ta = ro + vec3(sin(u_cameraOrbit.x * 1.8 + 0.15), sin(u_cameraOrbit.y * 1.2 + 0.1), cos(u_cameraOrbit.x * 1.8));
  }

  vec3 cw = normalize(ta - ro);
  vec3 cp = vec3(sin(u_cameraRoll), cos(u_cameraRoll), 0.0);
  vec3 cu = normalize(cross(cw, cp));
  vec3 cv = normalize(cross(cu, cw));

  float baseFov = clamp(u_cameraFov, 0.55, 2.4);
  float fovScale = (baseFov - min(0.16, u_fractalSpike * 0.045)) / max(0.82, min(1.25, u_juiceBounce * 0.94));
  vec3 rd = normalize(uv.x * cu + uv.y * cv + fovScale * cw);

  float t = 0.02;
  float prevT = t;
  float prevD = 0.1;
  float maxDist = (mode == 0 || mode == 5) ? 5.8 : 13.5;
  float glowAccum = 0.0;
  vec4 hitInfo = vec4(0.0);
  vec2 hitTrapUV = vec2(0.0);
  bool hit = false;
  float relaxFactor = u_exportTurbo ? 1.32 : 1.28;

  for (int i = 0; i < 160; i++) {
    if (i >= u_maxSteps) break;
    vec3 p = ro + rd * t;
    vec2 stepTrapUV;
    vec4 res = mapMode(p, mode, stepTrapUV);
    float d = res.x;
    glowAccum += 1.0 / (1.0 + d * d * 42.0);

    // Distance-Scaled Adaptive Hit Threshold
    float eps = (u_gpuHeavyMode ? 0.0008 : 0.0012) * max(t, 1.0);
    if (d < eps) {
      // Analytical Secant Root-Finding Refinement when over-relaxed step overshoots inside surface
      if (d < 0.0 && i > 0) {
        t = prevT + (t - prevT) * clamp(prevD / max(prevD - d, 1e-4), 0.15, 0.85);
      }
      hit = true;
      hitInfo = res;
      hitTrapUV = stepTrapUV;
      break;
    }
    if (t > maxDist) break;
    prevT = t;
    prevD = d;
    t += max(d * relaxFactor, 0.0022);
  }

  // Cosmic / Atmospheric Sky Backdrop (with Solar Disc, Rayleigh Scattering & Volumetric Clouds in Mode 3)
  float radialAngle = atan(uv.y, uv.x);
  float spikeBurstRay = pow(abs(cos(radialAngle * 10.0 + u_time * 0.4)), 8.0) * min(0.35, u_fractalSpike * 0.14);
  float portalRing = exp(-abs(length(uv) - 0.38) * 5.5);
  vec3 bgCol = palette(
    length(uv) * 0.55 + radialAngle * 0.159 + u_time * 0.08,
    u_palA,
    u_palB,
    u_palC,
    u_palD
  ) * (0.14 + portalRing * 0.32 + spikeBurstRay);

  vec3 lightDir = normalize(vec3(0.65, 0.75, -0.45));

  if (mode == 3) {
    vec2 sunPos = vec2(0.0, 0.28 + sin(u_time * 0.15) * 0.08);
    float sunDist = length(uv - sunPos);
    float solarDisc = smoothstep(0.28 + u_bass * 0.06, 0.18, sunDist);
    float solarHalo = exp(-sunDist * 3.2) * (0.55 + u_kickTransient * 0.45);
    vec3 skyGrad = mix(
      palette(0.18 + u_time * 0.03, u_palA, u_palB, u_palC, u_palD) * 0.55,
      vec3(0.03, 0.06, 0.14),
      clamp(uv.y * 0.6 + 0.5, 0.0, 1.0)
    );
    bgCol = skyGrad + palette(0.05, u_palA, u_palB, u_palC, u_palD) * (solarDisc * 1.15 + solarHalo * 0.65);
  }

  vec3 col = bgCol;

  if (hit) {
    vec3 pos = ro + rd * t;
    vec3 nor = calcNormal(pos, mode);
    float clarityFactor = clamp(u_clarity, 0.15, 2.0);
    float ao = pow(calcAO(pos, nor, mode), max(0.35, clarityFactor));

    float sh = softShadow(pos + nor * 0.005, lightDir, 0.02, 3.2, mode);
    float diff = max(dot(nor, lightDir), 0.0) * sh;
    float backDiff = max(dot(nor, -lightDir), 0.0) * 0.28;
    float fresnel = pow(clamp(1.0 + dot(nor, rd), 0.0, 1.0), 3.5) * clarityFactor;

    float trapVal = hitInfo.y;
    float chaosDeriv = hitInfo.z;

    vec3 baseAlbedo = palette(
      trapVal * 1.35 + chaosDeriv * 0.5 + t * 0.06 + u_fractalSpike * 0.1,
      u_palA,
      u_palB,
      u_palC,
      u_palD
    );

    if (mode == 0) {
      // Thin-film iridescent hypercube edges for Mode 0
      vec3 irid = thinFilmIridescence(abs(dot(nor, rd)), chaosDeriv + u_time * 0.12);
      baseAlbedo = mix(baseAlbedo, irid, 0.38);
    }

    if (u_chaosMode || u_fractalSpike > 0.35) {
      float chaosFactor = smoothstep(0.22, 1.1, chaosDeriv + u_fractalSpike * 0.32);
      vec3 stableCool = vec3(0.06, 0.13, 0.28) + baseAlbedo * 0.42;
      vec3 chaoticNeon = palette(
        chaosDeriv * 1.25 + u_time * 0.2,
        vec3(0.55, 0.45, 0.5),
        vec3(0.45, 0.45, 0.45),
        vec3(1.0, 1.0, 0.5),
        vec3(0.0, 0.33, 0.67)
      ) * (1.25 + min(0.45, u_fractalSpike * 0.2));
      baseAlbedo = mix(
        baseAlbedo,
        mix(stableCool, chaoticNeon, chaosFactor),
        u_chaosMode ? 0.85 : clamp(u_fractalSpike * 0.35, 0.0, 0.75)
      );
    }

    // Custom Image / Logo Texture Sampling (Orbit Trap, 3D Triplanar, Both, or Zeno Droste)
    if (u_textureMappingMode != 3) {
      float effectiveMix = clamp(
        (u_hasTexture ? u_textureMix : u_textureMix * 0.35) * (0.5 + u_xyPad2.y * 0.8),
        0.0,
        1.0
      );
      if (effectiveMix > 0.01) {
        vec3 trapTexColor = sampleMultiImagePair(hitTrapUV).rgb;
        vec3 mappedTex = trapTexColor;
        if (u_textureMappingMode == 1) {
          mappedTex = sampleTriplanar(pos, nor);
        } else if (u_textureMappingMode == 2 && !u_exportTurbo) {
          mappedTex = mix(sampleTriplanar(pos, nor), trapTexColor, 0.5);
        } else if (u_textureMappingMode == 4) {
          mappedTex = sampleZenoDrosteTrap(hitTrapUV);
        }
        baseAlbedo = mix(baseAlbedo, mappedTex * 1.18, effectiveMix);
      }
    }

    float specExp = u_gpuHeavyMode ? 32.0 : 24.0;
    vec3 spec = pow(max(dot(reflect(-lightDir, nor), -rd), 0.0), specExp) * vec3(1.0, 0.92, 0.78) * sh;
    vec3 rimCol = palette(trapVal + 0.35, u_palA, u_palB, u_palC, u_palD) *
                  fresnel * (0.75 + u_presence * 0.85 + u_hiHatSparkle * 0.55 + min(0.6, u_fractalSpike * 0.25));

    col = baseAlbedo * (0.28 + diff * 0.88 + backDiff) * ao + spec * 0.55 + rimCol * ao;

    // 3D Beat Shockwave Rings (expanding spherical light wave along surface on kicks)
    if (u_beatShockwave) {
      float ringRadius = fract(u_bpmPhase + u_time * 0.65) * 6.5;
      float ringBand = exp(-abs(t - ringRadius) * 4.5) * (0.35 + u_kickTransient * 1.45);
      vec3 shockCol = palette(t * 0.22 + 0.5, u_palA, u_palB, u_palC, u_palD) * 1.35;
      col += shockCol * ringBand * ao;
    }

    float fog = exp(-0.028 * t * t);
    col = mix(bgCol, col, fog);
  }

  // Layer 5 (Mode 3): Beer-Lambert Volumetric FBM Clouds, Anisotropic Scattering & Lightning Flashes
  if (mode == 3 && u_cloudDensity > 0.01 && !u_exportTurbo) {
    float cloudTransmittance = 1.0;
    vec3 cloudLight = vec3(0.0);
    float maxCloudT = hit ? min(t, 8.5) : 8.5;
    float dtCloud = maxCloudT / 4.0;
    float hgPhase = phaseHG(dot(rd, lightDir), 0.45);
    float lightningBurst = (u_kickTransient * 0.65 + u_snareTransient * 0.85) * smoothstep(0.25, 1.0, u_audioIntensity);
    vec3 sunTint = palette(0.08 + u_time * 0.04, u_palA, u_palB, u_palC, u_palD) * (1.25 + hgPhase * 0.65);
    vec3 lightningTint = vec3(0.65, 0.85, 1.0) * lightningBurst * 1.6;

    for (int c = 0; c < 4; c++) {
      float tc = (float(c) + 0.5) * dtCloud;
      vec3 cp = ro + rd * tc;
      float heightMask = exp(-abs(cp.y - 0.72) * 2.2);
      float fbmC = fbmTerrain2D(cp.xz * 0.48 + vec2(u_time * 0.14, -u_time * 0.09));
      float density = max(0.0, fbmC + 0.25) * heightMask * u_cloudDensity * 0.55;
      if (density > 0.005) {
        float stepTrans = exp(-4.0 * density * dtCloud);
        vec3 stepScat = (sunTint + lightningTint) * (1.0 - stepTrans);
        cloudLight += cloudTransmittance * stepScat;
        cloudTransmittance *= stepTrans;
      }
    }
    col = col * cloudTransmittance + cloudLight;
  }

  // Controlled Volumetric Glow Aura
  float clampedGlow = min(glowAccum, 22.0);
  float kickFlare = 0.55 + u_audioIntensity * 0.45 + u_kickTransient * 0.75 + min(0.65, u_fractalSpike * 0.28);
  vec3 auraCol = palette(clampedGlow * 0.04 + u_time * 0.14, u_palA, u_palB, u_palC, u_palD);
  col += auraCol * (clampedGlow * 0.0095 * kickFlare);

  return col;
}

// ============================================================================
// MODE 1: 4D ULTRA-PSYCHEDELIC VISIONARY DMT / HYPERBOLIC KALEIDOSCOPE
// ============================================================================
vec3 renderMode1_DmtKaleidoscope(vec2 uv, vec2 rawUv) {
  // Radial breathing locked to BPM sawtooth phase
  float bpmBreath = 1.0 - 0.14 * sin(u_bpmPhase * 6.2831853) - u_kickTransient * 0.12;
  vec2 p = uv * bpmBreath;
  p *= rotate2D(u_cameraRoll + u_time * 0.16 + u_midCumulative * 0.25);

  // Hyperbolic Poincaré Disk & Log-Polar Space Folding
  float r = length(p);
  float a = atan(p.y, p.x);
  float slices = max(6.0, u_kaleidoSlices > 1.5 ? u_kaleidoSlices : 12.0);
  float sector = 6.2831853 / slices;
  a = mod(a + u_mirrorPhase * 0.392699, sector);
  a = abs(a - 0.5 * sector);

  float dirSign = (abs(u_zoomDirection) < 0.05) ? 1.0 : u_zoomDirection;
  float logR = log(max(r, 0.04)) - (u_time * u_speed * 0.55 + u_bassCumulative * 0.75) * dirSign;
  vec2 hyperUv = vec2(cos(a * slices * 0.25), sin(a * slices * 0.25)) * fract(logR * 0.45);

  // 4D Quaternion Julia Slicing (q = q^2 + c4D)
  vec4 q = vec4(hyperUv * 1.45, sin(logR) * 0.45, cos(u_rot4dXW + u_time * 0.4) * 0.35);
  vec4 c4 = vec4(
    -0.68 + u_xyPad1.x * 0.32 + sin(u_rot4dYW + u_time * 0.28) * 0.12,
    0.26 + u_xyPad1.y * 0.32 + cos(u_rot4dZW + u_time * 0.22) * 0.12,
    0.15 * sin(u_midCumulative * 0.8),
    0.12 * cos(u_bassCumulative * 0.8)
  );

  float minTrap = 1e10;
  vec2 trapUV = vec2(0.0);
  float lyapunov = 0.0;
  int maxIter = clamp(u_iterationDetail, 5, 14);

  for (int i = 0; i < 14; i++) {
    if (i >= maxIter) break;
    // Quaternion squaring: (q.x^2 - |q.yzw|^2, 2*q.x*q.yzw)
    vec3 v = q.yzw;
    q = vec4(q.x * q.x - dot(v, v), 2.0 * q.x * v) + c4;
    q.xy = abs(q.xy) - vec2(0.18 + u_fractalSpike * 0.04);

    float d = length(q.xy);
    lyapunov += exp(-d * 4.5);
    if (d < minTrap) {
      minTrap = d;
      trapUV = q.xy * u_trapScale;
    }
    if (dot(q, q) > 16.0) break;
  }

  vec3 dmtColor = palette(
    lyapunov * 0.22 + minTrap * 0.9 + r * 0.35 + u_time * 0.18,
    u_palA,
    u_palB,
    u_palC,
    u_palD
  );

  vec3 irid = thinFilmIridescence(cos(minTrap * 4.0 + r * 2.5), u_pitchHue + u_time * 0.25);
  dmtColor = mix(dmtColor, irid * 1.25, 0.42 + u_hiHatSparkle * 0.25);

  if (u_hasTexture && u_textureMappingMode != 3) {
    vec3 texCol = texture2D(u_userTexture, correctUV(trapUV)).rgb;
    dmtColor = mix(dmtColor, texCol * 1.2, clamp(u_textureMix, 0.0, 1.0) * 0.65);
  }

  // Blend with optical ping-pong feedback trail for visionary persistence
  vec2 fbUv = clamp((rawUv - 0.5) * (0.988 - u_kickTransient * 0.015) + 0.5, 0.002, 0.998);
  vec3 prev = texture2D(u_prevFrame, fbUv).rgb;
  float trailAmt = clamp(u_feedbackTrail * 0.55, 0.15, 0.68);
  return mix(dmtColor * (0.85 + u_kickTransient * 0.55), prev, trailAmt);
}

// ============================================================================
// MODE 2: "BASS NATION" / TRAP EMBLEM REACTOR & 3D PARTICLE SHOCKWAVE
// ============================================================================
float sampleSpectrumBarEnergy(float normAngle) {
  // Synthesize a high-precision mirrored 64/128-band spectrum from the 7 live DSP bands + harmonic partials
  float mirrored = abs(normAngle * 2.0 - 1.0); // 0.0 (Bottom/Top Sub-Bass) -> 1.0 (Sides Brilliance)
  float bandVal = 0.0;
  if (mirrored < 0.16) {
    bandVal = mix(u_subBass, u_bass, mirrored / 0.16);
  } else if (mirrored < 0.33) {
    bandVal = mix(u_bass, u_lowMid, (mirrored - 0.16) / 0.17);
  } else if (mirrored < 0.50) {
    bandVal = mix(u_lowMid, u_mid, (mirrored - 0.33) / 0.17);
  } else if (mirrored < 0.67) {
    bandVal = mix(u_mid, u_upperMid, (mirrored - 0.50) / 0.17);
  } else if (mirrored < 0.84) {
    bandVal = mix(u_upperMid, u_presence, (mirrored - 0.67) / 0.17);
  } else {
    bandVal = mix(u_presence, u_brilliance, (mirrored - 0.84) / 0.16);
  }

  float harmonicComb = 0.72 + 0.28 * sin(mirrored * 48.0 + u_time * 9.0 + u_bassCumulative * 4.0);
  return clamp(bandVal * harmonicComb + u_kickTransient * (1.0 - mirrored * 0.65) * 0.38, 0.02, 1.35);
}

vec4 computeBassEmblemAndSpectrumLayer(vec2 uv) {
  // Sub-Bass damped spring directional camera shake
  float shakeAmp = (u_subBass * 0.032 + u_kickTransient * 0.045) * u_cameraShake;
  vec2 shakeOffset = vec2(
    sin(u_time * 41.0) * shakeAmp,
    cos(u_time * 37.0) * shakeAmp
  );
  vec2 p = uv + shakeOffset;

  float baseRadius = clamp(u_emblemSize, 0.18, 0.68) * (1.0 + u_subBass * 0.14 + u_kickTransient * 0.18 * u_imageBeatPulse);
  float r = length(p);
  float angle = atan(p.y, p.x);
  float normAngle = (angle + 3.14159265) / 6.2831853;

  // Quantize angle into u_spectrumBars (32, 64, or 128 bars)
  float barCount = clamp(u_spectrumBars, 16.0, 128.0);
  float barIndex = floor(normAngle * barCount);
  float barLocal = fract(normAngle * barCount);
  float barMask = smoothstep(0.08, 0.22, barLocal) * (1.0 - smoothstep(0.78, 0.92, barLocal));

  float barEnergy = sampleSpectrumBarEnergy((barIndex + 0.5) / barCount);
  float barLength = barEnergy * (0.28 + u_fractalSpike * 0.08);
  float barStart = baseRadius + 0.025;
  float barEnd = barStart + barLength;

  vec3 accumCol = vec3(0.0);
  float accumAlpha = 0.0;

  // 1) Polar Spectrum Bars + Peak-Hold Caps
  if (r >= barStart && r <= barEnd + 0.04) {
    float inBar = step(barStart, r) * (1.0 - smoothstep(barEnd - 0.008, barEnd + 0.008, r)) * barMask;
    float peakPos = barEnd + 0.018;
    float peakCap = exp(-abs(r - peakPos) * 140.0) * barMask;
    vec3 barCol = palette(
      (r - barStart) * 2.2 + normAngle * 0.5,
      u_palA,
      u_palB,
      u_palC,
      u_palD
    ) * (1.35 + u_kickTransient * 0.6);
    accumCol += barCol * (inBar + peakCap * 1.4);
    accumAlpha = max(accumAlpha, clamp(inBar + peakCap, 0.0, 1.0));
  }

  // 2) Glowing Neon Rim around the Medallion
  float rimDist = abs(r - baseRadius);
  float rimGlow = exp(-rimDist * 55.0) * (1.2 + u_kickTransient * 1.1);
  vec3 rimColor = palette(normAngle + u_time * 0.25, u_palA, u_palB, u_palC, u_palD) * rimGlow;
  accumCol += rimColor;
  accumAlpha = max(accumAlpha, clamp(rimGlow, 0.0, 1.0));

  // 3) Center Circular Medallion with User Uploaded Image/Logo
  if (r < baseRadius) {
    vec2 discUv = (p / max(baseRadius * 2.0, 1e-4));
    discUv *= rotate2D(u_time * u_imageSpinSpeed * 0.25);
    discUv.x *= u_textureAspect;
    // Sub-bass ripple distortion across the medallion
    float ripple = sin(r * 28.0 - u_time * 8.0) * 0.012 * u_kickTransient;
    vec3 imgCol = texture2D(u_userTexture, clamp(discUv + 0.5 + ripple, 0.01, 0.99)).rgb;
    float edgeVignette = smoothstep(baseRadius, baseRadius * 0.86, r);
    vec3 tinted = mix(
      palette(r * 1.5 + u_time * 0.1, u_palA, u_palB, u_palC, u_palD) * 0.4,
      imgCol * 1.12,
      u_hasTexture ? clamp(u_textureMix, 0.25, 1.0) : 0.85
    );
    accumCol = mix(accumCol, tinted * edgeVignette + rimColor * 0.6, 0.95);
    accumAlpha = 1.0;
  }

  // 4) Expanding Shockwave Rings on Sub-Bass Kicks
  for (int i = 0; i < 3; i++) {
    float wavePhase = fract(u_bpmPhase + float(i) * 0.333 + u_time * 0.35);
    float waveRad = baseRadius + wavePhase * 1.15;
    float waveRing = exp(-abs(r - waveRad) * 42.0) * (1.0 - wavePhase) * (0.45 + u_kickTransient * 1.25);
    accumCol += palette(wavePhase + 0.25, u_palA, u_palB, u_palC, u_palD) * waveRing;
    accumAlpha = max(accumAlpha, clamp(waveRing * 0.75, 0.0, 1.0));
  }

  return vec4(accumCol, accumAlpha);
}

vec3 renderMode2_BassNationReactor(vec2 uv) {
  // 1) 3D Volumetric Starfield & Particle Nebula Rushing Toward Viewer at Bass-Multiplied Velocity
  vec3 bg = vec3(0.02, 0.025, 0.05);
  float angle = atan(uv.y, uv.x);
  float dist = length(uv);
  bg += palette(dist * 0.4 - u_time * 0.15, u_palA, u_palB, u_palC, u_palD) *
        (0.12 + 0.18 * exp(-dist * 1.6) + u_subBass * 0.15);

  float rushZ = u_time * (0.85 + u_speed * 0.65) + u_bassCumulative * 1.85;
  for (int layer = 0; layer < 4; layer++) {
    float fl = float(layer);
    float depth = fract(fl * 0.25 - rushZ * 0.32);
    float scale = mix(14.0, 1.5, 1.0 - depth);
    vec2 gridUv = uv * scale * rotate2D(fl * 0.75 + u_time * 0.05);
    vec2 cellId = floor(gridUv);
    vec2 localUv = fract(gridUv) - 0.5;
    float h = fract(sin(dot(cellId + fl * 17.0, vec2(127.1, 311.7))) * 43758.5453);
    vec2 starOffset = (vec2(h, fract(h * 34.56)) - 0.5) * 0.65;
    float dStar = length(localUv - starOffset);
    float sparkle = (0.0045 / max(dStar * dStar, 0.0002)) * smoothstep(0.0, 0.2, depth) * (1.0 - depth);
    bg += palette(h + u_pitchHue, u_palA, u_palB, u_palC, u_palD) * sparkle * (0.55 + u_hiHatSparkle * 0.95);
  }

  // 2) Composite Center Bass Emblem, 64-Band Polar Spectrum Ring & Shockwaves
  vec4 emblemLayer = computeBassEmblemAndSpectrumLayer(uv);
  return mix(bg, bg * 0.25 + emblemLayer.rgb, emblemLayer.a);
}

// ============================================================================
// MODE 7: 2D HYPER-JULIA / BURNING SHIP FILIGREE WITH BITMAP ORBIT TRAPS
// ============================================================================
vec3 renderMode7_JuliaBurningShip(vec2 uv) {
  float zoom = exp(-clamp(u_cameraZoom - 1.0, -1.2, 1.8)) * 1.3 / max(0.82, u_juiceBounce * 0.92);
  vec2 z = uv * zoom;
  z *= rotate2D(u_cameraRoll + u_time * 0.08);
  z += u_cameraOrbit * 0.55 + u_cameraLateral * 0.3;

  vec2 juliaC = vec2(
    -0.72 + u_xyPad1.x * 0.38 + sin(u_time * 0.25) * 0.05 + u_mid * 0.09,
    0.27 + u_xyPad1.y * 0.38 + cos(u_time * 0.21) * 0.05 + u_brilliance * 0.09
  );

  float shipMorph = clamp(0.18 + u_fractalSpike * 0.32 + 0.35 * sin(u_time * 0.35 + u_snareTransient * 1.5), 0.0, 1.0);

  float minTrap = 1e10;
  vec2 minTrapUV = vec2(0.0);
  float dr = 1.0;
  int escapedIter = 0;
  bool escaped = false;
  int maxIter2D = clamp(u_iterationDetail * 5, 24, 72);

  for (int i = 0; i < 72; i++) {
    if (i >= maxIter2D) break;
    escapedIter = i;

    vec2 zMorphed = mix(z, abs(z), shipMorph * 0.65);
    dr = 2.0 * length(z) * dr + 1.0;

    z = vec2(
      zMorphed.x * zMorphed.x - zMorphed.y * zMorphed.y,
      2.0 * zMorphed.x * zMorphed.y
    ) + juliaC;

    float starSpike = min(abs(z.x), abs(z.y)) * (1.5 - min(0.85, u_fractalSpike * 0.35));
    float trapDist = min(length(z), starSpike);
    if (trapDist < minTrap) {
      minTrap = trapDist;
      minTrapUV = z * u_trapScale;
    }

    if (dot(z, z) > 256.0) {
      escaped = true;
      break;
    }
  }

  float smoothIter = 0.0;
  if (escaped) {
    float rLen = max(length(z), 2.001);
    smoothIter = (float(escapedIter) + 1.0 - log(log(rLen)) / log(2.0)) / 36.0;
  } else {
    smoothIter = clamp(minTrap * 0.9, 0.0, 1.0);
  }

  vec3 col = palette(smoothIter * 1.3 + minTrap * 0.4 + u_fractalSpike * 0.15, u_palA, u_palB, u_palC, u_palD) * 0.85;

  if (u_chaosMode || u_fractalSpike > 0.4) {
    float lyapunov = clamp(log(dr + 1.0) * 0.045, 0.0, 1.0);
    vec3 coolInterior = vec3(0.05, 0.11, 0.25);
    vec3 hotFilament = palette(
      lyapunov * 1.5 + u_time * 0.15,
      vec3(0.55, 0.45, 0.45),
      vec3(0.45, 0.45, 0.45),
      vec3(1.0, 1.0, 0.5),
      vec3(0.8, 0.9, 0.3)
    ) * (1.15 + min(0.35, u_fractalSpike * 0.2));
    col = mix(col, mix(coolInterior, hotFilament, smoothstep(0.12, 0.85, lyapunov)), u_chaosMode ? 0.9 : clamp(u_fractalSpike * 0.35, 0.0, 0.75));
  }

  if (u_hasTexture && u_textureMappingMode != 3) {
    vec3 orbitTrapColor = texture2D(u_userTexture, correctUV(minTrapUV)).rgb;
    float effectiveMix = clamp(u_textureMix * (0.5 + u_xyPad2.y * 0.8), 0.0, 1.0);
    col = mix(col, orbitTrapColor * 1.15, effectiveMix * (1.0 - smoothstep(0.0, 1.2, minTrap)));
  }

  float filament = exp(-minTrap * (5.2 - min(1.8, u_fractalSpike * 0.5))) * (0.45 + u_kickTransient * 0.85 + min(0.55, u_fractalSpike * 0.3));
  col += palette(minTrap + 0.45, u_palA, u_palB, u_palC, u_palD) * filament * 0.45;

  return col;
}

// ============================================================================
// MODE 8: LIQUID OPTICAL FEEDBACK & CYMATIC STANDING-WAVE SIMULATOR
// ============================================================================
vec3 renderMode8_CymaticFeedback(vec2 uv, vec2 rawUv) {
  vec2 centered = rawUv - 0.5;
  float r = length(centered);
  float angle = atan(centered.y, centered.x);

  float spikeWave = cos(angle * 10.0 + u_time * 2.0) * min(0.025, u_fractalSpike * 0.01);
  float zoomDecay = 0.992 - u_audioIntensity * 0.022 - u_kickTransient * 0.022 + spikeWave;
  float spin = (0.002 + u_mid * 0.024 + u_fractalSpike * 0.008) * (mod(u_mirrorPhase, 2.0) == 0.0 ? 1.0 : -1.0);

  vec2 warpedPolar = vec2(
    cos(angle + spin) * r * zoomDecay,
    sin(angle + spin) * r * zoomDecay
  );

  vec2 curl = vec2(
    sin(centered.y * 8.0 + u_time * 1.4 + u_xyPad1.x * 3.0),
    cos(centered.x * 8.0 - u_time * 1.2 + u_xyPad1.y * 3.0)
  ) * (0.001 + u_subBass * 0.007 + min(0.01, u_fractalSpike * 0.004));

  vec2 sampleUv = clamp(warpedPolar + 0.5 + curl, 0.002, 0.998);

  vec2 texel = 1.5 / max(u_resolution, vec2(1.0));
  vec3 prev = texture2D(u_prevFrame, sampleUv).rgb * 0.4;
  prev += texture2D(u_prevFrame, clamp(sampleUv + vec2(texel.x, 0.0), 0.0, 1.0)).rgb * 0.15;
  prev += texture2D(u_prevFrame, clamp(sampleUv - vec2(texel.x, 0.0), 0.0, 1.0)).rgb * 0.15;
  prev += texture2D(u_prevFrame, clamp(sampleUv + vec2(0.0, texel.y), 0.0, 1.0)).rgb * 0.15;
  prev += texture2D(u_prevFrame, clamp(sampleUv - vec2(0.0, texel.y), 0.0, 1.0)).rgb * 0.15;

  float hueAngle = 0.01 + u_presence * 0.07 + u_kickTransient * 0.1;
  vec3 k = vec3(0.57735);
  float cosA = cos(hueAngle);
  prev = prev * cosA + cross(k, prev) * sin(hueAngle) + k * dot(k, prev) * (1.0 - cosA);

  // Chladni Cymatic Standing-Wave Resonance Equation:
  // cos(n*pi*x)*cos(m*pi*y) - cos(m*pi*x)*cos(n*pi*y) = 0
  vec2 cp = uv * (1.35 - u_bass * 0.2);
  cp *= rotate2D(u_time * 0.12 + u_cameraOrbit.x);
  float nFreq = 3.0 + floor(u_bass * 4.0) + u_xyPad1.x * 2.5;
  float mFreq = 5.0 + floor(u_mid * 5.0) + u_xyPad1.y * 2.5;
  float chladni = cos(nFreq * 3.14159 * cp.x) * cos(mFreq * 3.14159 * cp.y) -
                  cos(mFreq * 3.14159 * cp.x) * cos(nFreq * 3.14159 * cp.y);
  float cymaticNode = exp(-abs(chladni) * (9.5 - min(4.0, u_fractalSpike * 1.5)));

  // Strange Attractor Ribbons
  vec2 p = uv * (1.45 - u_bass * 0.25);
  p *= rotate2D(u_time * 0.25 + u_cameraOrbit.x * 2.0);
  float attractorEnergy = cymaticNode * 1.85;
  vec2 sampleTrapUV = cp * u_trapScale;

  for (int i = 0; i < 6; i++) {
    p = abs(p) / clamp(dot(p, p), 0.32, 1.2) - vec2(0.76 + u_xyPad1.x * 0.25, 0.66 + u_xyPad1.y * 0.25);
    p *= rotate2D(0.48 + u_mid * 0.32 + u_fractalSpike * 0.06);
    float d = abs(p.x * p.y);
    attractorEnergy += exp(-d * (11.0 - min(3.5, u_fractalSpike * 1.1)));
    if (i == 2) {
      sampleTrapUV = p * u_trapScale;
    }
  }

  vec3 freshSeed = palette(
    attractorEnergy * 0.28 + u_time * 0.15,
    u_palA,
    u_palB,
    u_palC,
    u_palD
  ) * (attractorEnergy * (0.22 + u_audioIntensity * 0.18) * (0.9 + u_kickTransient * 0.75 + min(0.5, u_fractalSpike * 0.22)));

  if (u_hasTexture && u_textureMappingMode != 3) {
    vec3 trapTex = texture2D(u_userTexture, correctUV(sampleTrapUV)).rgb;
    float effectiveMix = clamp(u_textureMix * (0.5 + u_xyPad2.y * 0.8), 0.0, 1.0);
    freshSeed = mix(freshSeed, trapTex * attractorEnergy * 0.4, effectiveMix);
  }

  float trailDecay = clamp(u_feedbackTrail, 0.5, 0.94);
  vec3 combined = prev * trailDecay + freshSeed;
  return combined / (1.0 + combined * 0.32);
}

// ============================================================================
// MODE 9: ZENO'S PARADOX — INFINITE DICHOTOMY ZOOM, ESCHER-DROSTE SPIRAL
// & FROZEN ARROW TIME-SLICER
// ============================================================================
float evaluateZenoCoreSdf(vec3 p, float morphClock, out vec2 trapUV) {
  vec3 z = p;
  float scaleAcc = 1.0;
  float minTrap = 1e10;
  trapUV = p.xy;
  float fold = max(0.72, u_foldLimit - u_fractalSpike * 0.08);
  float kScale = 1.82 + u_bass * 0.22 + sin(morphClock * 0.65) * 0.12;
  int iters = clamp(u_iterationDetail - 3, 4, u_exportTurbo ? 5 : 7);

  for (int i = 0; i < 7; i++) {
    if (i >= iters) break;
    // Sierpinski + Mandelbox + Kleinian hybrid fold
    z = clamp(z, -fold, fold) * 2.0 - z;
    z = abs(z);
    if (z.x < z.y) z.xy = z.yx;
    if (z.y < z.z) z.yz = z.zy;
    float r2 = clamp(dot(z, z), 0.26, 1.05);
    z /= r2;
    scaleAcc /= r2;
    z = z * kScale - vec3(1.05 + u_xyPad1.x * 0.28, 0.92 + u_xyPad1.y * 0.28, 0.86 + u_kickTransient * 0.14);
    scaleAcc *= kScale;

    float td = length(z.xy);
    if (td < minTrap) {
      minTrap = td;
      trapUV = z.xy * u_trapScale;
    }
  }
  return (length(z) - 1.38) / max(scaleAcc, 1.0);
}

vec3 renderMode9_ZenosParadox(vec2 uv, vec2 rawUv) {
  // 4) Zeno's Flying Arrow Paradox (Stroboscopic Frozen-Instant Time-Slicing)
  float sliceHz = clamp(u_sliceHz, 2.0, 24.0);
  float arrowMix = clamp(
    u_arrowParadoxMix + u_snareTransient * 0.55 + u_hiHatSparkle * 0.35 + (u_xyPad2.x - 0.5) * 0.4,
    0.0,
    1.0
  );
  float frozenTime = floor(u_time * sliceHz) / sliceHz;
  float zenoClock = mix(u_time, frozenTime, arrowMix);

  // 1) Zeno's Dichotomy & Achilles Paradox: Complex Logarithmic Escher-Droste Space Folding
  vec2 steeredUv = (uv + u_cameraOrbit * 0.35) * rotate2D(u_cameraRoll);
  float r1 = 0.25;
  float r2 = 1.0;
  float scaleRatio = log(r2 / r1); // ln(4) = 2 * ln(2) dyadic halving octave
  float escherAngle = atan((scaleRatio * u_escherTwist) / 6.2831853);

  vec2 zLog = cLog(steeredUv + vec2(1e-4));
  vec2 spiralUnit = cExp(vec2(0.0, escherAngle)) * cos(escherAngle);
  zLog = cDiv(zLog, spiralUnit);

  // Perpetual halving zoom that never arrives at the core (steerable by u_zoomDirection)
  float dirSign = (abs(u_zoomDirection) < 0.05) ? 1.0 : u_zoomDirection;
  float zoomScroll = (zenoClock * max(0.15, u_zenoSpeed) + u_bassCumulative * 1.5) * dirSign;
  float octaveIndex = floor((zLog.x - zoomScroll) / scaleRatio);
  zLog.x = mod(zLog.x - zoomScroll, scaleRatio);
  vec2 drosteUv = cExp(zLog) * r1;

  // 2) 3D Dyadic Scale-Halving Raymarched Fractal Core (Seamless 2-Octave Bell-Curve Window)
  float fractPhase = fract(zenoClock * max(0.15, u_halvingRate) + u_bass * 0.35);
  float bellWeight = sin(fractPhase * 3.14159265); // 0 at octave boundary -> 1 at midpoint -> 0 at next boundary
  float dyadicScale = mix(exp2(fractPhase - 1.0), exp2(fractPhase), bellWeight);

  vec3 ro = vec3(u_cameraLateral * 0.2, -2.15 / max(0.5, u_cameraZoom));
  vec3 rd = normalize(vec3(drosteUv * 1.45, 1.15));

  float t = 0.05;
  float minDist = 1e5;
  int stepsTaken = 0;
  vec2 hitTrapUV = drosteUv;
  bool hit = false;
  int maxZenoSteps = clamp(u_maxSteps, 36, u_exportTurbo ? 56 : 84);

  for (int i = 0; i < 84; i++) {
    if (i >= maxZenoSteps) break;
    stepsTaken = i;
    vec3 p = ro + rd * t;
    p.xz *= rotate2D(zenoClock * 0.22 + octaveIndex * 0.45);
    p.yz *= rotate2D(zenoClock * 0.16 - octaveIndex * 0.35);

    vec2 stepTrap;
    float d = evaluateZenoCoreSdf(p * dyadicScale, zenoClock, stepTrap) / dyadicScale;

    minDist = min(minDist, max(d, 0.0005));
    hitTrapUV = stepTrap;

    float eps = 0.0012 * max(t, 1.0);
    if (d < eps) {
      hit = true;
      break;
    }
    if (t > 6.5) break;
    // Zeno sphere-tracing step: each step covers a fraction of remaining distance
    t += max(d * 0.92, 0.0025);
  }

  // 3) Zeno's Sphere-Tracing Asymptotic Horizon Glow (Infinite Boundary Aura)
  float stepDensity = float(stepsTaken) / float(max(maxZenoSteps, 1));
  float horizonAura = 1.0 / (1.0 + minDist * minDist * 40.0);
  vec3 horizonGlow = palette(
    stepDensity * 1.2 + horizonAura * 0.45 + u_time * 0.18 + octaveIndex * 0.15,
    u_palA,
    u_palB,
    u_palC,
    u_palD
  ) * (stepDensity * 1.15 + horizonAura * (0.45 + u_presence * 0.75 + u_brilliance * 0.65));

  // Ultraviolet / Gold thin-film shimmer along Zeno dichotomy rings
  float ringBoundary = exp(-abs(fract(zLog.x / scaleRatio) - 0.5) * 18.0);
  vec3 irid = thinFilmIridescence(stepDensity, u_pitchHue + u_time * 0.2);
  vec3 col = horizonGlow + irid * ringBoundary * (0.35 + u_kickTransient * 0.55);

  if (hit) {
    vec3 surfCol = palette(
      length(hitTrapUV) * 0.85 + t * 0.22 + octaveIndex * 0.25 + u_time * 0.15,
      u_palA,
      u_palB,
      u_palC,
      u_palD
    );
    col = mix(col, surfCol * (1.15 + stepDensity * 0.65), 0.78);
  }

  // 4) Arrow-Paradox Translucent Spatial "Chrono-Echoes" along the ray
  if (arrowMix > 0.04) {
    vec3 echoAccum = vec3(0.0);
    for (int e = 1; e <= 3; e++) {
      float fe = float(e);
      float sliceOffset = fe * (0.14 + u_snareTransient * 0.08);
      vec2 echoUv = cExp(vec2(mod(zLog.x - sliceOffset, scaleRatio), zLog.y + fe * 0.22)) * r1;
      float echoRing = exp(-abs(length(echoUv) - 0.48) * 12.0);
      vec3 echoCol = palette(
        fe * 0.28 + u_time * 0.35 + u_pitchHue,
        u_palA,
        u_palB,
        u_palC,
        u_palD
      );
      echoAccum += echoCol * echoRing * (0.42 / fe);
    }
    col += echoAccum * arrowMix * (1.0 + u_snareTransient * 0.8);
  }

  // Nested Picture-in-Picture-in-Picture Droste Orbit Trap for User Image/Logo
  if (u_hasTexture || u_textureMappingMode == 4) {
    vec3 drosteImg = texture2D(u_userTexture, correctUV(drosteUv * 1.4)).rgb;
    float pipFrame = smoothstep(0.22, 0.28, length(drosteUv)) * (1.0 - smoothstep(0.88, 0.96, length(drosteUv)));
    float mixAmt = clamp(u_textureMix * (u_hasTexture ? 0.75 : 0.45), 0.0, 0.9);
    col = mix(col, drosteImg * (1.1 + horizonAura * 0.35), mixAmt * pipFrame);
  }

  // Blend with optical feedback trails so color flows smoothly through frozen Arrow slices
  vec2 fbUv = clamp((rawUv - 0.5) * (0.986 - u_kickTransient * 0.012) + 0.5, 0.002, 0.998);
  vec3 prev = texture2D(u_prevFrame, fbUv).rgb;
  float fbMix = clamp(u_feedbackTrail * 0.48, 0.12, 0.62);
  return mix(col, prev, fbMix);
}

// ============================================================================
// MODE 10: AI IMAGE-TO-3D-FRACTAL CONVERTER & MULTI-IMAGE DEPTH-MORPH STUDIO
// Supports 4 Selectable 3D Conversion Styles (u_img3DStyle: 0..3):
//   Style 0: 3D Raymarched Fractal Relief & KIFS Canyon
//   Style 1: 3D Image-Mandelbulb & Quaternion Sculpture
//   Style 2: 3D Infinite Image Wormhole & Kleinian Cathedral
//   Style 3: 3D Volumetric Fractal Particle / Splat Nebula
// ============================================================================
vec3 renderMode10_MultiImage3DFractal(vec2 uv, vec2 rawUv) {
  float dirSign = (abs(u_zoomDirection) < 0.05) ? 1.0 : u_zoomDirection;
  float zoomScroll = (u_time * u_speed * 0.45 + u_bassCumulative * 0.95) * dirSign;

  // Steerable 3D perspective tilt + camera roll
  vec2 p = (uv + u_cameraOrbit * 0.45 + u_cameraLateral * 0.25) / max(0.45, u_cameraZoom);
  p *= rotate2D(u_cameraRoll + sin(u_time * 0.2) * 0.12);

  int foldIters = clamp(u_imgFractalIter, 1, 12);
  float depthScale = clamp(u_imageDepth3D * (1.0 + u_subBass * 0.55 + u_kickTransient * 0.65), 0.05, 2.0);
  float kAngle = max(0.18, u_kifsFoldAngle);

  // --------------------------------------------------------------------------
  // STYLE B (u_img3DStyle == 1): 3D IMAGE-MANDELBULB & QUATERNION SCULPTURE
  // Maps uploaded image color & alpha-depth directly into spherical triplex
  // iterations of a 3D Mandelbulb / 4D Quaternion Julia sculpture.
  // --------------------------------------------------------------------------
  if (u_img3DStyle == 1) {
    vec3 ro = vec3(u_cameraLateral * 0.2, -2.05 / max(0.5, u_cameraZoom));
    vec3 rd = normalize(vec3(p * 1.35, 1.15));
    float t = 0.1;
    vec4 hitImg = sampleMultiImagePair(p * u_trapScale);
    vec2 finalBulbTrapUv = p * u_trapScale;
    float hitGlow = 0.0;
    bool hit = false;
    float power = max(4.5, u_bulbPower + u_bass * 2.4 + hitImg.a * 1.8);

    for (int stepIdx = 0; stepIdx < 48; stepIdx++) {
      vec3 pos = ro + rd * t;
      pos.xz *= rotate2D(zoomScroll * 0.35 + u_cameraOrbit.x);
      pos.yz *= rotate2D(u_time * 0.18 + u_cameraOrbit.y);

      vec3 z = pos;
      float dr = 1.0;
      float r = 0.0;
      vec2 bulbTrapUv = pos.xy;
      int maxB = clamp(foldIters, 3, 7);
      for (int i = 0; i < 7; i++) {
        if (i >= maxB) break;
        r = length(z);
        if (r > 2.25) break;
        bulbTrapUv = z.xy * u_trapScale;
        float imgMod = (hitImg.a - 0.5) * cos(dot(bulbTrapUv, vec2(2.4, 2.1)));
        float theta = acos(clamp(z.z / max(r, 1e-5), -1.0, 1.0)) + imgMod * depthScale * 0.28;
        float phi = atan(z.y, z.x) + kAngle * 0.35;
        dr = pow(max(r, 1e-4), power - 1.0) * power * dr + 1.0;
        float zr = pow(max(r, 1e-4), power) * (1.0 + imgMod * depthScale * 0.22);
        theta *= power;
        phi *= power;
        z = zr * vec3(sin(theta) * cos(phi), sin(phi) * sin(theta), cos(theta)) + pos * 0.88;
      }
      float de = (0.5 * log(max(r, 1.0001)) * r / max(dr, 1e-4)) * 0.82;
      hitGlow += 0.018 / (0.02 + abs(de) * 14.0);
      if (de < 0.0025 * max(t, 1.0)) {
        hit = true;
        finalBulbTrapUv = bulbTrapUv;
        break;
      }
      if (t > 4.5) break;
      t += max(de, 0.012);
    }

    if (hit) {
      hitImg = sampleMultiImagePair(finalBulbTrapUv);
    }

    vec3 auraCol = palette(hitGlow * 0.32 + u_time * 0.15, u_palA, u_palB, u_palC, u_palD);
    vec3 sculptCol = mix(
      auraCol * hitGlow * 0.85,
      hitImg.rgb * (0.75 + hitGlow * 0.65) + auraCol * (0.28 + u_kickTransient * 0.55),
      hit ? clamp(u_textureMix, 0.25, 1.0) : clamp(u_textureMix * 0.65, 0.15, 0.85)
    );
    vec2 fbUv1 = clamp((rawUv - 0.5) * 0.99 + 0.5, 0.002, 0.998);
    return mix(sculptCol, texture2D(u_prevFrame, fbUv1).rgb, clamp(u_feedbackTrail * 0.35, 0.08, 0.48));
  }

  // --------------------------------------------------------------------------
  // STYLE C (u_img3DStyle == 2): 3D INFINITE IMAGE WORMHOLE & KLEINIAN CATHEDRAL
  // Wraps and carves the uploaded image into the 3D walls of an infinite curved
  // wormhole tunnel with 3D triplanar projection & neon kick/snare edge veins.
  // --------------------------------------------------------------------------
  if (u_img3DStyle == 2) {
    float radius = max(0.08, length(p));
    float angle = atan(p.y, p.x) + zoomScroll * 0.25 + sin(1.0 / radius + zoomScroll) * 0.18 * u_tunnelCurvature;
    float tunnelDepthZ = (1.15 / radius) + zoomScroll * 1.65;

    vec2 wormholeUv = vec2(angle / 3.14159265, tunnelDepthZ * 0.35) * u_trapScale;
    // Apply Kleinian box-fold along the wormhole walls
    vec2 kFold = wormholeUv;
    for (int i = 0; i < 6; i++) {
      if (i >= clamp(foldIters, 1, 6)) break;
      kFold = clamp(kFold, -0.85, 0.85) * 2.0 - kFold;
      kFold *= rotate2D(kAngle * 0.45 + u_mid * 0.15);
    }

    vec4 wallImg = sampleMultiImagePair(mix(wormholeUv, kFold, 0.55));
    float epsW = 0.009;
    float edgeX = abs(sampleMultiImagePair(kFold + vec2(epsW, 0.0)).a - sampleMultiImagePair(kFold - vec2(epsW, 0.0)).a);
    float edgeY = abs(sampleMultiImagePair(kFold + vec2(0.0, epsW)).a - sampleMultiImagePair(kFold - vec2(0.0, epsW)).a);
    float neonEdges = clamp((edgeX + edgeY) * 4.5, 0.0, 1.5);

    float wallRelief = 0.45 + wallImg.a * depthScale * 0.85;
    float fogAtten = exp(-0.18 / max(radius, 0.04));
    vec3 veinCol = palette(tunnelDepthZ * 0.15 + neonEdges + u_pitchHue, u_palA, u_palB, u_palC, u_palD);
    vec3 tunnelCol = wallImg.rgb * wallRelief * (0.45 + 0.75 * fogAtten) +
                     veinCol * neonEdges * (0.75 + u_kickTransient * 1.15 + u_snareTransient * 0.85);
    vec3 finalWormhole = mix(veinCol * wallRelief, tunnelCol, clamp(u_textureMix, 0.2, 1.0));
    vec2 fbUv2 = clamp((rawUv - 0.5) * 0.988 + 0.5, 0.002, 0.998);
    return mix(finalWormhole, texture2D(u_prevFrame, fbUv2).rgb, clamp(u_feedbackTrail * 0.36, 0.08, 0.5));
  }

  // --------------------------------------------------------------------------
  // STYLE D (u_img3DStyle == 3): 3D VOLUMETRIC FRACTAL PARTICLE / SPLAT NEBULA
  // Transforms the uploaded image into a 3D volumetric Gaussian-splat point
  // cloud where image-colored fractal particles explode on bass drops and swirl.
  // --------------------------------------------------------------------------
  if (u_img3DStyle == 3) {
    vec3 particleAccum = vec3(0.0);
    float totalWeight = 0.0;
    float burst = 1.0 + (u_kickTransient * 0.55 + u_subBass * 0.42) * u_imageBeatPulse;

    for (int layer = 0; layer < 6; layer++) {
      float fl = float(layer);
      float zLayer = fract(fl * 0.1667 - zoomScroll * 0.22);
      float perspective = mix(0.38, 2.25, zLayer);
      vec2 layerUv = p * perspective * rotate2D(fl * kAngle * 0.35 + sin(u_time * 0.35 + fl) * 0.18);

      // Curl-noise vortex swirl
      layerUv += vec2(
        sin(layerUv.y * 4.5 + u_time * 1.2 + fl),
        cos(layerUv.x * 4.5 - u_time * 1.1 - fl)
      ) * (0.065 * u_morphTurbulence * burst);

      float gridRes = mix(28.0, 56.0, float(clamp(foldIters, 1, 10)) / 10.0);
      vec2 cellId = floor(layerUv * gridRes) / gridRes;
      vec2 cellLocal = fract(layerUv * gridRes) - 0.5;

      vec4 cellTex = sampleMultiImagePair(cellId * u_trapScale);
      float elevation = cellTex.a * depthScale;
      vec2 splatOffset = vec2(
        sin(elevation * 6.2831 + u_time * 1.6),
        cos(elevation * 6.2831 - u_time * 1.4)
      ) * (0.18 * burst);

      float dist2 = dot(cellLocal - splatOffset, cellLocal - splatOffset);
      float splatRadius = 0.065 + cellTex.a * 0.085 + u_hiHatSparkle * 0.04;
      float splat = exp(-dist2 / max(0.004, splatRadius * splatRadius));
      float depthFade = sin(zLayer * 3.14159265);

      vec3 palTint = palette(cellTex.a + fl * 0.15 + u_time * 0.12, u_palA, u_palB, u_palC, u_palD);
      vec3 particleCol = mix(palTint, cellTex.rgb * 1.35, clamp(u_textureMix, 0.2, 1.0));
      particleAccum += particleCol * splat * depthFade * (0.85 + elevation * 0.75);
      totalWeight += depthFade * 0.42;
    }

    vec3 nebulaCol = particleAccum / max(totalWeight, 0.65);
    vec2 fbUv3 = clamp((rawUv - 0.5) * 0.985 + 0.5, 0.002, 0.998);
    return mix(nebulaCol, texture2D(u_prevFrame, fbUv3).rgb, clamp(u_feedbackTrail * 0.44, 0.12, 0.58));
  }

  // --------------------------------------------------------------------------
  // STYLE A (u_img3DStyle == 0, Default): 3D RAYMARCHED FRACTAL RELIEF & KIFS CANYON
  // Extrudes the uploaded image into a deep 3D raymarched heightfield and
  // recursively folds 3D space using Kaleidoscopic IFS + Mandelbox folds.
  // --------------------------------------------------------------------------
  vec2 foldedUv = p;
  if (u_imageBlendMethod == 2) {
    // Escher-Droste Recursive Complex Log-Spiral Picture-in-Picture Folding
    float r1 = 0.24;
    float r2 = 1.0;
    float scaleRatio = log(r2 / r1);
    float twistAngle = atan((scaleRatio * u_escherTwist) / 6.2831853);
    vec2 zLog = cLog(p + vec2(1e-4));
    vec2 spiralUnit = cExp(vec2(0.0, twistAngle)) * cos(twistAngle);
    zLog = cDiv(zLog, spiralUnit);
    zLog.x = mod(zLog.x - zoomScroll, scaleRatio);
    foldedUv = cExp(zLog) * r1 * 1.45;
  } else {
    // Recursive KIFS / Crystal / Kaleido space folding (controlled by u_imgFractalIter & u_kifsFoldAngle)
    float scaleAcc = 1.0;
    float foldBound = max(0.45, u_foldLimit * 0.72);
    for (int i = 0; i < 12; i++) {
      if (i >= foldIters) break;
      if (u_imageBlendMethod == 1) {
        // Crystal Voronoi / Facet Shatter Fold
        foldedUv = abs(foldedUv) - vec2(0.32 + u_kickTransient * 0.09, 0.28 + u_snareTransient * 0.08);
        foldedUv *= rotate2D(kAngle + float(i) * 0.25 + u_mid * 0.22);
      } else if (u_imageBlendMethod == 3) {
        // Kaleido Orbit-Trap Fold
        foldedUv = clamp(foldedUv, -foldBound, foldBound) * 2.0 - foldedUv;
        float r2 = clamp(dot(foldedUv, foldedUv), 0.28, 1.15);
        foldedUv /= r2;
        scaleAcc /= r2;
      } else {
        // Liquid FBM Organic KIFS Canyon Fold
        foldedUv = mix(foldedUv, abs(foldedUv) - vec2(0.22 * scaleAcc), 0.55);
        foldedUv *= rotate2D(kAngle * 0.28 * scaleAcc);
        foldedUv += vec2(
          sin(foldedUv.y * 3.2 + zoomScroll),
          cos(foldedUv.x * 3.2 - zoomScroll)
        ) * (0.08 * u_morphTurbulence);
      }
      scaleAcc *= 0.82;
    }
  }

  // 3D Parallax Heightfield Ray-Stepping using RGBA .a Synthesized Depth Channel
  vec3 viewRay = normalize(vec3(p * 0.85, -1.0));
  vec2 baseTraceUv = foldedUv * u_trapScale;
  vec2 traceUv = baseTraceUv;

  float currHeight = 1.0;
  float sampledDepth = 0.5;
  vec4 accumTex = vec4(0.0);
  bool foundParallaxHit = false;

  // 8-Step Uniform Parallax Occlusion Depth March (no divergent break inside texture2D loop)
  for (int s = 0; s < 8; s++) {
    float layerFraction = float(s) / 7.0;
    vec2 parallaxOffset = viewRay.xy * layerFraction * depthScale * 0.28;
    vec4 sTex = sampleMultiImagePair(baseTraceUv - parallaxOffset);
    if (!foundParallaxHit) {
      sampledDepth = sTex.a;
      accumTex = mix(accumTex, sTex, 0.35);
      if (sampledDepth >= 1.0 - layerFraction) {
        traceUv = baseTraceUv - parallaxOffset;
        currHeight = sampledDepth;
        accumTex = sTex;
        foundParallaxHit = true;
      }
    }
  }

  // Compute 3D Heightfield Surface Normal via Central Differences on the Depth Channel (.a)
  float eps = 0.008;
  float hL = sampleMultiImagePair(traceUv - vec2(eps, 0.0)).a;
  float hR = sampleMultiImagePair(traceUv + vec2(eps, 0.0)).a;
  float hD = sampleMultiImagePair(traceUv - vec2(0.0, eps)).a;
  float hU = sampleMultiImagePair(traceUv + vec2(0.0, eps)).a;
  vec3 surfNormal = normalize(vec3((hL - hR) * depthScale * 3.5, (hD - hU) * depthScale * 3.5, 1.0));

  vec3 lightDir = normalize(vec3(sin(u_time * 0.6) * 0.7, cos(u_time * 0.45) * 0.7, 0.85));
  float clarity3D = clamp(u_clarity, 0.25, 2.0);
  float diff = max(dot(surfNormal, lightDir), 0.0);
  float spec = pow(max(dot(reflect(-lightDir, surfNormal), vec3(0.0, 0.0, 1.0)), 0.0), 28.0) * clarity3D;
  float rim = pow(1.0 - max(surfNormal.z, 0.0), 3.2) * clarity3D;

  // Procedural Fractal Palette Aura blended with 3D Extruded Image Relief
  vec3 fractalAura = palette(
    currHeight * 1.2 + length(foldedUv) * 0.65 + u_time * 0.15,
    u_palA,
    u_palB,
    u_palC,
    u_palD
  );

  vec3 litImage3D = accumTex.rgb * (0.36 + diff * 0.92) +
                    spec * vec3(1.0, 0.95, 0.85) * (0.48 + u_hiHatSparkle * 0.6) +
                    fractalAura * rim * (0.68 + u_kickTransient * 0.85);

  // Blend between Original Image Relief and Deep Fractalized Sculpture using u_textureMix
  vec4 directPair = sampleMultiImagePair(p * 0.65);
  vec3 finalCol = mix(
    fractalAura * (0.65 + diff * 0.55),
    mix(directPair.rgb * 1.05, litImage3D * 1.15, clamp(float(foldIters) / 6.0, 0.25, 1.0)),
    clamp(u_textureMix, 0.15, 1.0)
  );

  // Subtle optical feedback trail for silky transitions between images
  vec2 fbUv = clamp((rawUv - 0.5) * (0.99 - u_kickTransient * 0.01) + 0.5, 0.002, 0.998);
  vec3 prev = texture2D(u_prevFrame, fbUv).rgb;
  return mix(finalCol, prev, clamp(u_feedbackTrail * 0.38, 0.08, 0.52));
}

// ============================================================================
// PERCEPTUAL OKLAB COLOR HELPER (Used by Mode 11 & Visionary Shaders)
// ============================================================================
vec3 oklabToLinearSrgb(vec3 lab) {
  float l_ = lab.x + 0.3963377774 * lab.y + 0.2158037573 * lab.z;
  float m_ = lab.x - 0.1055613458 * lab.y - 0.0638541728 * lab.z;
  float s_ = lab.x - 0.0894841775 * lab.y - 1.2914855480 * lab.z;
  float l = l_ * l_ * l_;
  float m = m_ * m_ * m_;
  float s = s_ * s_ * s_;
  return clamp(
    vec3(
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    ),
    0.0,
    1.6
  );
}

// ============================================================================
// MODE 11: KLÜVER CORTICAL FORM CONSTANTS & V1 HALLUCINATION ENGINE
// Bressloff-Cowan V1 Turing wave lattices mapped through Schwartz Complex-Logarithmic
// Retino-Cortical Transform + Crystallographic Plane Group Symmetry Lens
// ============================================================================
vec3 renderMode11_KluverCorticalV1(vec2 uv, vec2 rawUv) {
  float dirSign = (abs(u_zoomDirection) < 0.05) ? 1.0 : u_zoomDirection;
  float flowT = (u_time * u_speed * 0.65 + u_bassCumulative * 0.85) * dirSign;

  vec2 p = (uv + u_cameraOrbit * 0.35) / max(0.45, u_cameraZoom);
  p *= rotate2D(u_cameraRoll + u_time * 0.12);

  // Schwartz Complex-Logarithmic Retino-Cortical Transform (Retina -> V1 Cortex)
  float r = length(p) + 1e-4;
  float theta = atan(p.y, p.x);
  float corticalFreq = clamp(u_bulbPower * 0.65, 2.5, 11.0);
  float spiralAngle = (u_escherTwist - 1.0) * 1.15 + u_xyPad1.x * 0.85;

  vec2 v1 = vec2(log(r) * corticalFreq - flowT * 1.35, theta * corticalFreq);
  v1 *= rotate2D(spiralAngle);

  // Wallpaper Symmetry Lens selector (u_polychoraType: 0=pmm, 1=p4m, 2=p6m, 3=chiral p6)
  int symGroup = clamp(u_polychoraType, 0, 3);
  vec2 w = v1;
  if (symGroup == 0) {
    // pmm: Rectangular bilateral mirror lattice
    w = abs(fract(v1 * 0.35) - 0.5) * 6.2831853;
  } else if (symGroup == 1) {
    // p4m: 4-fold square diagonal mirror fold
    w = abs(fract(v1 * 0.32) - 0.5) * 6.2831853;
    if (w.x < w.y) w.xy = w.yx;
  } else if (symGroup == 2) {
    // p6m: Hexagonal 6-fold crystallographic plane group
    vec2 h1 = vec2(1.0, 0.0);
    vec2 h2 = vec2(0.5, 0.8660254);
    vec2 h3 = vec2(-0.5, 0.8660254);
    w = vec2(
      cos(dot(v1, h1)) + cos(dot(v1, h2)) + cos(dot(v1, h3)),
      sin(dot(v1, h1)) - sin(dot(v1, h2)) + sin(dot(v1, h3))
    ) * 1.85;
  } else {
    // Chiral p6: Rotating pinwheel hexagonal waves
    float chiralSpin = u_time * 0.45 + u_midCumulative * 0.55;
    w = v1 * rotate2D(chiralSpin * 0.25);
    w += 0.45 * vec2(sin(w.y * 1.5 + chiralSpin), cos(w.x * 1.5 - chiralSpin));
  }

  // Bressloff-Cowan Cortical Turing Wave Lattice (3 wavevectors at 0, 60, 120 deg)
  vec2 k1 = vec2(1.0, 0.0);
  vec2 k2 = vec2(-0.5, 0.8660254);
  vec2 k3 = vec2(-0.5, -0.8660254);

  float turingHex = cos(dot(w, k1) + u_bass * 1.4) +
                    cos(dot(w, k2) + u_mid * 1.4) +
                    cos(dot(w, k3) - u_presence * 1.4);

  // Cobweb & Funnel interference harmonics
  float cobweb = sin(v1.x * 1.5 + sin(v1.y * 2.0 + flowT)) * cos(v1.y * 1.5 - cos(v1.x * 2.0));
  float pattern = mix(turingHex / 3.0, cobweb, clamp(0.35 + u_xyPad1.y * 0.45, 0.05, 0.95));
  float ridge = exp(-abs(pattern) * (5.5 - min(2.5, u_fractalSpike * 0.8))) * (1.0 + u_kickTransient * 0.75);

  // Perceptual OKLab color synthesis blended with active studio palette
  float chromaAmp = clamp(0.18 + u_transcendence * 0.14 + u_bass * 0.08, 0.08, 0.34);
  float huePhase = pattern * 3.14159 + u_pitchHue * 6.28318 + u_time * 0.35;
  vec3 oklabCol = oklabToLinearSrgb(vec3(
    clamp(0.58 + pattern * 0.28 + ridge * 0.22, 0.15, 0.98),
    chromaAmp * cos(huePhase),
    chromaAmp * sin(huePhase)
  ));

  vec3 palCol = palette(pattern * 0.65 + log(r) * 0.25 + u_time * 0.15, u_palA, u_palB, u_palC, u_palD);
  vec3 col = mix(palCol, oklabCol, clamp(0.45 + u_transcendence * 0.45, 0.15, 0.92)) * (0.65 + ridge * 0.95);

  if (u_hasTexture && u_textureMappingMode != 3) {
    vec2 cortexUv = fract(v1 * 0.15 * u_trapScale);
    vec3 texCol = sampleMultiImagePair(cortexUv).rgb;
    col = mix(col, texCol * (0.8 + ridge * 0.6), clamp(u_textureMix, 0.0, 0.85));
  }

  vec2 fbUv = clamp((rawUv - 0.5) * (0.988 - u_kickTransient * 0.012) + 0.5, 0.002, 0.998);
  return mix(col, texture2D(u_prevFrame, fbUv).rgb, clamp(u_feedbackTrail * 0.45, 0.08, 0.62));
}

// ============================================================================
// MODE 12: NON-EUCLIDEAN CURVED SPACES (HYPERBOLIC H3, NIL & SOL GEOMETRIES)
// Sub-Modes via u_polychoraType:
//   0: Hyperbolic H3 Dodecahedral Hall (r(t) = p*cosh(t) + v*sinh(t))
//   1: Nil Heisenberg Twisted Space
//   2: Sol Anisotropic Exponential Warp (scale(exp(z), exp(-z), 1))
// ============================================================================
vec3 renderMode12_NonEuclideanSpaces(vec2 uv, vec2 rawUv) {
  int geomType = clamp(u_polychoraType, 0, 2);
  float dirSign = (abs(u_zoomDirection) < 0.05) ? 1.0 : u_zoomDirection;
  float travel = (u_time * u_speed * 0.55 + u_bassCumulative * 0.65) * dirSign;

  vec2 p = (uv + u_cameraOrbit * 0.35) / max(0.5, u_cameraZoom);
  p *= rotate2D(u_cameraRoll + u_time * 0.07);

  vec3 ro = vec3(u_cameraLateral * 0.18, travel);
  vec3 rd = normalize(vec3(p * clamp(u_cameraFov, 0.65, 2.2), 1.25));

  float curvatureK = clamp(u_kleinianScale * 0.75 + u_bass * 0.25, 0.45, 1.85);
  float portalOpen = clamp(u_foldLimit * 0.55, 0.32, 0.88);
  float twistRate = (u_tunnelCurvature + 0.65) * (1.0 + u_mid * 0.55);

  float t = 0.04;
  float glow = 0.0;
  float hitTrap = 0.0;
  vec3 hitPos = vec3(0.0);
  bool hit = false;
  int maxSteps = clamp(u_maxSteps, 36, u_exportTurbo ? 52 : 76);

  for (int i = 0; i < 76; i++) {
    if (i >= maxSteps) break;
    vec3 pos;
    if (geomType == 0) {
      // Hyperbolic H3 geodesic projection along hyperboloid sheet: r(t) = p*cosh(k*t) + v*sinh(k*t)
      float kt = t * curvatureK * 0.42;
      float ch = 0.5 * (exp(kt) + exp(-kt));
      float sh = 0.5 * (exp(kt) - exp(-kt));
      pos = ro * ch + rd * (sh / max(curvatureK * 0.42, 0.15));
      // Golden-ratio dodecahedral reflection folding
      pos = mod(pos + 1.25, 2.5) - 1.25;
      pos = abs(pos);
      if (pos.x < pos.y) pos.xy = pos.yx;
      if (pos.y < pos.z) pos.yz = pos.zy;
    } else if (geomType == 1) {
      // Nil Heisenberg Group geometry: helical curved ray twist proportional to z
      pos = ro + rd * t;
      float nilAngle = pos.z * twistRate * 0.55 + 0.5 * pos.x * pos.y * curvatureK;
      pos.xy *= rotate2D(nilAngle);
      pos = mod(pos + 1.1, 2.2) - 1.1;
      pos = abs(pos);
    } else {
      // Sol Thurston Geometry: anisotropic metric ds^2 = e^(2z)dx^2 + e^(-2z)dy^2 + dz^2
      pos = ro + rd * t;
      float zCell = mod(pos.z + 1.0, 2.0) - 1.0;
      float expZ = exp(clamp(zCell * curvatureK * 0.65, -1.6, 1.6));
      pos.x *= expZ;
      pos.y /= max(expZ, 0.15);
      pos = mod(pos + 1.15, 2.3) - 1.15;
      pos = abs(pos);
    }

    // Hollow Non-Euclidean Cathedral Room with Carved Portal Arches
    float roomBox = max(pos.x, max(pos.y, pos.z)) - 0.95;
    float archPortal = min(length(pos.xy), min(length(pos.yz), length(pos.xz))) - (portalOpen + u_kickTransient * 0.06);
    float sphereOrb = length(pos - vec3(0.45)) - (0.16 + u_hiHatSparkle * 0.05);
    float d = min(max(-roomBox, -archPortal), sphereOrb) * 0.72;

    glow += 0.018 / (0.015 + d * d * 28.0);
    hitTrap = length(pos.xy) + pos.z * 0.35;

    if (d < 0.0018 * max(t, 1.0)) {
      hit = true;
      hitPos = pos;
      break;
    }
    if (t > 10.0) break;
    t += max(d, 0.012);
  }

  vec3 col = palette(glow * 0.18 + u_time * 0.12, u_palA, u_palB, u_palC, u_palD) * (glow * 0.45);
  if (hit) {
    float fog = exp(-0.035 * t * t);
    vec3 surfCol = palette(hitTrap * 0.85 + t * 0.1 + u_pitchHue, u_palA, u_palB, u_palC, u_palD);
    vec3 irid = thinFilmIridescence(cos(hitTrap * 3.0), u_time * 0.2);
    surfCol = mix(surfCol, irid * 1.25, 0.32);
    if (u_hasTexture && u_textureMappingMode != 3) {
      vec3 texCol = sampleMultiImagePair(hitPos.xy * u_trapScale).rgb;
      surfCol = mix(surfCol, texCol * 1.2, clamp(u_textureMix, 0.0, 0.85));
    }
    col = mix(col, surfCol * (0.75 + glow * 0.35 + u_kickTransient * 0.45), fog);
  }
  return col;
}

// ============================================================================
// MODE 13: INDRA'S PEARLS — KLEINIAN GROUP LIMIT SETS & MÖBIUS CIRCLE INVERSION
// Maskit's slice Kleinian folding + Möbius spherical inversion
// ============================================================================
vec3 renderMode13_IndrasPearls(vec2 uv, vec2 rawUv) {
  float dirSign = (abs(u_zoomDirection) < 0.05) ? 1.0 : u_zoomDirection;
  float scroll = (u_time * u_speed * 0.45 + u_bassCumulative * 0.55) * dirSign;

  vec2 p2 = (uv + u_cameraOrbit * 0.35) / max(0.45, u_cameraZoom);
  p2 *= rotate2D(u_cameraRoll + u_time * 0.08);

  vec3 ro = vec3(u_cameraLateral.x * 0.25, 0.35 + sin(u_time * 0.2) * 0.12, scroll);
  vec3 rd = normalize(vec3(p2 * 1.35, 1.2));

  float mobiusK = clamp(u_kleinianScale * 0.72 + u_bass * 0.08, 0.72, 1.45);
  float pearlRad = clamp(u_foldLimit * 0.85, 0.55, 1.25);
  int foldDepth = clamp(u_iterationDetail, 5, u_exportTurbo ? 7 : 10);

  float t = 0.05;
  float minOrbit = 1e5;
  float pearlAccum = 0.0;
  vec2 trapUv = p2;
  vec3 hitP = vec3(0.0);
  float hitScale = 1.0;
  bool hit = false;
  int maxSteps = clamp(u_maxSteps, 36, u_exportTurbo ? 54 : 80);

  for (int stepIdx = 0; stepIdx < 80; stepIdx++) {
    if (stepIdx >= maxSteps) break;
    vec3 p = ro + rd * t;
    float scale = 1.0;

    // Maskit Slice Kleinian Folding + Möbius Sphere Inversion
    for (int i = 0; i < 10; i++) {
      if (i >= foldDepth) break;
      p.xz = mod(p.xz + mobiusK, 2.0 * mobiusK) - mobiusK;
      p.y = abs(p.y) - 0.18 * pearlRad;
      float r2 = max(dot(p, p), 1e-4);
      float kInv = (pearlRad * (1.0 + 0.05 * sin(u_time + float(i)))) / r2;
      p *= kInv;
      scale *= abs(kInv);
    }

    float d = (length(p.y) - 0.32) / max(scale, 1.0) * 0.65;
    minOrbit = min(minOrbit, max(d, 0.001));
    pearlAccum += 0.016 / (0.012 + d * d * 45.0);

    if (d < 0.0012 * max(t, 1.0)) {
      hit = true;
      hitP = p;
      hitScale = log(max(scale, 1.0));
      trapUv = p.xz * u_trapScale;
      break;
    }
    if (t > 8.5) break;
    t += max(d, 0.008);
  }

  vec3 pearlCol = palette(hitScale * 0.18 + pearlAccum * 0.2 + u_time * 0.14, u_palA, u_palB, u_palC, u_palD);
  vec3 irid = thinFilmIridescence(cos(hitScale * 0.65 + t), u_pitchHue + u_time * 0.25);
  vec3 col = mix(pearlCol, irid * 1.35, 0.48) * (0.25 + pearlAccum * 0.62);

  if (hit) {
    float spec = pow(clamp(1.0 - minOrbit * 18.0, 0.0, 1.0), 3.0) * clamp(u_clarity, 0.4, 2.0);
    col += vec3(1.0, 0.96, 0.9) * spec * (0.55 + u_hiHatSparkle * 0.75 + u_kickTransient * 0.55);
    if (u_hasTexture && u_textureMappingMode != 3) {
      vec3 texCol = sampleMultiImagePair(trapUv).rgb;
      col = mix(col, texCol * 1.25, clamp(u_textureMix, 0.0, 0.85));
    }
  }

  vec2 fbUv = clamp((rawUv - 0.5) * 0.99 + 0.5, 0.002, 0.998);
  return mix(col, texture2D(u_prevFrame, fbUv).rgb, clamp(u_feedbackTrail * 0.34, 0.05, 0.48));
}

// ============================================================================
// MODE 14: HOPF FIBRATION & 4D POLYTWISTER FIBER FIELD
// Stereographic projection of 3-sphere S^3 in C^2 into linked Clifford tori & unit circles
// ============================================================================
vec3 renderMode14_HopfFibration4D(vec2 uv, vec2 rawUv) {
  float dirSign = (abs(u_zoomDirection) < 0.05) ? 1.0 : u_zoomDirection;
  float flow = (u_time * u_speed * 0.85 + u_bassCumulative * 1.15) * dirSign;

  vec2 p2 = (uv + u_cameraOrbit * 0.35) / max(0.45, u_cameraZoom);
  p2 *= rotate2D(u_cameraRoll + u_time * 0.1);

  vec3 ro = vec3(u_cameraLateral * 0.2, -2.65);
  vec3 rd = normalize(vec3(p2 * 1.35, 1.25));

  float fiberBundles = clamp(floor(u_bulbPower * 1.2), 4.0, 18.0);
  float torusRatio = clamp(u_foldLimit * 0.85 + u_bass * 0.15, 0.45, 1.45);
  float tubeRadius = 0.055 + u_kickTransient * 0.025;

  float t = 0.15;
  vec3 accumCol = vec3(0.0);
  int maxSteps = clamp(u_maxSteps, 32, u_exportTurbo ? 46 : 64);

  for (int i = 0; i < 64; i++) {
    if (i >= maxSteps) break;
    vec3 p = ro + rd * t;
    p.xz *= rotate2D(u_time * 0.22 + u_cameraOrbit.x);
    p.yz *= rotate2D(u_time * 0.16 + u_cameraOrbit.y);

    // Inverse Stereographic Projection R^3 -> S^3 subset of R^4
    float r2 = dot(p, p);
    float invDenom = 1.0 / (1.0 + r2);
    vec4 s3 = vec4(2.0 * p, (r2 - 1.0)) * invDenom;

    // 4D Hyperspace Rotations (XW, YW, ZW, XY, XZ, YZ)
    s3 = rotate4D(
      s3,
      u_rot4dXW + u_time * 0.25 + u_bassCumulative * 0.25,
      u_rot4dYW + u_time * 0.18 + u_midCumulative * 0.25,
      u_rot4dZW + u_time * 0.14,
      u_time * 0.08,
      u_time * 0.06,
      0.0
    );

    // Complex coordinates z1 = (s3.x, s3.y), z2 = (s3.z, s3.w) on S^3
    float absZ1 = length(s3.xy) + 1e-4;
    float absZ2 = length(s3.zw) + 1e-4;
    float eta = atan(absZ2, absZ1); // Clifford torus latitude [0, pi/2]
    float xi1 = atan(s3.y, s3.x);
    float xi2 = atan(s3.w, s3.z);

    // Base S^2 Hopf projection angles: baseTheta = 2*eta, basePhi = xi1 - xi2, fiberAngle = xi1 + xi2
    float baseTheta = 2.0 * eta * torusRatio;
    float basePhi = xi1 - xi2;
    float fiberPhase = xi1 + xi2 - flow * 1.4;

    // Distance to discrete linked Hopf fiber circles on nested Clifford tori
    float ringLattice = abs(sin(baseTheta * 3.0 + u_mid * 1.2));
    float bundleWave = abs(sin(basePhi * 0.5 * fiberBundles + baseTheta * 2.0));
    float dFiber = sqrt(ringLattice * ringLattice + bundleWave * bundleWave) * 0.22 - tubeRadius;

    // Glowing energy beads surging along the linked fibers in sync with BPM
    float beadPulse = 0.6 + 0.65 * pow(0.5 + 0.5 * sin(fiberPhase * 2.0 + u_bpmPhase * 6.28318), 4.0);
    float density = exp(-max(dFiber, 0.0) * 26.0) * beadPulse;

    vec3 fiberCol = palette(
      eta * 1.1 + basePhi * 0.159 + u_time * 0.15 + u_pitchHue,
      u_palA,
      u_palB,
      u_palC,
      u_palD
    );
    accumCol += fiberCol * density * 0.085 * (1.0 + u_kickTransient * 0.7);

    if (t > 5.4) break;
    t += max(abs(dFiber) * 0.55, 0.042);
  }

  vec3 irid = thinFilmIridescence(clamp(length(accumCol) * 0.5, 0.0, 1.0), u_time * 0.2);
  vec3 col = mix(accumCol, accumCol * 0.65 + irid * length(accumCol) * 0.55, 0.35);

  vec2 fbUv = clamp((rawUv - 0.5) * 0.988 + 0.5, 0.002, 0.998);
  return mix(col, texture2D(u_prevFrame, fbUv).rgb, clamp(u_feedbackTrail * 0.42, 0.08, 0.58));
}

// ============================================================================
// MODE 15: RELATIVISTIC BLACK HOLE (SCHWARZSCHILD GEODESIC LENSING & ACCRETION DISK)
// Null photon geodesic integration: d^2x/dt^2 = -1.5 * h^2 * x / r^5 + Doppler Beaming
// ============================================================================
vec3 renderMode15_RelativisticBlackHole(vec2 uv, vec2 rawUv) {
  vec2 p = (uv + u_cameraOrbit * 0.3) / max(0.45, u_cameraZoom);
  p *= rotate2D(u_cameraRoll);

  float tiltAngle = clamp(0.24 + (u_rot4dYW - 0.4) * 0.45 + sin(u_time * 0.18) * 0.08, 0.08, 1.15);
  vec3 camPos = vec3(0.0, sin(tiltAngle) * 10.5, -cos(tiltAngle) * 10.5);
  vec3 forward = normalize(-camPos);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
  vec3 up = cross(forward, right);
  vec3 vel = normalize(p.x * right + p.y * up + 1.45 * forward);

  vec3 pos = camPos;
  vec3 Lvec = cross(pos, vel);
  float h2 = dot(Lvec, Lvec);

  float rsMass = clamp(u_kleinianScale * 0.68 + u_subBass * 0.14 + u_kickTransient * 0.12, 0.65, 1.55);
  float dopplerBeta = clamp(0.45 + u_transcendence * 0.35, 0.15, 0.78);
  float diskOuter = clamp(7.5 + u_bulbPower * 0.35, 6.5, 12.0);
  float diskInner = 2.65 * rsMass;
  float spinTime = u_time * u_speed * 1.45 + u_bassCumulative * 1.8;

  vec3 diskAccum = vec3(0.0);
  float photonRingGlow = 0.0;
  bool swallowed = false;
  int maxGeoSteps = u_exportTurbo ? 46 : 64;

  for (int i = 0; i < 64; i++) {
    if (i >= maxGeoSteps) break;
    float r = length(pos);
    if (r < rsMass) {
      swallowed = true;
      break;
    }

    // Photon Ring amplification near r = 1.5 * rsMass
    float photonDist = abs(r - 1.5 * rsMass);
    photonRingGlow += exp(-photonDist * 14.0) * 0.045;

    float dt = clamp(0.14 * (r - 0.65 * rsMass), 0.028, 0.42);
    // Relativistic Schwarzschild geodesic deflection: a = -1.5 * rs * h^2 * pos / r^5
    float r5 = max(r * r * r * r * r, 1e-3);
    vec3 accel = -1.5 * rsMass * h2 * pos / r5;

    vec3 nextVel = normalize(vel + accel * dt);
    vec3 nextPos = pos + nextVel * dt;

    // Check equatorial Accretion Disk crossing (y changes sign or passes near y = 0)
    float slabDist = abs(nextPos.y);
    float radialR = length(nextPos.xz);
    if (slabDist < 0.34 && radialR > diskInner && radialR < diskOuter) {
      float radialNorm = (radialR - diskInner) / max(diskOuter - diskInner, 0.1);
      float diskAngle = atan(nextPos.z, nextPos.x);
      // Keplerian differential rotation omega ~ r^(-1.5)
      float keplerPhase = diskAngle + spinTime * pow(max(radialR, 1.0), -1.15) * 4.5;

      // Multi-octave FBM plasma rings inside accretion disk
      float spiralNoise = sin(radialR * 5.5 - keplerPhase * 2.0) * 0.5 +
                          0.5 * cos(radialR * 12.0 + keplerPhase * 3.0 + u_mid * 3.0);
      float ringProfile = sin(radialNorm * 3.14159265) * exp(-slabDist * 7.5);
      float gasDensity = max(0.0, (0.65 + 0.45 * spiralNoise)) * ringProfile;

      // Relativistic Doppler Beaming: approaching side is boosted by (1 + beta * cosTheta)^3
      vec3 orbitalDir = normalize(vec3(-nextPos.z, 0.0, nextPos.x));
      float cosTheta = dot(orbitalDir, -nextVel);
      float dopplerBoost = pow(clamp(1.0 + dopplerBeta * cosTheta, 0.28, 2.15), 3.0);

      // Blackbody spectral shift (blue-white inner core + approaching jet -> golden-orange receding outer disk)
      vec3 diskCol = palette(
        radialNorm * 0.75 - cosTheta * 0.25 + u_time * 0.08 + u_pitchHue,
        u_palA,
        u_palB,
        u_palC,
        u_palD
      );
      vec3 hotCore = vec3(1.0, 0.93, 0.82) * exp(-radialNorm * 3.2) * (1.2 + u_kickTransient * 0.9);
      diskAccum += (diskCol * 1.15 + hotCore) * gasDensity * dopplerBoost * 0.24;
    }

    pos = nextPos;
    vel = nextVel;
    if (r > 18.0 && i > 12) break;
  }

  // Gravitationally Lensed Background Starfield & Einstein Ring
  vec3 starCol = vec3(0.0);
  if (!swallowed) {
    vec2 skyUv = vec2(atan(vel.z, vel.x), asin(clamp(vel.y, -1.0, 1.0))) * 6.5;
    vec2 starCell = floor(skyUv);
    vec2 starLocal = fract(skyUv) - 0.5;
    float h = fract(sin(dot(starCell, vec2(127.1, 311.7))) * 43758.5453);
    float dStar = length(starLocal - (vec2(h, fract(h * 19.3)) - 0.5) * 0.6);
    float starBright = (0.0025 / max(dStar * dStar, 0.00015)) * step(0.55, h);
    starCol = palette(h + u_pitchHue, u_palA, u_palB, u_palC, u_palD) * starBright * (0.45 + u_hiHatSparkle * 0.8);
    if (u_hasTexture && u_textureMappingMode != 3) {
      vec3 lensedTex = sampleMultiImagePair(skyUv * 0.08 * u_trapScale).rgb;
      starCol = mix(starCol, lensedTex * 0.65, clamp(u_textureMix * 0.6, 0.0, 0.75));
    }
  }

  vec3 ringTint = palette(0.12 + u_time * 0.15, u_palA, u_palB, u_palC, u_palD) + vec3(0.95, 0.85, 0.65);
  vec3 finalCol = diskAccum + ringTint * photonRingGlow * (0.75 + u_kickTransient * 0.85) + starCol;

  vec2 fbUv = clamp((rawUv - 0.5) * 0.992 + 0.5, 0.002, 0.998);
  return mix(finalCol, texture2D(u_prevFrame, fbUv).rgb, clamp(u_feedbackTrail * 0.32, 0.04, 0.45));
}

// ============================================================================
// MODE 16: KALI'S "STAR NEST" VOLUMETRIC COSMIC FRACTAL NEBULA
// 20-step volumetric raymarch through modulo-tiled 3D space with 16-pass spherical inversion
// ============================================================================
vec3 renderMode16_KaliStarNest(vec2 uv, vec2 rawUv) {
  float dirSign = (abs(u_zoomDirection) < 0.05) ? 1.0 : u_zoomDirection;
  float flyTime = (u_time * u_speed * 0.018 + u_bassCumulative * 0.025) * dirSign;

  vec2 p2 = (uv + u_cameraOrbit * 0.35) / max(0.45, u_cameraZoom);
  p2 *= rotate2D(u_cameraRoll + u_time * 0.04);

  vec3 dir = vec3(p2 * 0.85, 1.0);
  float a1 = 0.5 + u_cameraOrbit.x * 1.5 + u_time * 0.05;
  float a2 = 0.8 + u_cameraOrbit.y * 1.5 + u_time * 0.03;
  mat2 rot1 = rotate2D(a1);
  mat2 rot2 = rotate2D(a2);
  dir.xz *= rot1;
  dir.xy *= rot2;

  vec3 from = vec3(1.0, 0.5, 0.5) + vec3(flyTime * 2.0, flyTime, -2.0);
  from.xz *= rot1;
  from.xy *= rot2;

  float formuparam = clamp(0.51 + (u_kleinianScale - 1.4) * 0.18 + u_mid * 0.035, 0.42, 0.68);
  float tile = clamp(0.85 * u_foldLimit, 0.55, 1.25);
  float darkmatter = clamp(0.35 + u_cloudDensity * 0.35, 0.1, 0.85);
  float distfading = 0.73;
  float stepsize = 0.115;

  float s = 0.1;
  float fade = 1.0;
  vec3 v = vec3(0.0);
  int volSteps = u_exportTurbo ? 14 : 18;
  int magicIters = u_exportTurbo ? 13 : 15;

  for (int r = 0; r < 18; r++) {
    if (r >= volSteps) break;
    vec3 p = from + s * dir * 0.5;
    p = abs(vec3(tile) - mod(p, vec3(tile * 2.0))); // Modulo Tiling fold
    float pa = 0.0;
    float a = 0.0;
    for (int i = 0; i < 15; i++) {
      if (i >= magicIters) break;
      p = abs(p) / max(dot(p, p), 1e-4) - formuparam; // Kali's Magic Spherical Inversion formula
      float lenP = length(p);
      a += abs(lenP - pa);
      pa = lenP;
    }
    float dm = max(0.0, darkmatter - a * a * 0.001);
    a *= a * a; // Contrast cubing
    if (r > 6) fade *= 1.0 - dm; // Dark matter dust absorption
    v += vec3(fade);
    v += vec3(s, s * s, s * s * s * s) * a * 0.0016 * fade;
    fade *= distfading;
    s += stepsize;
  }

  v = mix(vec3(length(v)), v, 0.85);
  vec3 rawStarCol = clamp(v * 0.011 * (1.0 + u_kickTransient * 0.65 + u_hiHatSparkle * 0.45), 0.0, 2.5);
  vec3 palTint = palette(length(rawStarCol) * 0.45 + u_time * 0.08 + u_pitchHue, u_palA, u_palB, u_palC, u_palD);
  vec3 col = mix(rawStarCol, rawStarCol * palTint * 1.45, 0.62);

  if (u_hasTexture && u_textureMappingMode != 3) {
    vec3 texCol = sampleMultiImagePair(p2 * 0.65 * u_trapScale).rgb;
    col = mix(col, texCol * (0.5 + length(rawStarCol) * 0.7), clamp(u_textureMix * 0.55, 0.0, 0.75));
  }

  return col;
}

// ============================================================================
// MODE 17: GYROID MINIMAL-SURFACE BIOLUMINESCENT LABYRINTH
// Triply Periodic Minimal Surface (TPMS) + 3 octaves cyclic Gyroid noise + Subsurface Bioluminescence
// ============================================================================
float evalGyroidLabyrinthSdf(vec3 p, float wallThick, float poreScale, out float bioVein) {
  // Base TPMS Gyroid: sin(x)cos(y) + sin(y)cos(z) + sin(z)cos(x)
  float g1 = abs(dot(sin(p), cos(p.yzx))) - wallThick;

  // Octave 2 & 3 domain-rotated cyclic Gyroid pores
  vec3 p2 = p * 2.15 * poreScale;
  p2.xy *= rotate2D(0.55);
  float g2 = abs(dot(sin(p2), cos(p2.yzx)));

  vec3 p3 = p * 4.35 * poreScale;
  p3.yz *= rotate2D(0.85);
  float g3 = abs(dot(sin(p3), cos(p3.yzx)));

  bioVein = exp(-g3 * 3.2) * (0.5 + 0.5 * sin(g2 * 4.0 + u_time * 3.0));
  float d = g1 - g2 * 0.14 + g3 * 0.045;
  return d * 0.58;
}

vec3 renderMode17_GyroidLabyrinth(vec2 uv, vec2 rawUv) {
  float dirSign = (abs(u_zoomDirection) < 0.05) ? 1.0 : u_zoomDirection;
  float flyZ = (u_time * u_speed * 0.95 + u_bassCumulative * 1.25) * dirSign;

  vec2 p2 = (uv + u_cameraOrbit * 0.35) / max(0.45, u_cameraZoom);
  p2 *= rotate2D(u_cameraRoll + sin(flyZ * 0.15) * 0.2);

  vec3 ro = vec3(
    sin(flyZ * 0.35) * 0.65 + u_cameraLateral.x * 0.25,
    cos(flyZ * 0.28) * 0.65 + u_cameraLateral.y * 0.25,
    flyZ
  );
  vec3 rd = normalize(vec3(p2 * clamp(u_cameraFov, 0.65, 2.2), 1.2));
  rd.xz *= rotate2D(sin(flyZ * 0.18) * 0.25);

  float wallThick = clamp(0.18 + (u_foldLimit - 1.0) * 0.22 + u_bass * 0.08, 0.08, 0.48);
  float poreScale = clamp(u_kleinianScale * 0.72, 0.65, 1.45);

  float t = 0.05;
  float glow = 0.0;
  float hitBio = 0.0;
  bool hit = false;
  int maxSteps = clamp(u_maxSteps, 40, u_exportTurbo ? 58 : 86);

  for (int i = 0; i < 86; i++) {
    if (i >= maxSteps) break;
    vec3 p = ro + rd * t;
    float stepBio;
    float d = evalGyroidLabyrinthSdf(p, wallThick, poreScale, stepBio);
    glow += (0.015 + stepBio * 0.018) / (0.015 + d * d * 32.0);
    if (d < 0.0018 * max(t, 1.0)) {
      hit = true;
      hitBio = stepBio;
      break;
    }
    if (t > 11.0) break;
    t += max(d, 0.009);
  }

  vec3 lightDir = normalize(vec3(sin(flyZ * 0.5) * 0.5, cos(flyZ * 0.4) * 0.5, 0.75));
  vec3 bgCol = palette(u_time * 0.08 + length(p2) * 0.3, u_palA, u_palB, u_palC, u_palD) * 0.12;
  vec3 col = bgCol;

  if (hit) {
    vec3 pos = ro + rd * t;
    float b0;
    vec2 e = vec2(0.004, 0.0);
    vec3 nor = normalize(vec3(
      evalGyroidLabyrinthSdf(pos + e.xyy, wallThick, poreScale, b0) - evalGyroidLabyrinthSdf(pos - e.xyy, wallThick, poreScale, b0),
      evalGyroidLabyrinthSdf(pos + e.yxy, wallThick, poreScale, b0) - evalGyroidLabyrinthSdf(pos - e.yxy, wallThick, poreScale, b0),
      evalGyroidLabyrinthSdf(pos + e.yyx, wallThick, poreScale, b0) - evalGyroidLabyrinthSdf(pos - e.yyx, wallThick, poreScale, b0)
    ));

    // Subsurface Scattering (SSS) approximation along light direction
    float sssSample;
    float sssDist = evalGyroidLabyrinthSdf(pos + lightDir * 0.22, wallThick, poreScale, sssSample);
    float sss = clamp(0.5 + sssDist * 2.4, 0.0, 1.0);

    float diff = max(dot(nor, lightDir), 0.0);
    float fresnel = pow(clamp(1.0 + dot(nor, rd), 0.0, 1.0), 3.0) * clamp(u_clarity, 0.4, 2.0);

    vec3 boneAlbedo = palette(hitBio * 0.8 + t * 0.08 + u_pitchHue, u_palA, u_palB, u_palC, u_palD);
    vec3 bioCol = palette(hitBio * 1.4 + 0.35 + u_time * 0.2, u_palA, u_palB, u_palC, u_palD) *
                  (1.35 + u_kickTransient * 1.25 + u_mid * 0.65);

    if (u_hasTexture && u_textureMappingMode != 3) {
      vec3 texCol = sampleMultiImagePair(pos.xy * 0.35 * u_trapScale).rgb;
      boneAlbedo = mix(boneAlbedo, texCol * 1.15, clamp(u_textureMix, 0.0, 0.85));
    }

    col = boneAlbedo * (0.22 + diff * 0.78 + sss * 0.48) +
          bioCol * hitBio * (0.65 + sss * 0.55) +
          bioCol * fresnel * 0.45;
    col = mix(bgCol, col, exp(-0.025 * t * t));
  }

  col += palette(glow * 0.12 + u_time * 0.15, u_palA, u_palB, u_palC, u_palD) * glow * 0.35;
  return col;
}

// ============================================================================
// MODE 18: VOLUMETRIC HELICAL TOKAMAK PLASMA & QUANTUM ORBITAL WAVEFUNCTIONS
// Sub-Modes via u_polychoraType:
//   0: Helical Tokamak Fusion Cage
//   1: Hydrogen Quantum Psi-Beat Orbitals (|Psi_nlm|^2 superposition)
// ============================================================================
vec3 renderMode18_TokamakAndQuantumOrbitals(vec2 uv, vec2 rawUv) {
  int subMode = clamp(u_polychoraType, 0, 1);
  vec2 p2 = (uv + u_cameraOrbit * 0.35) / max(0.45, u_cameraZoom);
  p2 *= rotate2D(u_cameraRoll);

  vec3 ro = vec3(u_cameraLateral * 0.2, -3.1);
  vec3 rd = normalize(vec3(p2 * 1.35, 1.25));

  float spinT = u_time * u_speed * 0.85 + u_bassCumulative * 0.95;
  float windingQ = clamp(floor(u_bulbPower * 0.6), 2.0, 8.0);
  float pinchAmp = clamp(u_foldLimit * 0.75 + u_bass * 0.35, 0.35, 1.45);

  vec3 accumPlasma = vec3(0.0);
  float t = 0.25;
  int steps = u_exportTurbo ? 38 : 52;

  for (int i = 0; i < 52; i++) {
    if (i >= steps) break;
    vec3 p = ro + rd * t;
    p.xz *= rotate2D(spinT * 0.35 + u_cameraOrbit.x * 2.0);
    p.yz *= rotate2D(u_time * 0.22 + u_cameraOrbit.y * 2.0);

    if (subMode == 0) {
      // Helical Tokamak Magnetic Flux-Tube Plasma Cage
      float majorR = 1.15 + 0.12 * sin(spinT * 1.5);
      float toroidalPhi = atan(p.z, p.x);
      vec2 poloidalVec = vec2(length(p.xz) - majorR, p.y);
      float minorR = length(poloidalVec);
      float poloidalTheta = atan(poloidalVec.y, poloidalVec.x);

      // Helical safety-factor q magnetic field lines + central Z-pinch column
      float helicalWave = cos(windingQ * poloidalTheta - 2.0 * toroidalPhi + spinT * 2.8);
      float fluxShell = abs(minorR - (0.42 + 0.08 * u_subBass)) - 0.06 * helicalWave;
      float zPinchCore = length(p.xz) - (0.14 + u_kickTransient * 0.08) * pinchAmp;

      float tubeDensity = exp(-abs(fluxShell) * 18.0) * (0.65 + 0.55 * max(helicalWave, 0.0));
      float coreDensity = exp(-max(zPinchCore, 0.0) * 14.0) * (0.75 + u_kickTransient * 1.1);

      vec3 fluxCol = palette(toroidalPhi * 0.159 + helicalWave * 0.35 + u_time * 0.2, u_palA, u_palB, u_palC, u_palD);
      vec3 coreCol = vec3(0.75, 0.92, 1.0) + fluxCol * 0.65;
      accumPlasma += (fluxCol * tubeDensity + coreCol * coreDensity * 0.65) * 0.095;
    } else {
      // Hydrogen Quantum Orbital Superposition: Psi = c1 * psi_2p0 + c2 * psi_3d2 * e^(-i * dE * t)
      float r = length(p) * 1.45 + 1e-4;
      float cosTheta = p.y / r;
      float sinTheta = length(p.xz) / r;
      float phi = atan(p.z, p.x);

      // Radial & Angular Hydrogenic wavefunctions (scaled Bohr radius)
      float psi210 = r * exp(-r * 0.85) * cosTheta;
      float psi322 = (r * r) * exp(-r * 0.62) * (sinTheta * sinTheta);
      float psi320 = (r * r) * exp(-r * 0.62) * (3.0 * cosTheta * cosTheta - 1.0);

      float beatOmega = spinT * 1.85 + u_mid * 2.0;
      float rePsi = psi210 * cos(beatOmega) + psi322 * cos(2.0 * phi - beatOmega * 0.7) * pinchAmp + psi320 * 0.45;
      float imPsi = psi210 * sin(beatOmega) + psi322 * sin(2.0 * phi - beatOmega * 0.7) * pinchAmp;

      float probDensity = (rePsi * rePsi + imPsi * imPsi) * 2.6;
      float quantumPhase = atan(imPsi, rePsi) / 6.2831853 + 0.5;

      vec3 lobeCol = palette(quantumPhase + r * 0.2 + u_pitchHue, u_palA, u_palB, u_palC, u_palD);
      accumPlasma += lobeCol * probDensity * exp(-r * 0.45) * (0.09 + u_kickTransient * 0.06);
    }

    t += 0.095;
    if (t > 5.2) break;
  }

  vec2 fbUv = clamp((rawUv - 0.5) * 0.988 + 0.5, 0.002, 0.998);
  return mix(accumPlasma, texture2D(u_prevFrame, fbUv).rgb, clamp(u_feedbackTrail * 0.4, 0.06, 0.56));
}

// ============================================================================
// MODE 19: LIQUID MERCURY FERROFLUID & GRAY-SCOTT REACTION-DIFFUSION
// Magnetic Paramagnetic Rosensweig Spikes + Turing Morphogenesis + Thin-Film Oil-Slick
// ============================================================================
float evalFerrofluidHeight(vec2 p, float spikeFreq, float turingMix) {
  float r = length(p);
  float angle = atan(p.y, p.x);
  float t = u_time * u_speed * 0.9 + u_bassCumulative * 1.4;

  // Paramagnetic Rosensweig hexagonal ferrofluid spike lattice
  vec2 sp = p * spikeFreq * rotate2D(u_time * 0.12);
  vec2 h1 = vec2(1.0, 0.0);
  vec2 h2 = vec2(0.5, 0.8660254);
  vec2 h3 = vec2(-0.5, 0.8660254);
  float hexWave = (cos(dot(sp, h1) * 6.28318 - t) +
                   cos(dot(sp, h2) * 6.28318 - t * 0.8) +
                   cos(dot(sp, h3) * 6.28318 + t * 0.6)) / 3.0;
  float rosensweigSpikes = pow(clamp(0.5 + 0.5 * hexWave, 0.0, 1.0), 2.2 - min(1.1, u_subBass * 0.7)) *
                           exp(-r * 0.48) * (0.75 + u_subBass * 0.85 + u_kickTransient * 0.95);

  // Gray-Scott Reaction-Diffusion Turing Coral Labyrinth ridges
  vec2 tp = p * (spikeFreq * 1.35);
  tp += 0.38 * vec2(sin(tp.y * 2.4 + t * 0.7), cos(tp.x * 2.4 - t * 0.65));
  float turingSpots = sin(tp.x * 3.8 + cos(tp.y * 3.8 + u_mid * 2.5)) * cos(tp.y * 3.8 - sin(tp.x * 3.8));
  float turingCoral = smoothstep(-0.35, 0.45, turingSpots);

  // Concentric bass shockwave ripples
  float shockRing = sin(r * 14.0 - t * 3.2) * exp(-r * 1.1) * (0.18 + u_kickTransient * 0.32);

  return mix(rosensweigSpikes, turingCoral * 0.85, turingMix) + shockRing;
}

vec3 renderMode19_MercuryFerrofluid(vec2 uv, vec2 rawUv) {
  vec2 p = (uv + u_cameraOrbit * 0.35) / max(0.45, u_cameraZoom);
  p *= rotate2D(u_cameraRoll);

  float spikeFreq = clamp(u_bulbPower * 0.38, 1.4, 5.2);
  float turingMix = clamp(0.35 + (u_foldLimit - 1.0) * 0.45 + u_xyPad1.x * 0.35, 0.05, 0.92);

  float hCenter = evalFerrofluidHeight(p, spikeFreq, turingMix);
  float eps = 0.006;
  float hX = evalFerrofluidHeight(p + vec2(eps, 0.0), spikeFreq, turingMix) -
             evalFerrofluidHeight(p - vec2(eps, 0.0), spikeFreq, turingMix);
  float hY = evalFerrofluidHeight(p + vec2(0.0, eps), spikeFreq, turingMix) -
             evalFerrofluidHeight(p - vec2(0.0, eps), spikeFreq, turingMix);

  float spikeAmp = 1.65 + u_subBass * 1.1 + u_kickTransient * 1.2;
  vec3 nor = normalize(vec3(-hX * spikeAmp / (2.0 * eps), -hY * spikeAmp / (2.0 * eps), 1.0));
  vec3 viewDir = normalize(vec3(-p * 0.45, 1.0));
  vec3 reflDir = reflect(-viewDir, nor);

  // Fresnel-Schlick liquid mercury reflectance (F0 = 0.92)
  float cosTheta = clamp(dot(nor, viewDir), 0.0, 1.0);
  float fresnel = 0.92 + 0.08 * pow(1.0 - cosTheta, 5.0);

  // Wave-Optics Thin-Film Interference Oil-Slick Coating:
  // 0.5 + 0.5 * cos(2*pi * (2 * n * d * cosTheta / lambda_rgb))
  float filmOpticalDepth = (1.65 + hCenter * 1.45 + u_mid * 0.55) * cosTheta;
  vec3 thinFilmIrid = 0.5 + 0.5 * cos(6.2831853 * (filmOpticalDepth / vec3(0.65, 0.53, 0.45) + u_pitchHue));

  // Procedural studio reflection environment
  float envBand = sin(reflDir.x * 5.0 + u_time * 0.5) * cos(reflDir.y * 5.0 - u_time * 0.4);
  vec3 envChrome = vec3(0.55 + 0.45 * smoothstep(-0.2, 0.6, envBand));
  vec3 envPalette = palette(reflDir.x * 0.4 + reflDir.y * 0.4 + hCenter * 0.8 + u_time * 0.12, u_palA, u_palB, u_palC, u_palD);

  if (u_hasTexture && u_textureMappingMode != 3) {
    vec3 envTex = sampleMultiImagePair(reflDir.xy * 0.65 * u_trapScale).rgb;
    envPalette = mix(envPalette, envTex * 1.35, clamp(u_textureMix, 0.0, 0.9));
  }

  vec3 light1 = normalize(vec3(0.6, 0.7, 0.85));
  vec3 light2 = normalize(vec3(-0.7, -0.4, 0.65));
  float spec1 = pow(max(dot(reflDir, light1), 0.0), 42.0) * clamp(u_clarity, 0.5, 2.0);
  float spec2 = pow(max(dot(reflDir, light2), 0.0), 28.0) * clamp(u_clarity, 0.5, 2.0);

  float oilSlickAmt = clamp(0.48 + u_transcendence * 0.45, 0.12, 0.95);
  vec3 mercuryCol = mix(envChrome * envPalette * 1.35, thinFilmIrid * envPalette * 1.65, oilSlickAmt) * fresnel;
  mercuryCol += vec3(1.0, 0.97, 0.92) * (spec1 * 1.15 + spec2 * 0.65) * (1.0 + u_hiHatSparkle * 0.8);

  vec2 fbUv = clamp((rawUv - 0.5) * 0.992 + 0.5, 0.002, 0.998);
  return mix(mercuryCol, texture2D(u_prevFrame, fbUv).rgb, clamp(u_feedbackTrail * 0.32, 0.05, 0.48));
}

// ============================================================================
// MODE 20: PHYSARUM SLIME-MOLD BIOLUMINESCENT NEURAL NETWORK
// Self-organizing chemotactic mycelial veins, curl-noise advection & user image contour bridges
// ============================================================================
vec3 renderMode20_PhysarumNeuralNet(vec2 uv, vec2 rawUv) {
  float dirSign = (abs(u_zoomDirection) < 0.05) ? 1.0 : u_zoomDirection;
  float growthT = (u_time * u_speed * 0.75 + u_bassCumulative * 0.95) * dirSign;

  vec2 p = (uv + u_cameraOrbit * 0.35) / max(0.45, u_cameraZoom);
  p *= rotate2D(u_cameraRoll);

  float branchScale = clamp(u_kleinianScale * 1.85, 1.4, 4.2);
  float curlStrength = clamp(0.35 + u_fbmWarp * 0.55 + u_mid * 0.3, 0.15, 1.35);

  // Multi-scale Dendritic Vein Network (4 octaves of domain-warped cellular ridges)
  vec2 q = p * branchScale;
  float veinAccum = 0.0;
  float synapseNodes = 0.0;
  float amp = 1.0;

  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 curl = vec2(
      sin(q.y * 2.1 + growthT * (0.8 + fi * 0.25)),
      cos(q.x * 2.1 - growthT * (0.75 + fi * 0.2))
    ) * curlStrength;
    q += curl;

    // Cellular filament ridges
    vec2 cell = abs(fract(q) - 0.5);
    float ridge = min(cell.x, cell.y);
    float diagRidge = abs(cell.x - cell.y) * 0.7071;
    float minVein = min(ridge, diagRidge);

    float filament = exp(-minVein * (22.0 + fi * 6.0));
    // Traveling action-potential bioluminescent impulses along axons
    float impulse = 0.55 + 0.65 * pow(0.5 + 0.5 * sin(dot(q, vec2(2.5, 1.8)) - growthT * 4.5 + u_bpmPhase * 6.28318), 3.0);
    veinAccum += filament * impulse * amp;

    // Glowing synaptic junction soma nodes
    float somaDist = length(cell - vec2(0.25));
    synapseNodes += exp(-somaDist * 18.0) * amp * (0.6 + u_hiHatSparkle * 0.9);

    q = q * 1.82 * rotate2D(0.68 + u_xyPad1.x * 0.35);
    amp *= 0.62;
  }

  vec3 axonCol = palette(veinAccum * 0.42 + u_time * 0.14 + u_pitchHue, u_palA, u_palB, u_palC, u_palD);
  vec3 somaCol = palette(veinAccum * 0.42 + 0.38 + u_time * 0.2, u_palA, u_palB, u_palC, u_palD);
  vec3 netCol = axonCol * veinAccum * (0.95 + u_kickTransient * 0.85) +
                somaCol * synapseNodes * 0.65;

  // Chemotactic attraction to user-uploaded image bright contours
  if (u_hasTexture && u_textureMappingMode != 3) {
    vec4 imgSample = sampleMultiImagePair(p * 0.75 * u_trapScale);
    float imgContour = smoothstep(0.15, 0.85, imgSample.a);
    vec3 chemoBridge = imgSample.rgb * (0.65 + veinAccum * 1.15) * (0.7 + imgContour * 0.8);
    netCol = mix(netCol, chemoBridge, clamp(u_textureMix * 0.8, 0.0, 0.9));
  }

  // Chemotactic pheromone trail persistence in ping-pong feedback buffer
  vec2 advectOffset = vec2(
    sin(rawUv.y * 14.0 + growthT * 2.0),
    cos(rawUv.x * 14.0 - growthT * 1.8)
  ) * 0.0022;
  vec2 fbUv = clamp((rawUv - 0.5) * 0.992 + 0.5 + advectOffset, 0.002, 0.998);
  vec3 prevTrail = texture2D(u_prevFrame, fbUv).rgb;
  float decay = clamp(u_feedbackTrail * 0.68, 0.25, 0.82);
  return mix(netCol, max(netCol, prevTrail * 0.94), decay);
}

// ============================================================================
// MODE 21: HOLOGRAPHIC 3D STRANGE ATTRACTORS (AIZAWA, THOMAS & CLIFFORD/DE JONG)
// Sub-Modes via u_polychoraType:
//   0: Aizawa Holographic Torus-Sphere Attractor
//   1: Thomas Cyclically Symmetric Attractor Maze
//   2: Clifford / De Jong Phase-Space Density Mist
// ============================================================================
vec3 renderMode21_StrangeAttractors(vec2 uv, vec2 rawUv) {
  int attrType = clamp(u_polychoraType, 0, 2);
  float flowT = u_time * u_speed * 0.75 + u_bassCumulative * 0.85;

  vec2 p2 = (uv + u_cameraOrbit * 0.35) / max(0.45, u_cameraZoom);
  p2 *= rotate2D(u_cameraRoll);

  if (attrType == 2) {
    // Sub-Mode 2: Clifford / Peter de Jong Chaotic Phase-Space Ribbon Mist
    // x_{n+1} = sin(a*y_n) + c*cos(a*x_n), y_{n+1} = sin(b*x_n) + d*cos(b*y_n)
    float a = -1.4 + u_xyPad1.x * 0.45 + sin(flowT * 0.25) * 0.18 + u_bass * 0.15;
    float b = 1.6 + u_xyPad1.y * 0.45 + cos(flowT * 0.22) * 0.18 + u_mid * 0.15;
    float c = 1.0 + sin(flowT * 0.18) * 0.22;
    float d = 0.7 + cos(flowT * 0.15) * 0.22;

    vec2 z = p2 * 1.75;
    float density = 0.0;
    float minOrb = 1e5;
    for (int i = 0; i < 10; i++) {
      vec2 nextZ = vec2(
        sin(a * z.y) + c * cos(a * z.x),
        sin(b * z.x) + d * cos(b * z.y)
      );
      float stepDist = length(nextZ - z);
      density += exp(- abs(nextZ.x * nextZ.y) * 5.5) * (0.6 + 0.4 * sin(stepDist * 3.0));
      minOrb = min(minOrb, abs(nextZ.x - nextZ.y));
      z = mix(z, nextZ, 0.55);
    }

    vec3 mistCol = palette(density * 0.22 + minOrb * 0.8 + u_time * 0.14 + u_pitchHue, u_palA, u_palB, u_palC, u_palD) *
                   (density * 0.28 * (1.0 + u_kickTransient * 0.75));
    vec2 fbUvC = clamp((rawUv - 0.5) * 0.988 + 0.5, 0.002, 0.998);
    return mix(mistCol, texture2D(u_prevFrame, fbUvC).rgb, clamp(u_feedbackTrail * 0.52, 0.15, 0.72));
  }

  vec3 ro = vec3(u_cameraLateral * 0.2, -2.85);
  vec3 rd = normalize(vec3(p2 * 1.35, 1.25));
  float t = 0.15;
  vec3 holoAccum = vec3(0.0);
  int steps = u_exportTurbo ? 40 : 56;

  float chaosB = clamp(0.19 + (u_foldLimit - 0.9) * 0.08 - u_bass * 0.03, 0.12, 0.32);

  for (int i = 0; i < 56; i++) {
    if (i >= steps) break;
    vec3 p = ro + rd * t;
    p.xz *= rotate2D(flowT * 0.32 + u_cameraOrbit.x * 2.0);
    p.yz *= rotate2D(u_time * 0.2 + u_cameraOrbit.y * 2.0);

    float dStream = 1.0;
    float velMag = 1.0;

    if (attrType == 0) {
      // Sub-Mode 0: Aizawa Strange Attractor (Glowing Sphere-Torus with Polar Magnetic Core)
      // dx = (z - b)*x - d*y; dy = d*x + (z - b)*y; dz = c + a*z - z^3/3 - (x^2+y^2)*(1 + e*z) + f*z*x^3
      vec3 ap = p * 1.35;
      float rxy2 = dot(ap.xy, ap.xy);
      float dx = (ap.z - 0.7) * ap.x - 3.5 * ap.y;
      float dy = 3.5 * ap.x + (ap.z - 0.7) * ap.y;
      float dz = 0.6 + 0.95 * ap.z - (ap.z * ap.z * ap.z) / 3.0 - rxy2 * (1.0 + 0.25 * ap.z) + 0.1 * ap.z * ap.x * ap.x * ap.x;
      vec3 vFlow = vec3(dx, dy, dz);
      velMag = length(vFlow);

      // Torus-sphere shell + central polar stream tube + helical phase ribbons
      float phi = atan(ap.y, ap.x);
      float shell = abs(length(ap) - (1.05 + 0.12 * cos(3.0 * phi + flowT * 2.0)));
      float axisCore = length(ap.xy) - (0.14 + 0.06 * sin(ap.z * 5.0 - flowT * 3.0));
      float ribbon = abs(sin(ap.z * 4.5 + phi * 3.0 - flowT * 2.5)) * 0.18;
      dStream = min(max(shell, ribbon), max(axisCore, abs(ap.z) - 1.25));
    } else {
      // Sub-Mode 1: René Thomas's Cyclically Symmetric Attractor
      // dx/dt = sin(y) - b*x, dy/dt = sin(z) - b*y, dz/dt = sin(x) - b*z
      vec3 tp = p * 2.35;
      vec3 vThomas = sin(tp.yzx) - chaosB * tp;
      velMag = length(vThomas);
      // Streamline tube locus where velocity field cross-product curls into cyclic braids
      dStream = (length(vThomas) - (0.52 + u_mid * 0.18)) * 0.32;
    }

    float glow = exp(-max(dStream, 0.0) * 19.0) * (0.55 + 0.45 * sin(velMag * 2.0 + flowT * 3.0));
    vec3 streamCol = palette(velMag * 0.22 + t * 0.15 + u_pitchHue, u_palA, u_palB, u_palC, u_palD);
    holoAccum += streamCol * glow * 0.082 * (1.0 + u_kickTransient * 0.7);

    t += max(abs(dStream) * 0.55, 0.045);
    if (t > 5.4) break;
  }

  vec2 fbUv = clamp((rawUv - 0.5) * 0.988 + 0.5, 0.002, 0.998);
  return mix(holoAccum, texture2D(u_prevFrame, fbUv).rgb, clamp(u_feedbackTrail * 0.45, 0.08, 0.62));
}

// ============================================================================
// MODE 22: QUASICRYSTAL APERIODIC WAVE INTERFERENCE & PENROSE PENTAGRID
// Sums N in {5, 7, 9, 12} evenly rotated plane waves with triangle-wave parity folding
// ============================================================================
vec3 renderMode22_QuasicrystalPenrose(vec2 uv, vec2 rawUv) {
  float dirSign = (abs(u_zoomDirection) < 0.05) ? 1.0 : u_zoomDirection;
  float phaseShift = (u_time * u_speed * 1.45 + u_bassCumulative * 1.8) * dirSign;

  vec2 p = (uv + u_cameraOrbit * 0.35) / max(0.45, u_cameraZoom);
  p *= rotate2D(u_cameraRoll + u_time * 0.05);

  // Select forbidden rotational symmetry N via u_polychoraType: 0->5-fold, 1->7-fold, 2->9-fold, 3->12-fold
  int symChoice = clamp(u_polychoraType, 0, 3);
  int numWaves = (symChoice == 0) ? 5 : (symChoice == 1) ? 7 : (symChoice == 2) ? 9 : 12;

  float freq = clamp(u_bulbPower * 1.9, 8.0, 28.0);
  vec2 qp = p * freq;

  float waveSum = 0.0;
  float dualSum = 0.0;
  float fN = float(numWaves);

  for (int n = 0; n < 12; n++) {
    if (n >= numWaves) break;
    float angle = (3.14159265 * float(n)) / fN;
    vec2 dir = vec2(cos(angle), sin(angle));
    float proj = dot(qp, dir) + phaseShift + u_mid * 1.5 * sin(float(n) * 1.7);
    waveSum += cos(proj);
    dualSum += sin(proj);
  }

  float normWave = waveSum / (fN * 0.5);
  float normDual = dualSum / (fN * 0.5);

  // Triangle-wave parity folding & contour banding
  float bandSharpness = clamp(u_foldLimit * 2.2 + u_snareTransient * 1.2, 1.2, 5.5);
  float parityFold = abs(fract(normWave * bandSharpness) - 0.5) * 2.0;
  float penroseRhomb = exp(-abs(parityFold - 0.5) * (9.0 - min(4.0, u_fractalSpike * 1.4)));
  float starVertices = exp(-(normWave * normWave + normDual * normDual) * 2.4) * (1.2 + u_kickTransient * 1.1);

  vec3 tileCol = palette(
    normWave * 0.55 + parityFold * 0.35 + u_time * 0.12 + u_pitchHue,
    u_palA,
    u_palB,
    u_palC,
    u_palD
  );
  vec3 irid = thinFilmIridescence(parityFold, normDual + u_time * 0.18);
  vec3 col = mix(tileCol, irid * 1.25, 0.35) * (0.45 + parityFold * 0.65 + penroseRhomb * 0.75) +
             tileCol * starVertices * 0.65;

  if (u_hasTexture && u_textureMappingMode != 3) {
    vec2 mosaicUv = (p + vec2(normWave, normDual) * 0.08) * u_trapScale;
    vec3 texCol = sampleMultiImagePair(mosaicUv).rgb;
    col = mix(col, texCol * (0.65 + penroseRhomb * 0.75), clamp(u_textureMix, 0.0, 0.85));
  }

  vec2 fbUv = clamp((rawUv - 0.5) * 0.992 + 0.5, 0.002, 0.998);
  return mix(col, texture2D(u_prevFrame, fbUv).rgb, clamp(u_feedbackTrail * 0.35, 0.05, 0.5));
}

// ============================================================================
// MODE 23: NEWTON / NOVA COMPLEX ROOT-FINDING BASINS & WEIERSTRASS ELLIPTIC WELLS
// Sub-Modes via u_polychoraType:
//   0: Newton Cubic/Quintic Root-Finding Basins (z_{n+1} = z_n - a*(z^p - 1)/(p*z^(p-1)))
//   1: Nova Fractal Kaleidoscope (z_{n+1} = z_n - a*(z^p - 1)/(p*z^(p-1)) + c)
//   2: Weierstrass Double-Periodic Elliptic Lattice Vortex
// ============================================================================
vec2 cPowInt(vec2 z, int p) {
  float r = length(z);
  if (r < 1e-5) return vec2(0.0);
  float a = atan(z.y, z.x) * float(p);
  return pow(r, float(p)) * vec2(cos(a), sin(a));
}

vec3 renderMode23_NewtonNovaBasins(vec2 uv, vec2 rawUv) {
  int subMode = clamp(u_polychoraType, 0, 2);
  float dirSign = (abs(u_zoomDirection) < 0.05) ? 1.0 : u_zoomDirection;
  float flowT = (u_time * u_speed * 0.45 + u_bassCumulative * 0.55) * dirSign;

  vec2 z = (uv + u_cameraOrbit * 0.4) * (1.45 / max(0.45, u_cameraZoom));
  z *= rotate2D(u_cameraRoll + flowT * 0.15);

  if (subMode == 2) {
    // Sub-Mode 2: Weierstrass Elliptic Double-Periodic Lattice Wells
    vec2 latP = z * clamp(u_kleinianScale * 1.4, 1.2, 3.2);
    vec2 cell = mod(latP + 1.0, 2.0) - 1.0;
    vec2 w = cell;
    for (int k = 0; k < 6; k++) {
      // Laurent series pole inversion: w -> 1/w^2 - c
      float r2 = max(dot(w, w), 1e-4);
      vec2 wInv = vec2(w.x, -w.y) / r2;
      w = cMul(wInv, wInv) * 0.28 - vec2(0.45 + 0.15 * sin(flowT + u_bass), 0.25 * cos(flowT + u_mid));
      w = mod(w + 1.2, 2.4) - 1.2;
    }
    float phase = atan(w.y, w.x) / 6.2831853 + 0.5;
    float wellGlow = exp(-length(w) * 2.8) * (1.1 + u_kickTransient * 0.8);
    vec3 colW = palette(phase + length(w) * 0.5 + u_pitchHue, u_palA, u_palB, u_palC, u_palD) * (0.55 + wellGlow);
    return colW;
  }

  int degreeP = clamp(int(floor(u_bulbPower * 0.65)), 3, 8);
  vec2 relaxA = vec2(
    clamp(u_foldLimit * 0.95, 0.55, 1.45),
    (u_xyPad1.x * 0.35 + sin(flowT * 0.6) * 0.12) * (1.0 + u_mid * 0.5)
  );
  vec2 novaC = (subMode == 1)
    ? vec2(0.18 * cos(flowT * 0.4) + u_xyPad1.y * 0.25, 0.18 * sin(flowT * 0.35) + u_bass * 0.08)
    : vec2(0.0);

  if (subMode == 1) {
    // Nova fractal starts from critical point z0 = (1, 0) with pixel coordinate as parameter c
    novaC += z * 0.45;
  }

  int maxIter = clamp(u_iterationDetail * 2, 12, 28);
  int convIter = maxIter;
  float minTrap = 1e5;
  vec2 prevZ = z;

  for (int i = 0; i < 28; i++) {
    if (i >= maxIter) break;
    vec2 zp_1 = cPowInt(z, degreeP - 1);
    vec2 zp = cMul(zp_1, z);
    vec2 num = zp - vec2(1.0, 0.0);
    vec2 den = float(degreeP) * zp_1;
    vec2 stepVec = cMul(relaxA, cDiv(num, den));

    prevZ = z;
    z = z - stepVec + novaC;

    float stepLen = length(z - prevZ);
    minTrap = min(minTrap, abs(z.x * z.y));
    if (stepLen < 0.0015) {
      convIter = i;
      break;
    }
  }

  float rootAngle = atan(z.y, z.x) / 6.2831853 + 0.5;
  float smoothSpeed = float(convIter) / float(max(maxIter, 1));
  float basinShade = 0.55 + 0.45 * cos(smoothSpeed * 18.0 - flowT * 3.0);
  float boundaryGlow = exp(-minTrap * 14.0) * (0.65 + u_kickTransient * 0.85);

  vec3 basinCol = palette(
    rootAngle + smoothSpeed * 0.85 + u_time * 0.1 + u_pitchHue,
    u_palA,
    u_palB,
    u_palC,
    u_palD
  );
  vec3 col = basinCol * basinShade + palette(rootAngle + 0.35, u_palA, u_palB, u_palC, u_palD) * boundaryGlow;

  if (u_hasTexture && u_textureMappingMode != 3) {
    vec3 texCol = sampleMultiImagePair(z * 0.65 * u_trapScale).rgb;
    col = mix(col, texCol * (0.75 + boundaryGlow * 0.5), clamp(u_textureMix, 0.0, 0.85));
  }

  vec2 fbUv = clamp((rawUv - 0.5) * 0.992 + 0.5, 0.002, 0.998);
  return mix(col, texture2D(u_prevFrame, fbUv).rgb, clamp(u_feedbackTrail * 0.32, 0.04, 0.45));
}

// ============================================================================
// MODE 24: SURREAL OP-ART MOIRÉ, PLEOCHROIC CRYSTAL & CRT PHOSPHOR XY OSCILLOSCOPE
// Sub-Modes via u_polychoraType:
//   0: Op-Art Phantom Moiré Illusion (Bridget Riley / Victor Vasarely)
//   1: Pleochroic Refracting Birefringent Gemstone
//   2: Glowing CRT XY Stereo Lissajous Oscilloscope (Jerobeam Fenderson style)
// ============================================================================
float segDist2D(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

vec3 renderMode24_OpArtPleochroicOscilloscope(vec2 uv, vec2 rawUv) {
  int subMode = clamp(u_polychoraType, 0, 2);
  vec2 p = (uv + u_cameraOrbit * 0.35) / max(0.45, u_cameraZoom);
  p *= rotate2D(u_cameraRoll);

  if (subMode == 0) {
    // Sub-Mode 0: Surreal Op-Art Phantom Moiré Interference Grating
    float freq = clamp(u_bulbPower * 3.8, 16.0, 56.0);
    float offset = (0.18 + u_bass * 0.16) * u_foldLimit;
    vec2 c1 = vec2(sin(u_time * 0.7) * offset, cos(u_time * 0.55) * offset);
    vec2 c2 = -c1 + vec2(u_xyPad1.x, u_xyPad1.y) * 0.15;

    float r1 = length(p - c1);
    float r2 = length(p - c2);
    float a1 = atan(p.y - c1.y, p.x - c1.x);
    float a2 = atan(p.y - c2.y, p.x - c2.x);

    float g1 = cos(r1 * freq + a1 * 6.0 - u_time * u_speed * 3.0);
    float g2 = cos(r2 * (freq * 1.04) - a2 * 6.0 + u_time * u_speed * 2.4 + u_mid * 4.0);
    float moireBeat = g1 * g2;
    float crispBand = smoothstep(-0.15, 0.15, moireBeat);

    vec3 opColA = palette(r1 * 0.6 + u_time * 0.15 + u_pitchHue, u_palA, u_palB, u_palC, u_palD);
    vec3 opColB = palette(r2 * 0.6 + 0.45 - u_time * 0.12, u_palA, u_palB, u_palC, u_palD) * 0.15;
    vec3 moireCol = mix(opColB, opColA * (1.25 + u_kickTransient * 0.6), crispBand);
    return moireCol;
  } else if (subMode == 1) {
    // Sub-Mode 1: Pleochroic Anisotropic Birefringent Gemstone
    float facets = clamp(floor(u_bulbPower), 5.0, 14.0);
    float r = length(p);
    float a = atan(p.y, p.x) + u_time * 0.15;
    float sector = 6.2831853 / facets;
    float foldedA = abs(mod(a, sector) - 0.5 * sector);

    // Ordinary (n_o) vs Extraordinary (n_e) birefringent double-refraction rays
    float birefSplit = (0.045 + u_bass * 0.04 + u_kickTransient * 0.03) * u_foldLimit;
    vec2 rayO = vec2(cos(foldedA), sin(foldedA)) * (r * (1.0 - birefSplit));
    vec2 rayE = vec2(cos(foldedA + birefSplit), sin(foldedA + birefSplit)) * (r * (1.0 + birefSplit));

    float facetO = abs(sin(rayO.x * 12.0 + rayO.y * 8.0 + u_time)) * exp(-r * 0.4);
    float facetE = abs(cos(rayE.x * 12.0 - rayE.y * 8.0 - u_time * 1.2)) * exp(-r * 0.4);

    // Dichroic / Trichroic polarization axes
    float polWeight = pow(cos(a * 2.0 + u_time * 0.5), 2.0);
    vec3 axisCol1 = palette(facetO + u_pitchHue, u_palA, u_palB, u_palC, u_palD);
    vec3 axisCol2 = palette(facetE + 0.38 + u_pitchHue, u_palA, u_palB, u_palC, u_palD);
    vec3 axisCol3 = thinFilmIridescence(cos(foldedA * facets), r + u_time * 0.2);

    vec3 gemCol = mix(axisCol1 * (0.4 + facetO * 1.3), axisCol2 * (0.4 + facetE * 1.3), polWeight);
    gemCol += axisCol3 * exp(-abs(fract(r * 4.5) - 0.5) * 14.0) * (0.55 + u_hiHatSparkle * 0.9);
    return gemCol;
  }

  // Sub-Mode 2: Glowing CRT Phosphor XY Stereo Lissajous Oscilloscope
  // Slight CRT barrel curvature + phosphor graticule grid
  vec2 crtP = p * (1.0 + 0.08 * dot(p, p));
  vec2 gridLines = abs(fract(crtP * 4.0) - 0.5);
  float graticule = exp(-min(gridLines.x, gridLines.y) * 45.0) * 0.12;

  float freqX = floor(clamp(u_bulbPower * 0.45, 2.0, 7.0));
  float freqY = freqX + 1.0 + floor(u_mid * 2.0);
  float scopeRadius = 0.72 + u_subBass * 0.16 + u_kickTransient * 0.14;
  float phaseDelta = u_time * u_speed * 1.85 + u_bassCumulative * 2.2;
  float modHarmonic = 0.22 * u_foldLimit * (0.5 + u_presence);

  float minBeamDist = 1e5;
  int segments = u_exportTurbo ? 44 : 64;
  vec2 prevPt = vec2(0.0);

  for (int i = 0; i <= 64; i++) {
    if (i > segments) break;
    float s = (float(i) / float(segments)) * 6.2831853;
    vec2 pt = vec2(
      sin(freqX * s + phaseDelta) + modHarmonic * cos((freqX * 2.0 + 1.0) * s - phaseDelta * 1.4),
      sin(freqY * s) + modHarmonic * sin((freqY * 2.0 + 1.0) * s + phaseDelta * 1.4)
    ) * (scopeRadius / (1.0 + modHarmonic));

    if (i > 0) {
      minBeamDist = min(minBeamDist, segDist2D(crtP, prevPt, pt));
    }
    prevPt = pt;
  }

  // Inverse-square analog electron beam core + wide phosphor halo
  float beamWidth = 0.0035 + u_kickTransient * 0.002;
  float coreBeam = exp(-minBeamDist / max(beamWidth, 0.001));
  float phosphorHalo = 0.014 / (0.012 + minBeamDist * minBeamDist * 55.0);

  vec3 phosphorTint = palette(0.25 + u_pitchHue + minBeamDist * 0.4, u_palA, u_palB, u_palC, u_palD);
  vec3 classicP31Green = vec3(0.18, 1.0, 0.52);
  vec3 beamCol = mix(classicP31Green, phosphorTint * 1.35, 0.65);

  vec3 scopeOut = beamCol * (coreBeam * 1.65 + phosphorHalo * (0.95 + u_kickTransient * 0.75) + graticule);

  // Authentic CRT Phosphor Persistence Decay via feedback buffer
  vec2 fbUv = clamp(rawUv, 0.002, 0.998);
  vec3 prevPhosphor = texture2D(u_prevFrame, fbUv).rgb;
  float persistence = clamp(u_feedbackTrail * 0.78, 0.35, 0.88);
  return max(scopeOut, prevPhosphor * persistence);
}

// ============================================================================
// MODE 25: DIVINE CREATION — FIAT LUX, SACRED GEOMETRY & VOLUMETRIC GOD RAYS
// + GLOBAL DIVINE CREATION LIGHT SCULPTOR (SHAPES ALL 26 MODES)
// ============================================================================

// Inigo Quilez's Exponential Impulse envelope for organic kick/climax creation bursts
float expImpulse(float x, float k) {
  float h = k * max(x, 0.0);
  return h * exp(1.0 - h);
}

// Smooth mirrored absolute value (Inigo Quilez almostIdentity: sqrt(x*x + n))
float almostIdentity(float x, float n) {
  return sqrt(x * x + n);
}

vec3 almostIdentity3(vec3 p, float n) {
  return sqrt(p * p + vec3(n));
}

// 3D Tetrahedron SDF with smooth mirrored edges
float sdSmoothTetrahedron(vec3 p, float r, float smoothN) {
  float md = max(
    max(-p.x - p.y - p.z, p.x + p.y - p.z),
    max(-p.x + p.y + p.z, p.x - p.y + p.z)
  );
  return (md - r) / 1.7320508 - smoothN * 0.08;
}

// Evaluates all 5 Platonic Solids + Recursive Platonic-Solid IFS Cathedral (Stage 4 & 5)
vec2 mapDivinePlatonicAndMerkaba(vec3 p, float stage4Weight, float stage5Weight, float timeFlow) {
  float smoothN = 0.0018;
  float trap = 10.0;
  float dResult = 10.0;

  if (stage4Weight > 0.01) {
    vec3 q = p;
    q.xz *= rotate2D(timeFlow * 0.32 + u_rot4dXW * 0.5);
    q.yz *= rotate2D(timeFlow * 0.24 + u_rot4dYW * 0.5);

    // Golden-Ratio normal vectors for Dodecahedron & Icosahedron
    const float PHI = 1.6180339887;
    vec3 n1 = normalize(vec3(1.0, PHI, 0.0));
    vec3 n2 = normalize(vec3(0.0, 1.0, PHI));
    vec3 n3 = normalize(vec3(PHI, 0.0, 1.0));
    vec3 nOct = normalize(vec3(1.0, 1.0, 1.0));

    // Platonic-Solid Iterated Function System (IFS) with smooth almostIdentity mirror folds
    vec3 z = q;
    float scale = 1.82 + u_bass * 0.14;
    float accScale = 1.0;
    for (int i = 0; i < 5; i++) {
      z = almostIdentity3(z, smoothN);
      float d1 = dot(z, n1);
      float d2 = dot(z, n2);
      z -= 2.0 * min(0.0, d1 - 0.36) * n1;
      z -= 2.0 * min(0.0, d2 - 0.36) * n2;
      if (z.x < z.y) z.xy = z.yx;
      if (z.y < z.z) z.yz = z.zy;
      z = z * scale - vec3(0.76, 0.48, 0.34) * (scale - 1.0);
      z.xy *= rotate2D(0.24 + u_mid * 0.12);
      accScale *= scale;
      trap = min(trap, length(z.xy) / accScale);
    }

    vec3 qa = almostIdentity3(q, smoothN);
    float dTetra = sdSmoothTetrahedron(q, 0.85, smoothN);
    float dCube = length(max(qa - vec3(0.62), 0.0)) - 0.03;
    float dOcta = (dot(qa, nOct) - 0.74);
    float dDodeca = max(max(dot(qa, n1), dot(qa, n2)), dot(qa, n3)) - 0.78;
    float dIcosa = max(dot(qa, nOct), max(dot(qa, n1), dot(qa, n2))) - 0.76;

    // Morph across all 5 Platonic Solids + IFS Cathedral
    float solidCycle = mod(timeFlow * 0.35 + u_bassCumulative * 0.25, 5.0);
    float dPlatonic = dTetra;
    dPlatonic = mix(dPlatonic, dCube, smoothstep(0.0, 1.0, clamp(solidCycle, 0.0, 1.0)));
    dPlatonic = mix(dPlatonic, dOcta, smoothstep(1.0, 2.0, clamp(solidCycle, 1.0, 2.0)));
    dPlatonic = mix(dPlatonic, dDodeca, smoothstep(2.0, 3.0, clamp(solidCycle, 2.0, 3.0)));
    dPlatonic = mix(dPlatonic, dIcosa, smoothstep(3.0, 4.0, clamp(solidCycle, 3.0, 4.0)));

    float dIfs = (length(z) - 1.35) / accScale;
    float dStage4 = smin(dPlatonic * 0.65 + dIfs * 0.55, dIfs, 0.08);
    dResult = min(dResult, dStage4);
  }

  if (stage5Weight > 0.01) {
    // Counter-Rotating 3D Star Tetrahedron (Merkaba)
    vec3 pUp = p;
    vec3 pDown = p;
    float rotSpeed = timeFlow * (0.75 + u_speed * 0.35) + u_bassCumulative * 0.45;
    pUp.xz *= rotate2D(rotSpeed);
    pUp.xy *= rotate2D(timeFlow * 0.22 + u_mid * 0.3);

    pDown.xz *= rotate2D(-rotSpeed * 1.08);
    pDown.xy *= rotate2D(-timeFlow * 0.22 - u_mid * 0.3);
    pDown.y = -pDown.y;

    float breath = 0.88 + 0.14 * sin(u_bpmPhase * 6.2831853) + u_kickTransient * 0.18;
    float dTetUp = sdSmoothTetrahedron(pUp, breath, smoothN);
    float dTetDown = sdSmoothTetrahedron(pDown, breath, smoothN);
    float dMerkaba = smin(dTetUp, dTetDown, 0.045);

    vec3 pa = almostIdentity3(pUp, smoothN);
    float coreSphere = abs(length(p) - 0.42 * breath) - 0.025;
    float facetCut = -(length(pa.xy) - 0.16);
    dMerkaba = min(max(dMerkaba, facetCut * 0.45), coreSphere);

    trap = min(trap, abs(dTetUp - dTetDown));
    dResult = mix(dResult, dMerkaba, stage5Weight);
  }

  return vec2(dResult, trap);
}

// Evaluates 2D/2.5D Sacred Geometry Filigree across all 6 Creation Stages
// Returns vec3(filigreeIntensity, ringEdgeMask, goldenSeedGlow)
vec3 evaluateSacredCreationFiligree(vec2 p, float stageF, float timeFlow) {
  float r = length(p);
  float a = atan(p.y, p.x);
  float bpmPulse = sin(u_bpmPhase * 6.2831853);
  float kickBurst = expImpulse(u_kickTransient + u_subBass * 0.38, 3.4);

  float w1 = 1.0 - smoothstep(1.0, 2.15, stageF);
  float w2 = smoothstep(1.1, 2.0, stageF) * (1.0 - smoothstep(2.0, 3.2, stageF));
  float w3 = smoothstep(2.0, 3.0, stageF) * (1.0 - smoothstep(3.0, 4.3, stageF));
  float w4 = smoothstep(3.0, 4.0, stageF) * (1.0 - smoothstep(4.0, 5.2, stageF));
  float w5 = smoothstep(4.0, 5.0, stageF) * (1.0 - smoothstep(5.0, 6.0, stageF));
  float w6 = smoothstep(4.85, 6.0, stageF);

  float filigree = 0.0;
  float edgeMask = 0.0;
  float seedGlow = 0.0;

  // STAGE 1: FIAT LUX & VESICA PISCIS (The Constructional Seed)
  if (w1 > 0.005) {
    float sep = (0.34 + 0.08 * sin(timeFlow * 0.65) + kickBurst * 0.07) * smoothstep(0.0, 1.0, 0.65 + 0.35 * sin(timeFlow * 0.4));
    float radV = 0.68 + 0.04 * bpmPulse;
    float cLeft = abs(length(p - vec2(-sep, 0.0)) - radV);
    float cRight = abs(length(p - vec2(sep, 0.0)) - radV);
    float vesicaMandorla = max(length(p - vec2(-sep, 0.0)) - radV, length(p - vec2(sep, 0.0)) - radV);
    float vesicaRim = abs(vesicaMandorla);

    float lineGlow = 0.008 / (0.005 + min(cLeft, cRight)) + 0.011 / (0.004 + vesicaRim);
    float fiatCore = exp(-r * r * (7.5 - kickBurst * 3.2)) * (1.4 + kickBurst * 1.2);
    filigree += w1 * (lineGlow * 0.85 + fiatCore);
    edgeMask += w1 * smoothstep(0.03, 0.0, min(cLeft, cRight));
    seedGlow += w1 * fiatCore;
  }

  // STAGE 2: 7-CIRCLE SEED OF LIFE & 6-FOLD HEXAGONAL FLOWER OF LIFE LATTICE
  if (w2 + w3 > 0.005) {
    float radF = 0.38 + 0.025 * bpmPulse;
    float dSeed = abs(r - radF);
    float sector6 = 1.04719755; // PI / 3
    float a6 = mod(a + timeFlow * 0.12 + 0.5 * sector6, sector6) - 0.5 * sector6;
    vec2 p6 = vec2(cos(a6), sin(a6)) * r;

    float dRing1 = abs(length(p6 - vec2(radF, 0.0)) - radF);
    float dRing2 = abs(length(p6 - vec2(radF * 1.7320508, 0.0)) - radF);
    float dRing3 = abs(length(p6 - vec2(radF * 2.0, 0.0)) - radF);
    vec2 hexP = p / max(radF, 0.1);
    const vec2 sHex = vec2(1.0, 1.7320508);
    vec2 hA = mod(hexP, sHex) - 0.5 * sHex;
    vec2 hB = mod(hexP - 0.5 * sHex, sHex) - 0.5 * sHex;
    vec2 hexLocal = (dot(hA, hA) < dot(hB, hB)) ? hA : hB;
    float dHexFlower = abs(length(hexLocal) - 1.0) * radF;

    float dFlower = min(min(dSeed, dRing1), min(dRing2, min(dRing3, dHexFlower)));
    float outerHalo = abs(r - radF * 3.05);
    float flowerGlow = 0.0075 / (0.004 + dFlower) + 0.009 / (0.004 + outerHalo);
    filigree += (w2 + w3 * 0.55) * flowerGlow;
    edgeMask += (w2 + w3 * 0.55) * smoothstep(0.022, 0.0, min(dFlower, outerHalo));
  }

  // STAGE 3: 13-CIRCLE FRUIT OF LIFE & 78-FILAMENT METATRON'S CUBE
  if (w3 + w4 * 0.45 > 0.005) {
    float radM = 0.34;
    float sector6 = 1.04719755;
    float rotA = a - timeFlow * 0.14;
    float aFold = mod(rotA + 0.5 * sector6, sector6) - 0.5 * sector6;
    vec2 pf = vec2(cos(aFold), abs(sin(aFold))) * r;

    float dFruit0 = abs(r - radM * 0.52);
    float dFruit1 = abs(length(pf - vec2(radM * 1.45, 0.0)) - radM * 0.52);
    float dFruit2 = abs(length(pf - vec2(radM * 2.9, 0.0)) - radM * 0.52);
    float dFruits = min(dFruit0, min(dFruit1, dFruit2));

    vec2 vA = vec2(radM * 1.45, 0.0);
    vec2 vB = vec2(radM * 2.9, 0.0);
    vec2 vC = vec2(radM * 1.45 * 0.5, radM * 1.45 * 0.8660254);
    vec2 vD = vec2(radM * 2.9 * 0.5, radM * 2.9 * 0.8660254);
    vec2 vE = vec2(-radM * 1.45 * 0.5, radM * 1.45 * 0.8660254);
    vec2 vF = vec2(-radM * 2.9 * 0.5, radM * 2.9 * 0.8660254);

    float dChord1 = abs(pf.y);
    vec2 ba1 = vD - vA; float h1 = clamp(dot(pf - vA, ba1) / dot(ba1, ba1), 0.0, 1.0);
    float dChord2 = length((pf - vA) - ba1 * h1);
    vec2 ba2 = vB - vC; float h2 = clamp(dot(pf - vC, ba2) / dot(ba2, ba2), 0.0, 1.0);
    float dChord3 = length((pf - vC) - ba2 * h2);
    vec2 ba3 = vB - vE; float h3 = clamp(dot(pf - vE, ba3) / dot(ba3, ba3), 0.0, 1.0);
    float dChord4 = length((pf - vE) - ba3 * h3);
    vec2 ba4 = vD - vF; float h4 = clamp(dot(pf - vF, ba4) / dot(ba4, ba4), 0.0, 1.0);
    float dChord5 = length((pf - vF) - ba4 * h4);
    vec2 ba5 = vC - vE; float h5 = clamp(dot(pf - vE, ba5) / dot(ba5, ba5), 0.0, 1.0);
    float dChord6 = length((pf - vE) - ba5 * h5);

    float dMetatronLines = min(min(dChord1, dChord2), min(min(dChord3, dChord4), min(dChord5, dChord6)));
    dMetatronLines = max(dMetatronLines, r - radM * 3.05);

    float metatronGlow = 0.0065 / (0.0035 + dMetatronLines) + 0.007 / (0.004 + dFruits);
    filigree += (w3 + w4 * 0.45) * metatronGlow;
    edgeMask += (w3 + w4 * 0.45) * smoothstep(0.018, 0.0, min(dMetatronLines, dFruits));
  }

  // STAGE 5: 9-INTERLOCKING-TRIANGLE SRI YANTRA HALO & CENTRAL BINDU
  if (w5 > 0.005) {
    float dSri = 10.0;
    vec2 ps = p * rotate2D(timeFlow * 0.08);
    for (int i = 0; i < 9; i++) {
      float fi = float(i);
      float signDir = (mod(fi, 2.0) < 0.5) ? 1.0 : -1.0;
      float triScale = 0.24 + fi * 0.085;
      vec2 pt = vec2(ps.x, ps.y * signDir + (fi - 4.0) * 0.018);
      const float kTri = 1.7320508;
      pt.x = abs(pt.x) - triScale;
      pt.y = pt.y + triScale / kTri;
      if (pt.x + kTri * pt.y > 0.0) {
        pt = vec2(pt.x - kTri * pt.y, -kTri * pt.x - pt.y) * 0.5;
      }
      pt.x -= clamp(pt.x, -2.0 * triScale, 0.0);
      float dTri = -length(pt) * sign(pt.y);
      dSri = min(dSri, abs(dTri));
    }
    float petalMod = 0.045 * abs(sin(a * 8.0 + timeFlow * 0.3));
    float dLotus = min(abs(r - (1.02 + petalMod)), abs(r - (1.16 + petalMod * 1.2)));
    float dBindu = r;
    float sriGlow = 0.006 / (0.0035 + min(dSri, dLotus)) + exp(-dBindu * dBindu * 90.0) * 1.6;
    filigree += w5 * sriGlow;
    edgeMask += w5 * smoothstep(0.016, 0.0, min(dSri, dLotus));
  }

  // STAGE 6: LIVING GOLDEN-RATIO COSMOS (Logarithmic Golden Spirals & 137.5° Phyllotaxis)
  if (w6 > 0.005) {
    const float PHI = 1.6180339887;
    const float LOG_PHI_2_PI = 0.3063489;
    float rSafe = max(r, 1e-4);

    // Polar Logarithmic Golden Spiral: r(theta) = a * pow(1.6180339887, 2.0 * theta / PI)
    float spiralPhase1 = (log(rSafe) / LOG_PHI_2_PI) - a - timeFlow * 0.85;
    float spiralPhase2 = (log(rSafe) / LOG_PHI_2_PI) + a * PHI - timeFlow * 0.65;
    float dSpiral = min(
      abs(sin(spiralPhase1 * 1.5)) * rSafe * 0.35,
      abs(sin(spiralPhase2 * 2.5)) * rSafe * 0.28
    );

    // 137.507764° Golden-Angle (2.39996323 rad) Sunflower Phyllotaxis Star-Seeds
    const float GOLDEN_ANGLE = 2.39996323;
    float seedDensity = 42.0 + u_bass * 14.0;
    float approxN = clamp(floor(r * r * seedDensity), 1.0, 220.0);
    float minSeedDist = 10.0;
    for (int k = -3; k <= 3; k++) {
      float n = max(1.0, approxN + float(k));
      float seedTheta = n * GOLDEN_ANGLE + timeFlow * 0.25 + sin(n * 0.1 + u_time) * 0.04;
      vec2 seedPos = sqrt(n / seedDensity) * vec2(cos(seedTheta), sin(seedTheta));
      minSeedDist = min(minSeedDist, length(p - seedPos));
    }

    float phyllotaxisSeeds = exp(-minSeedDist * minSeedDist * 1150.0) * (1.35 + u_hiHatSparkle * 0.9);
    float goldenSpiralGlow = 0.0065 / (0.004 + dSpiral);

    filigree += w6 * (goldenSpiralGlow * 0.85 + phyllotaxisSeeds * 1.45);
    edgeMask += w6 * smoothstep(0.02, 0.0, min(dSpiral, minSeedDist - 0.015));
    seedGlow += w6 * phyllotaxisSeeds;
  }

  return vec3(filigree, clamp(edgeMask, 0.0, 1.0), seedGlow);
}

vec3 renderMode26_DivineCreation(vec2 uv, vec2 rawUv) {
  float dirSign = (abs(u_zoomDirection) < 0.05) ? 1.0 : u_zoomDirection;
  float timeFlow = (u_time * u_speed * 0.55 + u_bassCumulative * 0.38) * dirSign;

  float stageF = (u_divineStage >= 1 && u_divineStage <= 6)
    ? float(u_divineStage)
    : 1.0 + mod(u_time * 0.11 + u_bassCumulative * 0.08, 6.0);

  if (u_divineStage == 0 && stageF > 6.0) {
    stageF = mix(6.0, 1.0, stageF - 6.0);
  }

  vec2 p = (uv + u_cameraOrbit * 0.35 + u_cameraLateral * 0.2) / max(0.45, u_cameraZoom);
  p *= rotate2D(u_cameraRoll * 0.5);

  float creationBurst = expImpulse(u_kickTransient + u_subBass * 0.35, 3.2);

  vec3 sacred2D = evaluateSacredCreationFiligree(p, stageF, timeFlow);
  float filigreeIntensity = sacred2D.x;
  float occlusionRim = sacred2D.y;
  float goldenSeeds = sacred2D.z;

  float stage4W = smoothstep(2.6, 3.8, stageF) * (1.0 - smoothstep(4.6, 5.6, stageF));
  float stage5W = smoothstep(4.1, 4.9, stageF) * (1.0 - smoothstep(5.5, 6.3, stageF));
  if (u_divineStage == 4) { stage4W = 1.0; stage5W = 0.0; }
  if (u_divineStage == 5) { stage4W = 0.25; stage5W = 1.0; }

  vec3 solidCol = vec3(0.0);
  float solidHitMask = 0.0;
  float volumetric3DGlow = 0.0;

  if (stage4W + stage5W > 0.02) {
    vec3 ro = vec3(u_cameraLateral * 0.2, -2.35 / max(0.5, u_cameraZoom));
    vec3 rd = normalize(vec3(p, 1.35));
    float t = 0.15;
    float hitTrap = 0.0;
    bool hit = false;

    for (int i = 0; i < 52; i++) {
      vec3 pos = ro + rd * t;
      vec2 res = mapDivinePlatonicAndMerkaba(pos, stage4W, stage5W, timeFlow);
      float d = res.x;
      volumetric3DGlow += 0.014 / (0.015 + abs(d) * 12.0);
      if (d < 0.002) {
        hit = true;
        hitTrap = res.y;
        break;
      }
      if (t > 5.0) break;
      t += max(d * 0.78, 0.012);
    }

    if (hit) {
      solidHitMask = 1.0;
      vec3 pos = ro + rd * t;
      vec2 e = vec2(0.0025, 0.0);
      vec3 n = normalize(vec3(
        mapDivinePlatonicAndMerkaba(pos + e.xyy, stage4W, stage5W, timeFlow).x - mapDivinePlatonicAndMerkaba(pos - e.xyy, stage4W, stage5W, timeFlow).x,
        mapDivinePlatonicAndMerkaba(pos + e.yxy, stage4W, stage5W, timeFlow).x - mapDivinePlatonicAndMerkaba(pos - e.yxy, stage4W, stage5W, timeFlow).x,
        mapDivinePlatonicAndMerkaba(pos + e.yyx, stage4W, stage5W, timeFlow).x - mapDivinePlatonicAndMerkaba(pos - e.yyx, stage4W, stage5W, timeFlow).x
      ));
      vec3 lightDir = normalize(vec3(0.35, 0.65, -0.75));
      float diff = max(dot(n, lightDir), 0.0);
      float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
      float spec = pow(max(dot(reflect(-lightDir, n), -rd), 0.0), 28.0);

      vec3 crystalTint = palette(hitTrap * 1.4 + u_time * 0.1 + u_pitchHue, u_palA, u_palB, u_palC, u_palD);
      vec3 goldAccent = vec3(1.0, 0.86, 0.52);
      solidCol = mix(crystalTint, goldAccent, 0.35) * (0.28 + diff * 0.85) +
                 goldAccent * fresnel * (0.75 + creationBurst * 0.6) +
                 vec3(1.0, 0.97, 0.88) * spec * 0.7;
    }
  }

  vec3 palBase = palette(length(p) * 0.45 - timeFlow * 0.12 + u_pitchHue, u_palA, u_palB, u_palC, u_palD);
  vec3 celestialGold = mix(vec3(1.0, 0.88, 0.56), palBase * 1.35, 0.45);
  vec3 pureLight = vec3(1.0, 0.97, 0.9);

  vec3 col = palBase * 0.08 * exp(-length(p) * 0.65);
  col += celestialGold * filigreeIntensity * (0.68 + u_clarity * 0.22);
  col += pureLight * goldenSeeds * 0.85;
  col += mix(celestialGold, palBase, 0.5) * volumetric3DGlow * 0.45;
  col = mix(col, solidCol + celestialGold * filigreeIntensity * 0.35, solidHitMask * 0.88);

  // Volumetric Crepuscular God Rays (Beer-Lambert + Henyey-Greenstein Phase Scattering)
  vec2 lightPos = -u_cameraOrbit * 0.25;
  vec2 deltaTextCoord = (p - lightPos) * (clamp(u_godRayDensity, 0.2, 1.5) / 24.0);
  vec2 samplePos = p;
  float illuminationDecay = 1.0;
  float godRayAccum = 0.0;
  float sigmaT = 0.45 + u_cloudDensity * 0.35;

  for (int s = 0; s < 24; s++) {
    samplePos -= deltaTextCoord;
    float dToSource = length(samplePos - lightPos);
    float transmittance = exp(-sigmaT * dToSource);
    float cosTheta = clamp(1.0 - dToSource * 0.42, -1.0, 1.0);
    float hg = phaseHG(cosTheta, 0.76);

    float radialBurst = 0.5 + 0.5 * cos(atan(samplePos.y - lightPos.y, samplePos.x - lightPos.x) * 12.0 + timeFlow * 0.7);
    float ringSlits = smoothstep(0.02, 0.14, abs(sin(dToSource * 9.42477 - timeFlow * 1.2)));
    float sampleLight = exp(-dToSource * dToSource * 2.8) * (0.65 + 0.55 * radialBurst) * ringSlits;

    godRayAccum += sampleLight * transmittance * hg * illuminationDecay * clamp(u_godRayWeight, 0.05, 1.0);
    illuminationDecay *= clamp(u_godRayDecay, 0.92, 0.99);
  }

  float rayOcclusion = 1.0 - 0.35 * solidHitMask * (1.0 - occlusionRim);
  float rayPower = godRayAccum * rayOcclusion * clamp(u_godRayExposure, 0.1, 2.0) *
                   max(0.25, u_godRayIntensity) * (0.42 + creationBurst * 0.45 + u_bass * 0.28);

  vec3 rayColor = mix(celestialGold, pureLight, clamp(rayPower * 0.45, 0.0, 1.0));
  col += rayColor * rayPower;

  if (u_hasTexture && u_textureMappingMode != 3) {
    vec4 userImg = sampleMultiImagePair(p * u_trapScale);
    col = mix(col, userImg.rgb * (0.85 + rayPower * 0.75) + celestialGold * filigreeIntensity * 0.4, clamp(u_textureMix * 0.65, 0.0, 0.85));
  }

  vec2 fbUv = clamp((rawUv - 0.5) * (0.992 - u_kickTransient * 0.008) + 0.5, 0.002, 0.998);
  vec3 prev = texture2D(u_prevFrame, fbUv).rgb;
  return mix(col, prev, clamp(u_feedbackTrail * 0.28, 0.05, 0.42));
}

// ============================================================================
// GLOBAL "DIVINE CREATION LIGHT SCULPTOR" FX LAYER (SHAPES ALL 27 MODES)
// ============================================================================
vec3 applyGlobalDivineCreationSculptor(vec3 baseCol, vec2 uv, vec2 rawUv) {
  vec3 col = baseCol;
  float timeFlow = u_time * u_speed * 0.5 + u_bassCumulative * 0.35;
  float creationBurst = expImpulse(u_kickTransient + u_subBass * 0.35, 3.2);
  vec3 palGold = mix(
    vec3(1.0, 0.88, 0.55),
    palette(length(uv) * 0.35 + u_time * 0.08 + u_pitchHue, u_palA, u_palB, u_palC, u_palD),
    0.45
  );

  // 1. Global Golden-Ratio & Sacred Geometry Halo Overlay (Modes 0..24)
  if (u_sacredHaloEnabled && u_sacredFiligreeMix > 0.01 && u_fractalMode != 25) {
    float activeStage = (u_divineStage >= 1 && u_divineStage <= 6)
      ? float(u_divineStage)
      : 1.0 + mod(u_time * 0.12 + u_bassCumulative * 0.1, 6.0);
    vec3 haloData = evaluateSacredCreationFiligree(uv / max(0.5, u_cameraZoom), activeStage, timeFlow);
    vec3 haloCol = palGold * haloData.x * 0.65 + vec3(1.0, 0.96, 0.86) * haloData.z * 0.75;
    col += haloCol * clamp(u_sacredFiligreeMix, 0.0, 1.0) * (0.75 + creationBurst * 0.45);
  }

  // 2. Global Volumetric Crepuscular God Rays (Modes 0..24)
  if (u_divineGodRays && u_godRayIntensity > 0.01 && u_fractalMode != 25) {
    vec2 lightPos = -u_cameraOrbit * 0.25;
    vec2 deltaCoord = (uv - lightPos) * (clamp(u_godRayDensity, 0.2, 1.5) / 18.0);
    vec2 sampleUv = uv;
    float decay = 1.0;
    float raySum = 0.0;
    float sigmaT = 0.48 + u_cloudDensity * 0.3;
    float pixelLuma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    float silhouetteGate = mix(0.55, 1.25, smoothstep(0.08, 0.75, pixelLuma));

    for (int s = 0; s < 18; s++) {
      sampleUv -= deltaCoord;
      float dL = length(sampleUv - lightPos);
      float T = exp(-sigmaT * dL);
      float hg = phaseHG(clamp(1.0 - dL * 0.45, -1.0, 1.0), 0.76);
      float rayAng = atan(sampleUv.y - lightPos.y, sampleUv.x - lightPos.x);
      float shaftMod = 0.55 + 0.45 * cos(rayAng * 10.0 + timeFlow * 0.65) * sin(dL * 6.0 - timeFlow);
      float coreEmit = exp(-dL * dL * 2.4) * shaftMod;
      raySum += coreEmit * T * hg * decay * clamp(u_godRayWeight, 0.05, 1.0);
      decay *= clamp(u_godRayDecay, 0.92, 0.99);
    }

    float godRayBoost = raySum * silhouetteGate * clamp(u_godRayIntensity, 0.0, 1.5) *
                        clamp(u_godRayExposure, 0.1, 2.0) * (0.38 + creationBurst * 0.42 + u_bass * 0.25);
    col += mix(palGold, vec3(1.0, 0.97, 0.9), 0.38) * godRayBoost;
  }

  return col;
}

vec3 evaluateFractalMode(vec2 uv, vec2 rawUv, int mode) {
  #if defined(LOCKED_FRACTAL_MODE)
    #if LOCKED_FRACTAL_MODE == 1
      return renderMode1_DmtKaleidoscope(uv, rawUv);
    #elif LOCKED_FRACTAL_MODE == 2
      return renderMode2_BassNationReactor(uv);
    #elif LOCKED_FRACTAL_MODE == 7
      return renderMode7_JuliaBurningShip(uv);
    #elif LOCKED_FRACTAL_MODE == 8
      return renderMode8_CymaticFeedback(uv, rawUv);
    #elif LOCKED_FRACTAL_MODE == 9
      return renderMode9_ZenosParadox(uv, rawUv);
    #elif LOCKED_FRACTAL_MODE == 10
      return renderMode10_MultiImage3DFractal(uv, rawUv);
    #elif LOCKED_FRACTAL_MODE == 11
      return renderMode11_KluverCorticalV1(uv, rawUv);
    #elif LOCKED_FRACTAL_MODE == 12
      return renderMode12_NonEuclideanSpaces(uv, rawUv);
    #elif LOCKED_FRACTAL_MODE == 13
      return renderMode13_IndrasPearls(uv, rawUv);
    #elif LOCKED_FRACTAL_MODE == 14
      return renderMode14_HopfFibration4D(uv, rawUv);
    #elif LOCKED_FRACTAL_MODE == 15
      return renderMode15_RelativisticBlackHole(uv, rawUv);
    #elif LOCKED_FRACTAL_MODE == 16
      return renderMode16_KaliStarNest(uv, rawUv);
    #elif LOCKED_FRACTAL_MODE == 17
      return renderMode17_GyroidLabyrinth(uv, rawUv);
    #elif LOCKED_FRACTAL_MODE == 18
      return renderMode18_TokamakAndQuantumOrbitals(uv, rawUv);
    #elif LOCKED_FRACTAL_MODE == 19
      return renderMode19_MercuryFerrofluid(uv, rawUv);
    #elif LOCKED_FRACTAL_MODE == 20
      return renderMode20_PhysarumNeuralNet(uv, rawUv);
    #elif LOCKED_FRACTAL_MODE == 21
      return renderMode21_StrangeAttractors(uv, rawUv);
    #elif LOCKED_FRACTAL_MODE == 22
      return renderMode22_QuasicrystalPenrose(uv, rawUv);
    #elif LOCKED_FRACTAL_MODE == 23
      return renderMode23_NewtonNovaBasins(uv, rawUv);
    #elif LOCKED_FRACTAL_MODE == 24
      return renderMode24_OpArtPleochroicOscilloscope(uv, rawUv);
    #elif LOCKED_FRACTAL_MODE == 25
      return renderMode26_DivineCreation(uv, rawUv);
    #else
      return render3DMode(uv, LOCKED_FRACTAL_MODE);
    #endif
  #else
  if (mode == 1) {
    return renderMode1_DmtKaleidoscope(uv, rawUv);
  } else if (mode == 2) {
    return renderMode2_BassNationReactor(uv);
  } else if (mode == 7) {
    return renderMode7_JuliaBurningShip(uv);
  } else if (mode == 8) {
    return renderMode8_CymaticFeedback(uv, rawUv);
  } else if (mode == 9) {
    return renderMode9_ZenosParadox(uv, rawUv);
  } else if (mode == 10) {
    return renderMode10_MultiImage3DFractal(uv, rawUv);
  } else if (mode == 11) {
    return renderMode11_KluverCorticalV1(uv, rawUv);
  } else if (mode == 12) {
    return renderMode12_NonEuclideanSpaces(uv, rawUv);
  } else if (mode == 13) {
    return renderMode13_IndrasPearls(uv, rawUv);
  } else if (mode == 14) {
    return renderMode14_HopfFibration4D(uv, rawUv);
  } else if (mode == 15) {
    return renderMode15_RelativisticBlackHole(uv, rawUv);
  } else if (mode == 16) {
    return renderMode16_KaliStarNest(uv, rawUv);
  } else if (mode == 17) {
    return renderMode17_GyroidLabyrinth(uv, rawUv);
  } else if (mode == 18) {
    return renderMode18_TokamakAndQuantumOrbitals(uv, rawUv);
  } else if (mode == 19) {
    return renderMode19_MercuryFerrofluid(uv, rawUv);
  } else if (mode == 20) {
    return renderMode20_PhysarumNeuralNet(uv, rawUv);
  } else if (mode == 21) {
    return renderMode21_StrangeAttractors(uv, rawUv);
  } else if (mode == 22) {
    return renderMode22_QuasicrystalPenrose(uv, rawUv);
  } else if (mode == 23) {
    return renderMode23_NewtonNovaBasins(uv, rawUv);
  } else if (mode == 24) {
    return renderMode24_OpArtPleochroicOscilloscope(uv, rawUv);
  } else if (mode == 25) {
    return renderMode26_DivineCreation(uv, rawUv);
  }
  return render3DMode(uv, mode);
  #endif
}

void main() {
  vec2 rawUv = vUv;

  if (u_glitchActive || u_snareTransient > 0.78) {
    float slice = floor(rawUv.y * 28.0);
    float shift = sin(slice * 12.9898 + u_time * 45.0) * 0.022 * (u_glitchActive ? 1.0 : u_snareTransient);
    rawUv.x = fract(rawUv.x + shift);
  }

  vec2 uv = (rawUv - 0.5) * 2.0;
  uv.x *= u_resolution.x / max(u_resolution.y, 1.0);

  // Sub-Bass Directional Camera Shake in non-Bass-Nation modes when cameraShake > 0
  if (u_fractalMode != 2 && u_cameraShake > 0.01) {
    float sh = (u_subBass * 0.014 + u_kickTransient * 0.022) * u_cameraShake;
    uv += vec2(sin(u_time * 39.0), cos(u_time * 33.0)) * sh;
  }

  // Mirror X / Y toggles
  vec2 kaleidoUv = uv;
  if (u_mirrorX) kaleidoUv.x = abs(kaleidoUv.x);
  if (u_mirrorY) kaleidoUv.y = abs(kaleidoUv.y);

  // Kaleidoscope Polar Mirror Slicer (1..24 slices + Snare angle jump)
  if (u_kaleidoSlices > 1.5 && u_fractalMode != 2) {
    float r = length(kaleidoUv);
    float a = atan(kaleidoUv.y, kaleidoUv.x) + u_mirrorPhase * 0.523598;
    float sector = 6.2831853 / u_kaleidoSlices;
    a = mod(a, sector);
    a = abs(a - 0.5 * sector);
    kaleidoUv = vec2(cos(a), sin(a)) * r;
  } else if (u_mirrorPhase > 1.5 && u_snareTransient > 0.35 && u_fractalMode != 2) {
    kaleidoUv.x = mix(kaleidoUv.x, abs(kaleidoUv.x) - 0.35, u_snareTransient * 0.5);
  }

  // Single-call evaluation prevents 2x full-shader AST duplication at gl.linkProgram time
  vec3 col = evaluateFractalMode(kaleidoUv, rawUv, u_fractalMode);
  if (u_morph < 0.999 && u_prevFractalMode != u_fractalMode) {
    vec3 prevBufferCol = texture2D(u_prevFrame, rawUv).rgb;
    col = mix(prevBufferCol, col, smoothstep(0.0, 1.0, u_morph));
  }

  // Optional Center Bass Emblem & Spectrum Ring Overlay when u_textureMappingMode == 3 and u_hasTexture is true
  if (u_fractalMode != 2 && u_textureMappingMode == 3 && u_hasTexture && u_textureMix > 0.02) {
    vec4 emblemOverlay = computeBassEmblemAndSpectrumLayer(uv);
    col = mix(col, col * 0.35 + emblemOverlay.rgb, emblemOverlay.a * clamp(u_textureMix, 0.0, 1.0));
  }

  // Global Divine Creation Light Sculptor (Volumetric Crepuscular God Rays & Sacred Geometry Halo across all 27 modes)
  if (u_divineGodRays || u_sacredHaloEnabled) {
    col = applyGlobalDivineCreationSculptor(col, kaleidoUv, rawUv);
  }

  // Post-Processing: Controlled Bloom Highlights with Anti-Mud Clarity Threshold
  float bloomThreshold = mix(0.52, 0.68, clamp(u_clarity * 0.5, 0.0, 1.0));
  vec3 bloom = max(col - bloomThreshold, vec3(0.0)) * (u_bloomIntensity * 0.40 + u_kickTransient * 0.35 + min(0.3, u_fractalSpike * 0.14));
  col += bloom * 0.52;

  // Radial Chromatic Aberration Spike on Transients
  float caAmount = u_chromaticAberration + u_kickTransient * 0.006 + min(0.005, u_fractalSpike * 0.002);
  float distFromCenter = length(rawUv - 0.5);
  col.r = mix(col.r, col.r * (1.0 + caAmount * 35.0 * distFromCenter), 0.65);
  col.b = mix(col.b, col.b * (1.0 - caAmount * 28.0 * distFromCenter) + bloom.b * 0.25, 0.65);

  // ACES Filmic Tone Mapping (prevents neon channel clipping into muddy white)
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);

  // Clarity Micro-Contrast S-Curve & Global Meta Controls
  float clarityContrast = u_metaContrast * (0.88 + clamp(u_clarity, 0.0, 2.0) * 0.12);
  col = (col - 0.5) * clarityContrast + 0.5;
  col *= u_metaBrightness;
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(luma), col, u_metaSaturation);
  col = pow(clamp(col, 0.0, 1.0), vec3(max(0.4, u_metaGamma)));
  if (u_colorInvert) {
    col = 1.0 - col;
  }

  // Film Grain & Vignette
  float grain = fract(sin(dot(rawUv * (u_time + 1.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  col += grain * u_filmGrain * 0.12;

  float vig = smoothstep(1.25, 0.25, distFromCenter * (0.85 + u_vignetteDarkness * 0.55));
  col *= mix(1.0, vig, u_vignetteDarkness * 0.8);

  if (u_glitchActive) {
    float scanline = 0.88 + 0.12 * sin(rawUv.y * 180.0);
    col *= scanline;
    col.rb = col.br;
  }

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export function buildFractalFragmentShader(
  gpuHeavyMode = true,
  lockedFractalMode?: number | null
): string {
  const precisionHeader = gpuHeavyMode
    ? /* glsl */ `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
precision highp int;
#else
precision highp float;
precision highp int;
#endif
#define GPU_HEAVY_PRECISION 1`
    : /* glsl */ `precision mediump float;
precision mediump int;`;

  const modeDefine =
    typeof lockedFractalMode === 'number' &&
    Number.isFinite(lockedFractalMode) &&
    lockedFractalMode >= 0 &&
    lockedFractalMode <= 25
      ? `\n#define LOCKED_FRACTAL_MODE ${Math.round(lockedFractalMode)}`
      : '';

  return `${precisionHeader}${modeDefine}\n${FRACTAL_FRAGMENT_BODY}`;
}

/**
 * Returns the standalone `#version 300 es` WebGL2 Fragment Shader (with `in vec2 vUv`,
 * `out vec4 outFragColor`, and `texture()`) for the isolated `gl.readPixels()` -> Binary `Uint8Array`
 * `VideoFrame` video exporter.
 */
export function buildStandaloneWebGl2FragmentShader(
  gpuHeavyMode = true,
  lockedFractalMode?: number | null
): string {
  const base = buildFractalFragmentShader(gpuHeavyMode, lockedFractalMode);
  const es300Body = base
    .replace(/varying\s+vec2\s+vUv\s*;/g, 'in vec2 vUv;\nout vec4 outFragColor;')
    .replace(/\btexture2D\s*\(/g, 'texture(')
    .replace(/\bgl_FragColor\b/g, 'outFragColor');
  return `#version 300 es\n${es300Body}`;
}

export const FRACTAL_FRAGMENT_SHADER = buildFractalFragmentShader(true);

export const UPSCALE_CAS_FRAGMENT_SHADER = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tDiffuse;
uniform vec2 u_sourceTexelSize;
uniform float u_sharpness;
uniform bool u_fastUpscale;

void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  if (u_fastUpscale || u_sharpness <= 0.01) {
    vec3 contrasted = mix(c, smoothstep(0.02, 0.98, c), 0.18);
    gl_FragColor = vec4(clamp(contrasted, 0.0, 1.0), 1.0);
    return;
  }

  vec3 n = texture2D(tDiffuse, vUv + vec2(0.0, -u_sourceTexelSize.y)).rgb;
  vec3 s = texture2D(tDiffuse, vUv + vec2(0.0,  u_sourceTexelSize.y)).rgb;
  vec3 w = texture2D(tDiffuse, vUv + vec2(-u_sourceTexelSize.x, 0.0)).rgb;
  vec3 e = texture2D(tDiffuse, vUv + vec2( u_sourceTexelSize.x, 0.0)).rgb;

  vec3 minRGB = min(min(min(n, s), min(w, e)), c);
  vec3 maxRGB = max(max(max(n, s), max(w, e)), c);

  vec3 amp = clamp(min(minRGB, 1.0 - maxRGB) / max(maxRGB, vec3(1e-4)), 0.0, 1.0);
  amp = sqrt(amp);
  vec3 weight = -amp * (0.125 * clamp(u_sharpness, 0.0, 1.0));

  vec3 sharpened = (c + (n + s + w + e) * weight) / max(vec3(0.001), 1.0 + 4.0 * weight);
  gl_FragColor = vec4(clamp(sharpened, 0.0, 1.0), 1.0);
}
`;
