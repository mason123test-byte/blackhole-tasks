// Kerr null-geodesic equations follow Pu, Yun, Younsi & Yoon's public Odyssey GPU tracer.
// Camera initialization follows James, von Tunzelmann, Franklin & Thorne (2015),
// Appendix A.1: one camera event, a FIDO tetrad and a varying camera-local sky direction.
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
#define N_STEPS 176

const float KERR_A = 0.60;
const float KERR_A2 = KERR_A * KERR_A;
const float KERR_HORIZON = 1.80;
const float KERR_MIN_STEP = 0.006;
const float KERR_MAX_STEP = 1.55;
const float KERR_ERROR_TOL = 0.00035;
const int KERR_MAX_RETRIES = 5;
const float OBSERVER_R = 74.1;
const float OBSERVER_THETA = 1.535;
const float CAMERA_VERTICAL_FOV = 0.55850536;

const float DISK_INNER = 4.20;
const float DISK_OUTER = 28.00;
const int MAX_DISK_CROSSINGS = 4;
const float STAR_GAIN = 0.0;
const float DILATION_MIN = 0.20;
const float GARGANTUA_DOPPLER_MIX = 0.0;
const float GARGANTUA_DISK_TEMP = 4500.0;
const float FILM_DISK_EXPOSURE = 1.55;
const float DISK_SOURCE_DIAGNOSTIC = 0.0;

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
  float safeSin = max(abs(sin(theta)), 1e-4);
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

void projectKerrMomenta(
  float r,
  float theta,
  float L,
  float kappa,
  inout float pr,
  inout float ptheta
) {
  float safeSin = max(abs(sin(theta)), 1e-4);
  float sin2 = safeSin * safeSin;
  float prSign = pr < 0.0 ? -1.0 : 1.0;
  float pthetaSign = ptheta < 0.0 ? -1.0 : 1.0;
  float thetaPotential = max(kappa - KERR_A2 * sin2 - L * L / sin2, 0.0);
  ptheta = pthetaSign * sqrt(thetaPotential);
  float r2 = r * r;
  float delta = max(r2 - 2.0 * r + KERR_A2, 1e-5);
  float radialPotential = (r2 + KERR_A2) * (r2 + KERR_A2)
    - 4.0 * KERR_A * r * L + KERR_A2 * L * L - delta * kappa;
  pr = prSign * sqrt(max(radialPotential, 0.0)) / delta;
}

void normalizePolarStage(inout float theta, inout float ptheta) {
  if (theta < 0.0) { theta = -theta; ptheta = -ptheta; }
  if (theta > PI) { theta = 2.0 * PI - theta; ptheta = -ptheta; }
}

void normalizePolarState(inout float theta, inout float phi, inout float ptheta) {
  if (theta < 0.0) { theta = -theta; phi += PI; ptheta = -ptheta; }
  if (theta > PI) { theta = 2.0 * PI - theta; phi += PI; ptheta = -ptheta; }
}

void kerrPackedDerivatives(vec4 state, float ptheta, float L, float kappa, out vec4 derivative, out float dptheta) {
  float dr; float dtheta; float dphi; float dpr;
  kerrDerivatives(state.x, state.y, state.w, ptheta, L, kappa, dr, dtheta, dphi, dpr, dptheta);
  derivative = vec4(dr, dtheta, dphi, dpr);
}

void normalizePackedStage(inout vec4 state, inout float ptheta) {
  float theta = state.y;
  normalizePolarStage(theta, ptheta);
  state.y = theta;
}

