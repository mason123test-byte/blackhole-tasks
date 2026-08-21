import {
  REFERENCE_BLACK_HOLE_FRAGMENT as BASE_REFERENCE_BLACK_HOLE_FRAGMENT,
  REFERENCE_BLACK_HOLE_INFO,
  REFERENCE_BLACK_HOLE_VERTEX,
} from "./referenceBlackHoleShaderBaseline";

function replaceOnce(source: string, needle: string, replacement: string) {
  if (!source.includes(needle)) {
    throw new Error(`reference shader incidence patch anchor missing: ${needle}`);
  }
  return source.replace(needle, replacement);
}

const incidenceHelpers = String.raw`
float diskLocalIncidenceCosine(float diskRadius, float L, float kappa) {
  float r2 = diskRadius * diskRadius;
  float delta = max(r2 - 2.0 * diskRadius + KERR_A2, 1e-5);
  float equatorialPtheta = sqrt(max(kappa - KERR_A2 - L * L, 0.0));
  float radialPotential = (r2 + KERR_A2) * (r2 + KERR_A2)
    - 4.0 * KERR_A * diskRadius * L + KERR_A2 * L * L - delta * kappa;
  float localRadial = sqrt(max(radialPotential, 0.0)) / max(sqrt(delta) * diskRadius, 1e-4);
  float localTheta = equatorialPtheta / max(diskRadius, 1e-4);
  float equatorialSigmaMetric = sqrt((r2 + KERR_A2) * (r2 + KERR_A2) - KERR_A2 * delta);
  float localPhi = abs(L) * diskRadius / max(equatorialSigmaMetric, 1e-4);
  return localTheta / max(length(vec3(localRadial, localTheta, localPhi)), 1e-4);
}

void shapeIncidenceQualifiedDirectShoulder(
  float candidateWeight,
  float pathStretch,
  float incidenceCosine,
  float sourceHighFrequency,
  inout vec3 diskColor,
  float diskAlpha
) {
  float shortPathWeight = 1.0 - smoothstep(1.05, 1.45, pathStretch);
  float grazingWeight = 1.0 - smoothstep(0.07, 0.26, incidenceCosine);
  float directTransferWeight = shortPathWeight * grazingWeight;
  float directPeak = max(diskColor.r, max(diskColor.g, diskColor.b));
  float shoulderBand = smoothstep(0.58, 0.72, directPeak)
    * (1.0 - smoothstep(0.78, 0.90, directPeak));
  float coreProtect = smoothstep(0.80, 0.94, directPeak)
    * smoothstep(0.50, 0.76, diskAlpha);
  float shoulderSuppression = candidateWeight
    * directTransferWeight
    * shoulderBand
    * (1.0 - coreProtect);
  diskColor *= mix(1.0, 0.38, shoulderSuppression);

  float warmShelfSupport = smoothstep(0.22, 0.68, shoulderSuppression);
  float warmShelfPeak = min(0.68, max(0.0, directPeak * 0.94));
  vec3 warmShelf = vec3(1.0, 0.93, 0.74) * warmShelfPeak;
  diskColor = mix(diskColor, max(diskColor, warmShelf), warmShelfSupport);

  float sourceCoreSupport = candidateWeight
    * directTransferWeight
    * smoothstep(0.055, 0.24, sourceHighFrequency);
  float sourceCorePeak = min(0.84, directPeak + sourceHighFrequency * 0.22);
  vec3 sourceKnifeCore = vec3(1.0, 0.965, 0.84) * sourceCorePeak;
  diskColor = max(diskColor, sourceKnifeCore * sourceCoreSupport);
}
`;

let fragment = BASE_REFERENCE_BLACK_HOLE_FRAGMENT;
fragment = replaceOnce(
  fragment,
  "void sampleDiskSurface(float hitRadius, float hitPhi, float patternTime, out vec3 diskColor, out float diskAlpha) {",
  "void sampleDiskSurface(float hitRadius, float hitPhi, float patternTime, out vec3 diskColor, out float diskAlpha, out float sourceHighFrequency) {",
);
fragment = replaceOnce(
  fragment,
  "  float physicalLayers = mix(laneStructure * filaments, 1.0, DISK_SOURCE_DIAGNOSTIC);\n  float brightness = radialEmission * streak * grazing;",
  "  float physicalLayers = mix(laneStructure * filaments, 1.0, DISK_SOURCE_DIAGNOSTIC);\n  float broadSourceLayers = mix(0.60 + 0.18 * pow(secondaryRibbon, 1.5) + 0.12 * fineNoise, 1.0, DISK_SOURCE_DIAGNOSTIC);\n  sourceHighFrequency = max(physicalLayers - broadSourceLayers, 0.0);\n  float brightness = radialEmission * streak * grazing;",
);
fragment = replaceOnce(
  fragment,
  "\nvoid rayTracedReference() {",
  `${incidenceHelpers}\nvoid rayTracedReference() {`,
);
fragment = replaceOnce(
  fragment,
  "  bool captured = false; int diskCrossingCount = 0; vec3 accumulatedDisk = vec3(0.0); float transmittance = 1.0;",
  "  bool captured = false; int diskCrossingCount = 0; vec3 accumulatedDisk = vec3(0.0); float transmittance = 1.0; float pathLength = 0.0;",
);
fragment = replaceOnce(
  fragment,
  "    h = clamp(h * clamp(0.90 * pow(max(acceptedErrorRatio, 1e-6), -0.20), 0.55, 1.80), KERR_MIN_STEP, KERR_MAX_STEP);",
  "    float acceptedStepLength = h;\n    h = clamp(h * clamp(0.90 * pow(max(acceptedErrorRatio, 1e-6), -0.20), 0.55, 1.80), KERR_MIN_STEP, KERR_MAX_STEP);",
);
fragment = replaceOnce(
  fragment,
  "        float diskPhi = mix(previousPhi, phi, crossing); vec3 diskColor; float diskAlpha;\n        sampleDiskSurface(diskRadius, diskPhi, patternTime, diskColor, diskAlpha);\n        float colorGain = crossingColorGain(diskCrossingCount);",
  `        float diskPhi = mix(previousPhi, phi, crossing); vec3 diskColor; float diskAlpha; float sourceHighFrequency;\n        sampleDiskSurface(diskRadius, diskPhi, patternTime, diskColor, diskAlpha, sourceHighFrequency);\n        if (diskCrossingCount == 0) {\n          float hitPathLength = pathLength + crossing * acceptedStepLength;\n          float radialDirectDistance = max(OBSERVER_R - diskRadius, 1.0);\n          float pathStretch = hitPathLength / radialDirectDistance;\n          float incidenceCosine = diskLocalIncidenceCosine(diskRadius, L, kappa);\n          shapeIncidenceQualifiedDirectShoulder(candidateWeight, pathStretch, incidenceCosine, sourceHighFrequency, diskColor, diskAlpha);\n        }\n        float colorGain = crossingColorGain(diskCrossingCount);`,
);
fragment = replaceOnce(
  fragment,
  "    previousSide = side;",
  "    pathLength += acceptedStepLength;\n    previousSide = side;",
);

export const REFERENCE_BLACK_HOLE_FRAGMENT = fragment;
export { REFERENCE_BLACK_HOLE_INFO, REFERENCE_BLACK_HOLE_VERTEX };
