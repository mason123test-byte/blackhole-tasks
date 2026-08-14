// The physical rendering equations are adapted from s0xDk/ghostty-blackhole
// (MIT). The Gargantua presentation is informed by James, von Tunzelmann,
// Franklin & Thorne (2015) and Bruneton's real-time black-hole shader.
// Application-only interaction and WebGL lifecycle stay in blackHoleRenderer.ts.
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
#define B_CRIT 2.5980762
#define N_STEPS 80

const float DISK_INNER = 1.8;
const float DISK_OUTER = 8.0;
const float DISK_INCL = 1.50;
const float DISK_ROLL = 0.00;
const float STAR_GAIN = 0.0;
const float DILATION_MIN = 0.20;
const float GARGANTUA_DOPPLER_MIX = 0.08;
const float GARGANTUA_DISK_OPACITY = 0.58;
const float GARGANTUA_ANNULUS_CENTER = 3.15;
const float GARGANTUA_ANNULUS_WIDTH = 0.85;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float vnoiseWrapY(vec2 p, float periodY) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float y0 = mod(i.y, periodY);
  float y1 = mod(i.y + 1.0, periodY);
  return mix(mix(hash21(vec2(i.x, y0)), hash21(vec2(i.x + 1.0, y0)), f.x),
             mix(hash21(vec2(i.x, y1)), hash21(vec2(i.x + 1.0, y1)), f.x), f.y);
}