void rkckKerrTrial(vec4 state, float ptheta, float L, float kappa, float h, out vec4 stateOut, out float pthetaOut, out vec4 stateError, out float pthetaError) {
  vec4 k1; float q1; kerrPackedDerivatives(state, ptheta, L, kappa, k1, q1);
  vec4 s2 = state + h * (0.2 * k1); float p2 = ptheta + h * (0.2 * q1); normalizePackedStage(s2, p2);
  vec4 k2; float q2; kerrPackedDerivatives(s2, p2, L, kappa, k2, q2);
  vec4 s3 = state + h * (0.075 * k1 + 0.225 * k2); float p3 = ptheta + h * (0.075 * q1 + 0.225 * q2); normalizePackedStage(s3, p3);
  vec4 k3; float q3; kerrPackedDerivatives(s3, p3, L, kappa, k3, q3);
  vec4 s4 = state + h * (0.3 * k1 - 0.9 * k2 + 1.2 * k3); float p4 = ptheta + h * (0.3 * q1 - 0.9 * q2 + 1.2 * q3); normalizePackedStage(s4, p4);
  vec4 k4; float q4; kerrPackedDerivatives(s4, p4, L, kappa, k4, q4);
  vec4 s5 = state + h * (-0.2037037037 * k1 + 2.5 * k2 - 2.5925925926 * k3 + 1.2962962963 * k4);
  float p5 = ptheta + h * (-0.2037037037 * q1 + 2.5 * q2 - 2.5925925926 * q3 + 1.2962962963 * q4); normalizePackedStage(s5, p5);
  vec4 k5; float q5; kerrPackedDerivatives(s5, p5, L, kappa, k5, q5);
  vec4 s6 = state + h * (0.0294958044 * k1 + 0.3417968750 * k2 + 0.0415943287 * k3 + 0.4003454138 * k4 + 0.0617675781 * k5);
  float p6 = ptheta + h * (0.0294958044 * q1 + 0.3417968750 * q2 + 0.0415943287 * q3 + 0.4003454138 * q4 + 0.0617675781 * q5); normalizePackedStage(s6, p6);
  vec4 k6; float q6; kerrPackedDerivatives(s6, p6, L, kappa, k6, q6);
  stateOut = state + h * (0.0978835979 * k1 + 0.4025764895 * k3 + 0.2104377104 * k4 + 0.2891022021 * k6);
  pthetaOut = ptheta + h * (0.0978835979 * q1 + 0.4025764895 * q3 + 0.2104377104 * q4 + 0.2891022021 * q6);
  vec4 fourthOrder = state + h * (0.1021773727 * k1 + 0.3839079034 * k3 + 0.2445927373 * k4 + 0.0193219866 * k5 + 0.25 * k6);
  float fourthPtheta = ptheta + h * (0.1021773727 * q1 + 0.3839079034 * q3 + 0.2445927373 * q4 + 0.0193219866 * q5 + 0.25 * q6);
  stateError = stateOut - fourthOrder;
  pthetaError = pthetaOut - fourthPtheta;
}

float kerrErrorRatio(vec4 state, float ptheta, vec4 derivative, float dptheta, float h, vec4 stateError, float pthetaError) {
  vec4 scale = abs(state) + abs(derivative * h) + vec4(1e-3, 1e-4, 1e-3, 1e-3);
  vec4 scaledError = abs(stateError) / scale;
  float pthetaScale = abs(ptheta) + abs(dptheta * h) + 1e-3;
  float worst = max(max(scaledError.x, scaledError.y), max(scaledError.z, scaledError.w));
  worst = max(worst, abs(pthetaError) / pthetaScale);
  return worst / KERR_ERROR_TOL;
}

void initDngrCameraRay(float cameraRight, float cameraUp, out float r, out float theta, out float phi, out float pr, out float ptheta, out float L, out float kappa) {
  r = OBSERVER_R; theta = OBSERVER_THETA; phi = 0.0;
  vec3 localSky = normalize(vec3(1.0, cameraUp, -cameraRight));
  float nFidoRadial = localSky.x; float nFidoTheta = localSky.y; float nFidoPhi = localSky.z;
  float safeSin = max(abs(sin(theta)), 1e-5); float cosTheta = cos(theta); float sin2 = safeSin * safeSin; float r2 = r * r;
  float rho = sqrt(r2 + KERR_A2 * cosTheta * cosTheta); float delta = max(r2 - 2.0 * r + KERR_A2, 1e-5); float sqrtDelta = sqrt(delta);
  float sigmaMetric = sqrt((r2 + KERR_A2) * (r2 + KERR_A2) - KERR_A2 * delta * sin2);
  float lapse = rho * sqrtDelta / sigmaMetric; float omega = 2.0 * KERR_A * r / (sigmaMetric * sigmaMetric); float varpi = sigmaMetric * safeSin / rho;
  float cameraEnergy = 1.0 / (lapse + omega * varpi * nFidoPhi);
  pr = cameraEnergy * (rho / sqrtDelta) * nFidoRadial; ptheta = cameraEnergy * rho * nFidoTheta; L = cameraEnergy * varpi * nFidoPhi;
  kappa = ptheta * ptheta + KERR_A2 * sin2 + L * L / sin2;
}

