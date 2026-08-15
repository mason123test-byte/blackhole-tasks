// Kerr null-geodesic equations follow Pu, Yun, Younsi & Yoon's public Odyssey GPU tracer.
// Gargantua camera geometry follows James, von Tunzelmann, Franklin & Thorne (2015),
// with every candidate ray launched from one camera event through its local FIDO sky.
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
const float OBSERVER_R = 74.1;
const float OBSERVER_THETA = 1.511;

const float DISK_INNER = 9.26;
const float DISK_OUTER = 18.70;
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

void normalizePolarStage(inout float theta, inout float ptheta) {
  if (theta < 0.0) {
    theta = -theta;
    ptheta = -ptheta;
  }
  if (theta > PI) {
    theta = 2.0 * PI - theta;
    ptheta = -ptheta;
  }
}

void normalizePolarState(inout float theta, inout float phi, inout float ptheta) {
  if (theta < 0.0) {
    theta = -theta;
    phi += PI;
    ptheta = -ptheta;
  }
  if (theta > PI) {
    theta = 2.0 * PI - theta;
    phi += PI;
    ptheta = -ptheta;
  }
}

void rk4KerrStep(
  inout float r,
  inout float theta,
  inout float phi,
  inout float pr,
  inout float ptheta,
  float L,
  float kappa,
  float h
) {
  float k1r;
  float k1theta;
  float k1phi;
  float k1pr;
  float k1ptheta;
  kerrDerivatives(r, theta, pr, ptheta, L, kappa, k1r, k1theta, k1phi, k1pr, k1ptheta);

  float r2 = r + 0.5 * h * k1r;
  float theta2 = theta + 0.5 * h * k1theta;
  float pr2 = pr + 0.5 * h * k1pr;
  float ptheta2 = ptheta + 0.5 * h * k1ptheta;
  normalizePolarStage(theta2, ptheta2);
  float k2r;
  float k2theta;
  float k2phi;
  float k2pr;
  float k2ptheta;
  kerrDerivatives(r2, theta2, pr2, ptheta2, L, kappa, k2r, k2theta, k2phi, k2pr, k2ptheta);

  float r3 = r + 0.5 * h * k2r;
  float theta3 = theta + 0.5 * h * k2theta;
  float pr3 = pr + 0.5 * h * k2pr;
  float ptheta3 = ptheta + 0.5 * h * k2ptheta;
  normalizePolarStage(theta3, ptheta3);
  float k3r;
  float k3theta;
  float k3phi;
  float k3pr;
  float k3ptheta;
  kerrDerivatives(r3, theta3, pr3, ptheta3, L, kappa, k3r, k3theta, k3phi, k3pr, k3ptheta);

  float r4 = r + h * k3r;
  float theta4 = theta + h * k3theta;
  float pr4 = pr + h * k3pr;
  float ptheta4 = ptheta + h * k3ptheta;
  normalizePolarStage(theta4, ptheta4);
  float k4r;
  float k4theta;
  float k4phi;
  float k4pr;
  float k4ptheta;
  kerrDerivatives(r4, theta4, pr4, ptheta4, L, kappa, k4r, k4theta, k4phi, k4pr, k4ptheta);

  float sixth = h / 6.0;
  r += sixth * (k1r + 2.0 * k2r + 2.0 * k3r + k4r);
  theta += sixth * (k1theta + 2.0 * k2theta + 2.0 * k3theta + k4theta);
  phi += sixth * (k1phi + 2.0 * k2phi + 2.0 * k3phi + k4phi);
  pr += sixth * (k1pr + 2.0 * k2pr + 2.0 * k3pr + k4pr);
  ptheta += sixth * (k1ptheta + 2.0 * k2ptheta + 2.0 * k3ptheta + k4ptheta);
  normalizePolarState(theta, phi, ptheta);
}

void initDngrCameraRay(
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
  r = OBSERVER_R;
  theta = OBSERVER_THETA;
  phi = 0.0;

  vec3 cameraSkyDirection = normalize(vec3(-OBSERVER_R, alpha, beta));
  vec3 incomingCameraDirection = -cameraSkyDirection;

  float nFidoRadial = incomingCameraDirection.x;
  float nFidoTheta = -incomingCameraDirection.z;
  float nFidoPhi = incomingCameraDirection.y;

  float safeSin = max(abs(sin(theta)), 1e-5);
  float cosTheta = cos(theta);
  float sin2 = safeSin * safeSin;
  float r2 = r * r;
  float rho = sqrt(r2 + KERR_A2 * cosTheta * cosTheta);
  float delta = max(r2 - 2.0 * r + KERR_A2, 1e-5);
  float sqrtDelta = sqrt(delta);
  float sigmaMetric = sqrt(
    (r2 + KERR_A2) * (r2 + KERR_A2)
      - KERR_A2 * delta * sin2
  );
  float lapse = rho * sqrtDelta / sigmaMetric;
  float omega = 2.0 * KERR_A * r / (sigmaMetric * sigmaMetric);
  float varpi = sigmaMetric * safeSin / rho;

  float cameraEnergy = 1.0 / (lapse + omega * varpi * nFidoPhi);
  pr = cameraEnergy * (rho / sqrtDelta) * nFidoRadial;
  ptheta = cameraEnergy * rho * nFidoTheta;
  L = cameraEnergy * varpi * nFidoPhi;
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
  initDngrCameraRay(alpha, beta, r, theta, phi, pr, ptheta, L, kappa);

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

    float nearHole = 1.0 - smoothstep(3.2, 14.0, r);
    float angularRefinement = clamp(abs(dphi0) * 0.40 + abs(dtheta0) * 1.35, 0.0, 2.5);
    float h = mix(1.35, 0.065, nearHole);
    h /= 1.0 + angularRefinement;
    h = clamp(h, 0.032, 1.35);

    previousR = r;
    previousPhi = phi;
    rk4KerrStep(r, theta, phi, pr, ptheta, L, kappa, h);

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
  cameraReference: "DNGR Appendix A.1 local-sky/FIDO camera",
  webglReference: "https://ebruneton.github.io/black_hole_shader/",
} as const;