vec2 rotate2(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

vec2 mirrorUV(vec2 value) {
  return 1.0 - abs(1.0 - mod(value, 2.0));
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

vec3 stars(vec3 direction) {
  vec2 sphere = vec2(
    atan(direction.x, -direction.z),
    asin(clamp(direction.y, -1.0, 1.0))
  );
  vec2 grid = sphere * 40.0;
  vec2 id = floor(grid);
  float h = hash21(id);
  if (h < 0.92) return vec3(0.0);
  vec2 local = fract(grid) - 0.5;
  vec2 offset = (vec2(hash21(id + 17.3), hash21(id + 31.7)) - 0.5) * 0.7;
  float spark = smoothstep(0.10, 0.0, length(local - offset));
  float twinkle = 0.7 + 0.3 * sin(u_time * (0.5 + 2.0 * hash21(id + 5.1)) + 40.0 * h);
  vec3 tint = mix(vec3(1.0, 0.82, 0.60), vec3(0.75, 0.85, 1.0), hash21(id + 2.9));
  return tint * spark * twinkle * ((h - 0.92) / 0.08);
}

float luma(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

float diskStreakSample(float diskRadius, float turns, float swirl) {
  return vnoiseWrapY(vec2(diskRadius * 2.8, turns * 19.0 + swirl * 3.0), 19.0) * 0.65
    + vnoiseWrapY(vec2(diskRadius, turns * 9.0 + swirl * 1.5 + 7.0), 9.0) * 0.35;
}

void rayTracedReference() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 referenceUv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec2 screen = (referenceUv - 0.5) * vec2(aspect, 1.0);
  float candidateWeight = u_visual_compare < 0.5
    ? 0.0
    : (u_visual_compare > 1.5 ? step(0.0, screen.x) : 1.0);
  float gargantuaStyleWeight = candidateWeight * smoothstep(0.50, 0.62, referenceUv.y);

  float shadowRadius = mix(0.112, 0.105, u_expanded);
  float worldScale = B_CRIT / shadowRadius;
  float screenDistance = length(screen);

  // Baseline mode is retained only for the Windows A/B capture. The normal
  // application path is candidateWeight=1 and therefore uses the single,
  // unwarped Gargantua ray plane below. Film-style photometric treatment is
  // localized below the shadow because the established upper arc already
  // matches Gargantua's warm layered far-side image well.
  float legacyLowerRadialWeight = smoothstep(shadowRadius * 1.05, shadowRadius * 1.45, screenDistance)
    * (1.0 - smoothstep(shadowRadius * 2.75, shadowRadius * 3.60, screenDistance));
  float legacyLowerLensWeight = (1.0 - candidateWeight) * smoothstep(0.50, 0.70, referenceUv.y)
    * legacyLowerRadialWeight;
  float legacyLowerTargetScale = mix(0.42, 0.60, smoothstep(-0.12, 0.12, screen.x));
  float legacyLowerMajorScale = mix(1.0, legacyLowerTargetScale, legacyLowerLensWeight);
  float legacyLowerMinorScale = mix(1.0, 1.40, legacyLowerLensWeight);
  vec2 legacyBaseRayPlane = rotate2(vec2(screen.x, -screen.y), DISK_ROLL) * worldScale;
  vec2 legacyRayPlane = vec2(
    legacyBaseRayPlane.x * legacyLowerMajorScale,
    legacyBaseRayPlane.y * legacyLowerMinorScale
  );
  vec2 gargantuaRayPlane = rotate2(vec2(screen.x, -screen.y), DISK_ROLL) * worldScale;
  vec2 rayPlane = mix(legacyRayPlane, gargantuaRayPlane, candidateWeight);

  float impact = length(rayPlane);
  float lensWindow = exp(-pow(screenDistance / (7.0 * shadowRadius), 2.0));
  float bmax = DISK_OUTER + 3.0;
  float cameraZ = 14.0;

  if (impact >= bmax) {
    vec3 starDirection = normalize(vec3(-(rayPlane / impact) * (2.0 / impact), -1.0));
    vec3 starLight = stars(starDirection) * STAR_GAIN * lensWindow;
    vec3 sceneColor = vec3(0.0);
    float sceneAlpha = 0.0;
    if (u_scene_ready > 0.5 && lensWindow >= 0.01) {
      float finiteCamera = cameraZ * inversesqrt(cameraZ * cameraZ + impact * impact);
      float deflection = (2.0 / (worldScale * worldScale)) / max(screenDistance, 0.0001)
        * (1.29 * finiteCamera + 0.07)
        * max(13.0 - 2.14 * finiteCamera + 0.75, 0.0)
        * lensWindow;
      vec2 direction = screen / max(screenDistance, 0.00001);
      float aberration = 0.035 * smoothstep(1.0, 2.0, impact / bmax);
      float sampledAlpha = 0.0;
      for (int channel = 0; channel < 3; channel++) {
        float bend = 1.0 + (float(channel) - 1.0) * aberration;
        vec2 sampledScreen = screen - direction * deflection * bend;
        vec2 sampledUv = mirrorUV(vec2(0.5) + sampledScreen / vec2(aspect, 1.0));
        vec4 sceneSample = texture(u_scene_texture, sampledUv);
        sceneColor[channel] = sceneSample[channel];
        if (channel == 1) sampledAlpha = sceneSample.a;
      }
      sceneAlpha = sampledAlpha * lensWindow * u_scene_ready;
    }
    float lightAlpha = clamp(luma(starLight) * 2.0, 0.0, 1.0);
    float coverage = max(sceneAlpha, lightAlpha);
    vec3 straightColor = sceneColor + starLight;
    outColor = vec4(straightColor, coverage);
    return;
  }

  vec3 position = vec3(rayPlane, cameraZ);
  vec3 velocity = vec3(0.0, 0.0, -1.0);
  float angularMomentum2 = dot(rayPlane, rayPlane);

  float ci = cos(DISK_INCL), si = sin(DISK_INCL);
  vec3 diskNormal = vec3(0.0, si, ci);
  vec3 diskAxis = vec3(0.0, ci, -si);
  vec3 emission = vec3(0.0);
  float transmittance = 1.0;
  bool captured = false;
  float previousSide = dot(position, diskNormal);
  vec3 previousPosition = position;
  float dilation = mix(1.0, DILATION_MIN, u_expanded);
  float patternTime = u_time * dilation;
  int diskCrossingIndex = 0;

  for (int i = 0; i < N_STEPS; i++) {
    float radius2 = dot(position, position);
    if (radius2 < 1.0) {
      captured = true;
      break;
    }
    if (position.z < -cameraZ && velocity.z < 0.0) break;
    if (radius2 > 4.0 * cameraZ * cameraZ) break;

    float radius = sqrt(radius2);
    float photonSphereRefinement = 1.0 - smoothstep(1.65, 3.20, radius);
    float dt = clamp(0.16 * radius, 0.03, 1.5) * mix(1.0, 0.55, photonSphereRefinement);
    vec3 acceleration = -1.5 * angularMomentum2 * position / (radius2 * radius2 * radius);
    velocity += acceleration * (0.5 * dt);
    position += velocity * dt;
    radius2 = max(dot(position, position), 0.0001);
    radius = sqrt(radius2);
    acceleration = -1.5 * angularMomentum2 * position / (radius2 * radius2 * radius);
    velocity += acceleration * (0.5 * dt);

    float side = dot(position, diskNormal);
    if (side * previousSide < 0.0 && transmittance > 0.02) {
      float crossing = previousSide / (previousSide - side);
      vec3 diskPoint = mix(previousPosition, position, crossing);
      float diskRadius = length(diskPoint);
      if (diskRadius > DISK_INNER && diskRadius < DISK_OUTER) {
        float band = smoothstep(DISK_INNER, DISK_INNER * 1.25, diskRadius)
          * (1.0 - smoothstep(DISK_OUTER * 0.70, DISK_OUTER, diskRadius));
        float phi = atan(dot(diskPoint, diskAxis), diskPoint.x);
        float turns = phi / (2.0 * PI);
        float kepler = pow(DISK_INNER / diskRadius, 1.5);
        float localTime = sqrt(max(1.0 - 1.5 / diskRadius, 0.02));
        float swirl = diskRadius * 7.0 * 0.12 - patternTime * kepler * 5.0 * localTime;
        float streakContrast = 1.6;
        float rawStreaks = diskStreakSample(diskRadius, turns, swirl);
        float streaks = 0.35 + streakContrast * rawStreaks * rawStreaks;
        float textureFilterRadius = 0.16;
        float radiusMinus = max(DISK_INNER, diskRadius - textureFilterRadius);
        float radiusPlus = min(DISK_OUTER, diskRadius + textureFilterRadius);
        float swirlMinus = radiusMinus * 7.0 * 0.12 - patternTime * pow(DISK_INNER / radiusMinus, 1.5) * 5.0
          * sqrt(max(1.0 - 1.5 / radiusMinus, 0.02));
        float swirlPlus = radiusPlus * 7.0 * 0.12 - patternTime * pow(DISK_INNER / radiusPlus, 1.5) * 5.0
          * sqrt(max(1.0 - 1.5 / radiusPlus, 0.02));
        float rawStreaksMinus = diskStreakSample(radiusMinus, turns, swirlMinus);
        float rawStreaksPlus = diskStreakSample(radiusPlus, turns, swirlPlus);
        float streaksMinus = 0.35 + streakContrast * rawStreaksMinus * rawStreaksMinus;
        float streaksPlus = 0.35 + streakContrast * rawStreaksPlus * rawStreaksPlus;
        streaks = (streaksMinus + 2.0 * streaks + streaksPlus) * 0.25;

        vec3 gasDirection = normalize(cross(diskNormal, diskPoint));
        float beta = clamp(inversesqrt(max(2.0 * (diskRadius - 1.0), 0.2)), 0.0, 0.99);
        float shift = localTime / max(1.0 + beta * dot(gasDirection, normalize(velocity)), 0.05);
        float dopplerMix = mix(0.60, GARGANTUA_DOPPLER_MIX, gargantuaStyleWeight);
        shift = mix(1.0, shift, dopplerMix);
        float profileBase = max(1.0 - sqrt(DISK_INNER / diskRadius), 0.0);
        float temperatureProfile = pow(DISK_INNER / diskRadius, 0.75) * pow(profileBase, 0.25) / 0.488;
        vec3 diskColor = blackbody(5500.0 * temperatureProfile * shift);
        float beamPower = mix(2.5, 1.15, gargantuaStyleWeight);
        float boost = pow(shift, beamPower);
        float density = band * streaks;

        // Gargantua's lower secondary image benefits from a bright, relatively
        // narrow inner annulus plus a much fainter extended disk. The upper
        // image keeps the proven warmer layered response instead of being
        // globally over-whitened by the film treatment.
        float filmAnnulus = exp(-pow((diskRadius - GARGANTUA_ANNULUS_CENTER) / GARGANTUA_ANNULUS_WIDTH, 2.0));
        float filmOuterWing = 0.18 + 0.22 * smoothstep(3.5, DISK_OUTER, diskRadius);
        float filmEmissivity = filmOuterWing + 1.55 * filmAnnulus;
        float emissivity = mix(1.0, filmEmissivity, gargantuaStyleWeight);

        float criticalBoost = 1.0 + gargantuaStyleWeight * 0.48 * exp(-pow((impact - B_CRIT) / 0.24, 2.0));
        float crossingGain = 1.0;
        if (diskCrossingIndex > 0) {
          crossingGain = mix(1.0, 1.32, gargantuaStyleWeight);
        }

        emission += transmittance * diskColor
          * (4.84 * density * temperatureProfile * temperatureProfile * boost
            * emissivity * criticalBoost * crossingGain);
        float discOpacity = mix(0.90, GARGANTUA_DISK_OPACITY, gargantuaStyleWeight);
        transmittance *= 1.0 - clamp(discOpacity * density, 0.0, 1.0);
        diskCrossingIndex += 1;
      }
    }
    previousSide = side;
    previousPosition = position;
  }

  if (!captured && dot(position, position) < 4.0) captured = true;

  vec3 sceneColor = vec3(0.0);
  vec3 starLight = vec3(0.0);
  float sceneAlpha = 0.0;
  if (!captured) {
    vec3 escapedDirection = normalize(velocity);
    starLight = stars(escapedDirection) * STAR_GAIN * lensWindow;
    if (u_scene_ready > 0.5 && escapedDirection.z < -0.05) {
      float projection = (-13.0 - position.z) / escapedDirection.z;
      vec3 hit = position + escapedDirection * projection;
      vec2 unrolled = rotate2(hit.xy, -DISK_ROLL) / worldScale;
      vec2 escapedScreen = vec2(unrolled.x, -unrolled.y);
      vec2 sampledScreen = mix(screen, escapedScreen, lensWindow);
      vec2 sampledUv = mirrorUV(vec2(0.5) + sampledScreen / vec2(aspect, 1.0));
      float towardScene = smoothstep(0.05, 0.35, -escapedDirection.z);
      vec4 sceneSample = texture(u_scene_texture, sampledUv);
      sceneColor = sceneSample.rgb;
      sceneAlpha = sceneSample.a * lensWindow * towardScene * u_scene_ready;
    }
  }
  float exposure = mix(1.20, 1.32, gargantuaStyleWeight);
  vec3 diskLight = vec3(1.0) - exp(-emission * exposure);
  float diskOpacity = clamp(1.0 - transmittance, 0.0, 1.0);
  float diskCoverage = max(diskOpacity, max(diskLight.r, max(diskLight.g, diskLight.b)));
  float starCoverage = clamp(luma(starLight) * 2.0, 0.0, 1.0);
  float lightAlpha = clamp((captured ? 1.0 : 0.0) + max(diskCoverage, starCoverage), 0.0, 1.0);
  float coverage = max(sceneAlpha, lightAlpha);
  vec3 premultipliedContribution = sceneColor * transmittance * sceneAlpha
    + starLight * transmittance
    + diskLight;
  vec3 straightColor = coverage > 0.0001 ? premultipliedContribution / coverage : vec3(0.0);
  outColor = vec4(clamp(straightColor, 0.0, 1.0), coverage);
}

void main() {
  rayTracedReference();
}`;

export const REFERENCE_BLACK_HOLE_INFO = Object.freeze({
  model: "gargantua-inspired-schwarzschild-geodesic",
  integrationSteps: 80,
  tracePadding: 3,
  starGain: 0,
  sceneInput: "svg-gpu-texture",
  alphaMode: "reference-webgl-straight-alpha",
  reference: "https://github.com/s0xDk/ghostty-blackhole",
  styleReference: "https://arxiv.org/abs/1502.03808",
  webglReference: "https://ebruneton.github.io/black_hole_shader/",
});