void sampleDiskSurface(float hitRadius, float hitPhi, float patternTime, out vec3 diskColor, out float diskAlpha) {
  float innerEdge = smoothstep(DISK_INNER, DISK_INNER * 1.020, hitRadius);
  float outerEdge = 1.0 - smoothstep(DISK_OUTER * 0.74, DISK_OUTER * 0.995, hitRadius);
  float radialEmission = innerEdge * outerEdge * pow(DISK_INNER / hitRadius, 0.38);
  float turns = hitPhi / (2.0 * PI); float kepler = pow(DISK_INNER / hitRadius, 1.5); float swirl = hitRadius * 0.85 - patternTime * kepler * 3.6;
  float rawStreak = diskStreakSample(hitRadius, turns, swirl);
  float streak = mix(0.72 + 0.34 * rawStreak, 1.0, DISK_SOURCE_DIAGNOSTIC);
  float radialProgress = clamp((hitRadius - DISK_INNER) / (DISK_OUTER - DISK_INNER), 0.0, 1.0);
  float innerHeat = 1.0 - smoothstep(0.04, 0.72, radialProgress); float streakHeat = smoothstep(0.28, 0.92, rawStreak);
  float grazing = mix(0.80 + 0.20 * smoothstep(0.0, 1.0, abs(sin(hitPhi))), 1.0, DISK_SOURCE_DIAGNOSTIC);
  float fineNoise = vnoiseWrapY(vec2(hitRadius * 2.35 + rawStreak * 2.0, turns * 37.0 + swirl * 3.6), 37.0);
  float broadNoise = vnoiseWrapY(vec2(hitRadius * 0.72 + fineNoise * 2.4, turns * 11.0 - swirl * 1.25 + 9.0), 11.0);
  float radialWarp = (fineNoise - 0.5) * 5.5 + (broadNoise - 0.5) * 3.0;
  float ribbon = 0.5 + 0.5 * sin(hitRadius * 5.2 + radialWarp + hitPhi * 0.42);
  float secondaryRibbon = 0.5 + 0.5 * sin(hitRadius * 2.35 - hitPhi * 0.27 + broadNoise * 4.0);
  float laneStructure = 0.60 + 0.33 * pow(ribbon, 1.8) + 0.18 * pow(secondaryRibbon, 1.5) + 0.12 * fineNoise;
  float filamentNoise = vnoiseWrapY(vec2(hitRadius * 3.1 + broadNoise * 2.0, turns * 29.0 + swirl * 4.2), 29.0);
  float filaments = 0.86 + 0.28 * smoothstep(0.42, 0.86, filamentNoise);
  float physicalLayers = mix(laneStructure * filaments, 1.0, DISK_SOURCE_DIAGNOSTIC);
  float brightness = radialEmission * streak * grazing;
  brightness *= physicalLayers;
  brightness *= mix(1.10, 0.62, smoothstep(0.04, 0.90, radialProgress)); brightness *= FILM_DISK_EXPOSURE;
  float localTemperature = mix(2900.0, 4800.0, clamp(0.74 * innerHeat + 0.26 * streakHeat, 0.0, 1.0));
  vec3 thermalColor = blackbody(localTemperature); brightness *= mix(1.0, 1.0, GARGANTUA_DOPPLER_MIX);
  vec3 linearDisk = thermalColor * brightness * 1.52;
  diskColor = vec3(1.0) - exp(-linearDisk); diskAlpha = clamp(0.10 + brightness * 0.74, 0.0, 0.84);
}

