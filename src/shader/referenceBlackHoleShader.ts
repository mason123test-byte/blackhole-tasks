// Kerr null-geodesic equations follow Pu, Yun, Younsi & Yoon's public Odyssey GPU tracer.
// Gargantua presentation follows James, von Tunzelmann, Franklin & Thorne (2015).
// Application interaction and WebGL lifecycle stay in blackHoleRenderer.ts.
export const REFERENCE_BLACK_HOLE_VERTEX = `#version 300 es
in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export const REFERENCE_BLACK_HOLE_FRAGMENT = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_expanded;
uniform sampler2D u_scene_texture;
uniform float u_scene_ready;
uniform float u_visual_compare;

#define PI 3.14159265359
#define B_CRIT 5.1961524
#define N_STEPS 112

const float KERR_A = 0.60;
const float KERR_A2 = KERR_A * KERR_A;
const float KERR_HORIZON = 1.80;
const float OBSERVER_R = 28.0;
const float OBSERVER_THETA = 1.50;

const float DISK_INNER = 3.6;
const float DISK_OUTER = 16.0;
const float STAR_GAIN = 0.0;
const float DILATION_MIN = 0.20;
const float GARGANTUA_DOPPLER_MIX = 0.0;
const float GARGANTUA_DISK_TEMP = 4500.0;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float vnoiseWrapY(vec2 p, float periodY) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float y0 = mod(i.y, periodY);
  float y1 = mod(i.y + 1.0, periodY);
  return mix(
    mix(hash21(vec2(i.x, y0)), hash21(vec2(i.x + 1.0, y0)), f.x),
    mix(hash21(vec2(i.x, y1)), hash21(vec2(i.x + 1.0, y1)), f.x),
    f.y
  );
}

vec3 blackbody(float temperature) {
  float t = clamp(temperature, 1500.0, 40000.0) / 100.0;
  float r = t <= 66.0 ? 1.0 : clamp(1.292936 * pow(t - 60.0, -0.1332047), 0.0, 1.0);
  float g = t <= 66.0
    ? clamp(0.3900816 * log(t) - 0.6318414, 0.0, 1.0)
    : clamp(1.1298909 * pow(t - 60.0, -0.0755148), 0.0, 1.0);
  float b = t >= 66.0
    ? 1.0
    : (t <= 19.0 ? 0.0 : clamp(0.5432068 * log(t - 10.0) - 1.1962540, 0.0, 1.0));
  return vec3(r, g, b);
}

float diskStreakSample(float diskRadius, float turns, float swirl) {
  return vnoiseWrapY(vec2(diskRadius * 1.55, turns * 19.0 + swirl * 3.0), 19.0) * 0.65
    + vnoiseWrapY(vec2(diskRadius * 0.55, turns * 9.0 + swirl * 1.5 + 7.0), 9.0) * 0.35;
}

void kerrDerivatives(
  float r,
  float theta,
  float pr,
  float ptheta,
  float L,
  float kappa,
  out float dr,
  out float dtheta,
  out float dphi,
  out float dpr,
  out float dptheta
) {
  float r2 = r * r;
  float twoR = 2.0 * r;
  float safeSin = max(abs(sin(theta)), 1e-5);
  float cosTheta = cos(theta);
  float sin2 = safeSin * safeSin;
  float sigma = r2 + KERR_A2 * cosTheta * cosTheta;
  float delta = max(r2 - twoR + KERR_A2, 1e-5);
  float sigmaDelta = sigma * delta;

  dr = -pr * delta / sigma;
  dtheta = -ptheta / sigma;
  dphi = -(twoR * KERR_A + (sigma - twoR) * L / sin2) / sigmaDelta;
  dpr = -(
    (((r - 1.0) * (-kappa) + twoR * (r2 + KERR_A2) - 2.0 * KERR_A * L) / sigmaDelta)
    - 2.0 * pr * pr * (r - 1.0) / sigma
  );
  dptheta = -safeSin * cosTheta * (L * L / (sin2 * sin2) - KERR_A2) / sigma;
}

void initKerrRay(
  float alpha,
  float beta,
  out float r,
  out float theta,
  out float phi,
  out float pr,
  out float ptheta,
  out float L,
  out float kappa
) {
  float observerSin = sin(OBSERVER_THETA);
  float observerCos = cos(OBSERVER_THETA);
  float imageX = sqrt(OBSERVER_R * OBSERVER_R + KERR_A2) * sin(OBSERVER_THETA) - beta * cos(OBSERVER_THETA);
  float imageY = alpha;
  float imageZ = OBSERVER_R * cos(OBSERVER_THETA) + beta * sin(OBSERVER_THETA);
  float u = imageX * imageX + imageY * imageY + imageZ * imageZ - KERR_A2;

  r = sqrt(max((u + sqrt(max(u * u + 4.0 * KERR_A2 * imageZ * imageZ, 0.0))) * 0.5, 1e-6));
  theta = acos(clamp(imageZ / max(r, 1e-6), -1.0, 1.0));
  phi = atan(imageY, imageX);

  float safeSin = max(abs(sin(theta)), 1e-5);
  float cosTheta = cos(theta);
  float sin2 = safeSin * safeSin;
  float sigma = r * r + KERR_A2 * cosTheta * cosTheta;
  float radialFrame = sqrt(KERR_A2 + r * r);
  float v = -observerSin * cos(phi);
  float zDot = -1.0;

  float rdot = zDot * (
    -radialFrame * radialFrame * observerCos * cosTheta
    + r * radialFrame * v * safeSin
  ) / sigma;
  float thetadot = zDot * (
    observerCos * r * safeSin
    + radialFrame * v * cosTheta
  ) / sigma;
  float phidot = zDot * observerSin * sin(phi) / max(radialFrame * safeSin, 1e-5);

  float delta = max(r * r - 2.0 * r + KERR_A2, 1e-5);
  float sigmaMinusTwoR = sigma - 2.0 * r;
  pr = rdot * sigma / delta;
  ptheta = thetadot * sigma;

  float energy2 = sigmaMinusTwoR * (rdot * rdot / delta + thetadot * thetadot)
    + delta * sin2 * phidot * phidot;
  float energy = sqrt(max(energy2, 1e-8));
  pr /= energy;
  ptheta /= energy;

  L = ((sigma * delta * phidot - 2.0 * KERR_A * r * energy) * sin2 / max(sigmaMinusTwoR, 1e-5)) / energy;
  kappa = ptheta * ptheta + KERR_A2 * sin2 + L * L / sin2;
}

void rayTracedReference() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 referenceUv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec2 screen = (referenceUv - 0.5) * vec2(aspect, 1.0);

  float candidateWeight = u_visual_compare < 0.5
    ? 0.0
    : (u_visual_compare > 1.5 ? step(0.0, screen.x) : 1.0);

  float shadowRadius = mix(0.112, 0.105, u_expanded);
  float worldScale = B_CRIT / shadowRadius;

  float alpha = screen.x * worldScale;
  float beta = -screen.y * worldScale;
  float baselineLowerWarp = (1.0 - candidateWeight)
    * smoothstep(0.0, shadowRadius * 0.65, screen.y)
    * (1.0 - smoothstep(shadowRadius * 3.6, shadowRadius * 5.2, length(screen)));
  beta *= mix(1.0, 1.20, baselineLowerWarp);

  vec4 sceneSample = u_scene_ready > 0.5
    ? texture(u_scene_texture, clamp(referenceUv, vec2(0.0), vec2(1.0)))
    : vec4(0.0);

  float impact = length(vec2(alpha, beta));
  if (impact > DISK_OUTER + 10.0) {
    outColor = sceneSample;
    return;
  }

  float r;
  float theta;
  float phi;
  float pr;
  float ptheta;
  float L;
  float kappa;
  initKerrRay(alpha, beta, r, theta, phi, pr, ptheta, L, kappa);

  float previousR = r;
  float previousPhi = phi;
  float previousSide = theta - 0.5 * PI;

  bool captured = false;
  bool diskHit = false;
  float hitRadius = 0.0;
  float hitPhi = 0.0;

  for (int i = 0; i < N_STEPS; i++) {
    if (r <= KERR_HORIZON + 0.015) {
      captured = true;
      break;
    }

    float dr0;
    float dtheta0;
    float dphi0;
    float dpr0;
    float dptheta0;
    kerrDerivatives(r, theta, pr, ptheta, L, kappa, dr0, dtheta0, dphi0, dpr0, dptheta0);

    if (r > OBSERVER_R + 2.0 && dr0 > 0.0) {
      break;
    }

    float nearHole = 1.0 - smoothstep(2.2, 8.0, r);
    float angularRefinement = clamp(abs(dphi0) * 0.45 + abs(dtheta0) * 1.5, 0.0, 3.0);
    float h = mix(0.44, 0.075, nearHole);
    h /= 1.0 + angularRefinement;
    h = clamp(h, 0.035, 0.44);

    float midR = r + 0.5 * h * dr0;
    float midTheta = clamp(theta + 0.5 * h * dtheta0, 1e-4, PI - 1e-4);
    float midPhi = phi + 0.5 * h * dphi0;
    float midPr = pr + 0.5 * h * dpr0;
    float midPtheta = ptheta + 0.5 * h * dptheta0;

    float dr1;
    float dtheta1;
    float dphi1;
    float dpr1;
    float dptheta1;
    kerrDerivatives(midR, midTheta, midPr, midPtheta, L, kappa, dr1, dtheta1, dphi1, dpr1, dptheta1);

    previousR = r;
    previousPhi = phi;

    r += h * dr1;
    theta = clamp(theta + h * dtheta1, 1e-4, PI - 1e-4);
    phi += h * dphi1;
    pr += h * dpr1;
    ptheta += h * dptheta1;

    float side = theta - 0.5 * PI;
    if (!diskHit && side * previousSide < 0.0) {
      float crossing = previousSide / (previousSide - side);
      float diskRadius = mix(previousR, r, crossing);
      if (diskRadius > DISK_INNER && diskRadius < DISK_OUTER) {
        hitRadius = diskRadius;
        hitPhi = mix(previousPhi, phi, crossing);
        diskHit = true;
        break;
      }
    }
    previousSide = side;
  }

  if (diskHit) {
    float innerEdge = smoothstep(DISK_INNER, DISK_INNER * 1.12, hitRadius);
    float outerEdge = 1.0 - smoothstep(DISK_OUTER * 0.76, DISK_OUTER, hitRadius);
    float radialEmission = innerEdge * outerEdge * pow(DISK_INNER / hitRadius, 0.72);

    float dilation = mix(1.0, DILATION_MIN, u_expanded);
    float patternTime = u_time * dilation;
    float turns = hitPhi / (2.0 * PI);
    float kepler = pow(DISK_INNER / hitRadius, 1.5);
    float swirl = hitRadius * 0.85 - patternTime * kepler * 3.6;
    float rawStreak = diskStreakSample(hitRadius, turns, swirl);
    float streak = 0.52 + 1.10 * rawStreak * rawStreak;

    float grazing = 0.82 + 0.18 * smoothstep(0.0, 1.0, abs(sin(hitPhi)));
    float brightness = radialEmission * streak * grazing;
    vec3 diskColor = blackbody(GARGANTUA_DISK_TEMP);
    float dopplerMix = GARGANTUA_DOPPLER_MIX;
    brightness *= mix(1.0, 1.0, dopplerMix);

    vec3 linearDisk = diskColor * brightness * 2.15;
    vec3 mappedDisk = vec3(1.0) - exp(-linearDisk);
    float diskAlpha = clamp(0.32 + brightness * 0.95, 0.0, 0.96);

    vec3 combined = mix(sceneSample.rgb, mappedDisk, diskAlpha);
    float coverage = sceneSample.a + diskAlpha * (1.0 - sceneSample.a);
    outColor = vec4(combined, coverage);
    return;
  }

  if (captured) {
    outColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  outColor = sceneSample;
}

void main() {
  rayTracedReference();
}`;

export const REFERENCE_BLACK_HOLE_INFO = {
  model: "interstellar-gargantua-kerr-geodesic",
  integrationSteps: 112,
  tracePadding: 3,
  starGain: 0,
  sceneInput: "svg-gpu-texture",
  alphaMode: "reference-webgl-straight-alpha",
  reference: "https://github.com/s0xDk/ghostty-blackhole",
  styleReference: "https://arxiv.org/abs/1502.03808",
  physicsReference: "https://github.com/hungyipu/Odyssey",
  webglReference: "https://ebruneton.github.io/black_hole_shader/",
} as const;