float crossingColorGain(int crossingIndex) {
  if (crossingIndex <= 0) return 1.0;
  if (crossingIndex == 1) return 0.80;
  if (crossingIndex == 2) return 0.20;
  return 0.08;
}

float crossingAlphaGain(int crossingIndex) {
  if (crossingIndex <= 0) return 1.0;
  if (crossingIndex == 1) return 0.72;
  if (crossingIndex == 2) return 0.25;
  return 0.12;
}

void rayTracedReference() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 referenceUv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec2 screen = (referenceUv - 0.5) * vec2(aspect, 1.0);
  float candidateWeight = u_visual_compare < 0.5 ? 0.0 : (u_visual_compare > 1.5 ? step(0.0, screen.x) : 1.0);
  float shadowRadius = mix(0.112, 0.105, u_expanded); float worldScale = B_CRIT / shadowRadius;
  float baselineAlpha = screen.x * worldScale; float baselineBeta = -screen.y * worldScale;
  float baselineLowerWarp = (1.0 - candidateWeight) * smoothstep(0.0, shadowRadius * 0.65, screen.y)
    * (1.0 - smoothstep(shadowRadius * 3.6, shadowRadius * 5.2, length(screen)));
  baselineBeta *= mix(1.0, 1.20, baselineLowerWarp);
  vec2 baselineCameraPlane = vec2(baselineAlpha, baselineBeta) / OBSERVER_R;
  float cameraHalfTan = tan(0.5 * CAMERA_VERTICAL_FOV);
  vec2 candidateCameraPlane = vec2(screen.x * 2.0, -screen.y * 2.0) * cameraHalfTan;
  vec2 cameraPlane = mix(baselineCameraPlane, candidateCameraPlane, candidateWeight);
  vec4 sceneSample = u_scene_ready > 0.5 ? texture(u_scene_texture, clamp(referenceUv, vec2(0.0), vec2(1.0))) : vec4(0.0);
  float cameraImpact = OBSERVER_R * length(cameraPlane);
  if (cameraImpact > DISK_OUTER + 10.0) { outColor = sceneSample; return; }
  float r; float theta; float phi; float pr; float ptheta; float L; float kappa;
  initDngrCameraRay(cameraPlane.x, cameraPlane.y, r, theta, phi, pr, ptheta, L, kappa);
  float previousR = r; float previousPhi = phi; float previousSide = theta - 0.5 * PI;
  bool captured = false; int diskCrossingCount = 0; vec3 accumulatedDisk = vec3(0.0); float transmittance = 1.0;
  float dilation = mix(1.0, DILATION_MIN, u_expanded); float patternTime = u_time * dilation; float h = 0.90;
  for (int i = 0; i < N_STEPS; i++) {
    if (r <= KERR_HORIZON + 0.015) { captured = true; break; }
    float dr0; float dtheta0; float dphi0; float dpr0; float dptheta0;
    kerrDerivatives(r, theta, pr, ptheta, L, kappa, dr0, dtheta0, dphi0, dpr0, dptheta0);
    if (r > OBSERVER_R + 6.0 && dr0 > 0.0) break;
    h = clamp(h, KERR_MIN_STEP, KERR_MAX_STEP);
    float axisDistance = min(theta, PI - theta); float axisStepLimit = 0.20 * axisDistance / max(abs(dtheta0), 1e-4);
    h = min(h, max(KERR_MIN_STEP, axisStepLimit));
    float angularStepLimit = 0.24 / max(abs(dtheta0) + abs(dphi0), 1e-4); h = min(h, max(KERR_MIN_STEP, angularStepLimit));
    float horizonDistance = max(r - KERR_HORIZON, 0.02); float radialStepLimit = 0.25 * horizonDistance / max(abs(dr0), 1e-4);
    h = min(h, max(KERR_MIN_STEP, radialStepLimit));
    vec4 state = vec4(r, theta, phi, pr); vec4 derivative = vec4(dr0, dtheta0, dphi0, dpr0);
    vec4 acceptedState = state; float acceptedPtheta = ptheta; float acceptedErrorRatio = 1.0; bool acceptedStep = false;
    for (int retry = 0; retry < KERR_MAX_RETRIES; retry++) {
      vec4 trialState; float trialPtheta; vec4 stateError; float pthetaError;
      rkckKerrTrial(state, ptheta, L, kappa, h, trialState, trialPtheta, stateError, pthetaError);
      float errorRatio = kerrErrorRatio(state, ptheta, derivative, dptheta0, h, stateError, pthetaError);
      if (errorRatio <= 1.0 || h <= KERR_MIN_STEP * 1.01) {
        acceptedState = trialState; acceptedPtheta = trialPtheta; acceptedErrorRatio = errorRatio; acceptedStep = true; break;
      }
      h = max(KERR_MIN_STEP, h * clamp(0.90 * pow(errorRatio, -0.25), 0.20, 0.80));
    }
    if (!acceptedStep) {
      break;
    }
    previousR = r; previousPhi = phi;
    r = acceptedState.x; theta = acceptedState.y; phi = acceptedState.z; pr = acceptedState.w; ptheta = acceptedPtheta;
    normalizePolarState(theta, phi, ptheta); projectKerrMomenta(r, theta, L, kappa, pr, ptheta);
    h = clamp(h * clamp(0.90 * pow(max(acceptedErrorRatio, 1e-6), -0.20), 0.55, 1.80), KERR_MIN_STEP, KERR_MAX_STEP);
    float side = theta - 0.5 * PI;
    if (side * previousSide < 0.0 && diskCrossingCount < MAX_DISK_CROSSINGS) {
      float crossing = previousSide / (previousSide - side); float diskRadius = mix(previousR, r, crossing);
      if (diskRadius > DISK_INNER && diskRadius < DISK_OUTER) {
        float diskPhi = mix(previousPhi, phi, crossing); vec3 diskColor; float diskAlpha;
        sampleDiskSurface(diskRadius, diskPhi, patternTime, diskColor, diskAlpha);
        float colorGain = crossingColorGain(diskCrossingCount);
        float alphaGain = crossingAlphaGain(diskCrossingCount);
        float effectiveAlpha = clamp(diskAlpha * alphaGain, 0.0, 0.90);
        accumulatedDisk += transmittance * (diskColor * colorGain) * effectiveAlpha;
        transmittance *= 1.0 - effectiveAlpha;
        diskCrossingCount += 1;
        if (transmittance < 0.02) break;
      }
    }
    previousSide = side;
  }
  if (diskCrossingCount > 0) {
    vec3 background = captured ? vec3(0.0) : sceneSample.rgb; float backgroundAlpha = captured ? 1.0 : sceneSample.a;
    vec3 combined = accumulatedDisk + transmittance * background;
    float coverage = (1.0 - transmittance) + transmittance * backgroundAlpha;
    outColor = vec4(combined, coverage); return;
  }
  if (captured) { outColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
  outColor = sceneSample;
}

void main() { rayTracedReference(); }
`;

export const REFERENCE_BLACK_HOLE_INFO = {
  model: "interstellar-gargantua-kerr-geodesic",
  integrationSteps: 176,
  tracePadding: 3,
  starGain: 0,
  sceneInput: "svg-gpu-texture",
  alphaMode: "reference-webgl-straight-alpha",
  reference: "https://github.com/s0xDk/ghostty-blackhole",
  styleReference: "https://arxiv.org/abs/1502.03808",
  physicsReference: "https://github.com/hungyipu/Odyssey",
  cameraReference: "DNGR Appendix A.1 fixed-event FIDO local sky",
  cameraVerticalFovDeg: 32,
  webglReference: "https://ebruneton.github.io/black_hole_shader/",
} as const;