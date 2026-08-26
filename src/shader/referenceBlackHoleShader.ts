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

const experimentUniforms = String.raw`
uniform float u_visual_experiment_enabled;
uniform float u_experiment_film_disk_exposure;
uniform float u_experiment_disk_outer;
`;

const experimentHelpers = String.raw`
float visualExperimentFilmDiskExposure() {
  return u_visual_experiment_enabled > 0.5 ? u_experiment_film_disk_exposure : FILM_DISK_EXPOSURE;
}

float visualExperimentDiskOuter() {
  return u_visual_experiment_enabled > 0.5 ? u_experiment_disk_outer : DISK_OUTER;
}

float crossingOrderDiagnosticMode() {
  if (u_visual_compare < 2.5) return 0.0;
  return u_visual_compare - 2.0;
}

bool includeCrossingInDiagnostic(float diagnosticMode, int crossingIndex) {
  if (diagnosticMode < 0.5) return true;
  if (diagnosticMode < 1.5) return crossingIndex == 0;
  if (diagnosticMode < 2.5) return crossingIndex == 1;
  return crossingIndex >= 2;
}
`;

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
}
`;

let fragment = BASE_REFERENCE_BLACK_HOLE_FRAGMENT;
fragment = replaceOnce(
  fragment,
  "uniform float u_visual_compare;\n",
  `uniform float u_visual_compare;\n${experimentUniforms}`,
);
fragment = replaceOnce(
  fragment,
  "const float DISK_SOURCE_DIAGNOSTIC = 0.0;\n",
  `const float DISK_SOURCE_DIAGNOSTIC = 0.0;\n\n${experimentHelpers}`,
);
fragment = replaceOnce(
  fragment,
  "\nvoid rayTracedReference() {",
  `${incidenceHelpers}\nvoid rayTracedReference() {`,
);
fragment = replaceOnce(
  fragment,
  "  float candidateWeight = u_visual_compare < 0.5 ? 0.0 : (u_visual_compare > 1.5 ? step(0.0, screen.x) : 1.0);",
  "  float splitWeight = 1.0 - step(0.5, abs(u_visual_compare - 2.0));\n  float candidateWeight = u_visual_compare < 0.5 ? 0.0 : mix(1.0, step(0.0, screen.x), splitWeight);\n  float crossingDiagnosticMode = crossingOrderDiagnosticMode();",
);
fragment = replaceOnce(
  fragment,
  "  float outerEdge = 1.0 - smoothstep(DISK_OUTER * 0.74, DISK_OUTER * 0.995, hitRadius);",
  "  float experimentDiskOuter = visualExperimentDiskOuter();\n  float outerEdge = 1.0 - smoothstep(experimentDiskOuter * 0.74, experimentDiskOuter * 0.995, hitRadius);",
);
fragment = replaceOnce(
  fragment,
  "  float radialProgress = clamp((hitRadius - DISK_INNER) / (DISK_OUTER - DISK_INNER), 0.0, 1.0);",
  "  float radialProgress = clamp((hitRadius - DISK_INNER) / (experimentDiskOuter - DISK_INNER), 0.0, 1.0);",
);
fragment = replaceOnce(
  fragment,
  "  float cameraImpact = OBSERVER_R * length(cameraPlane);\n  if (cameraImpact > DISK_OUTER + 10.0) { outColor = sceneSample; return; }",
  "  float experimentDiskOuter = visualExperimentDiskOuter();\n  float cameraImpact = OBSERVER_R * length(cameraPlane);\n  if (cameraImpact > experimentDiskOuter + 10.0) {\n    outColor = crossingDiagnosticMode > 0.5 ? vec4(0.0, 0.0, 0.0, 1.0) : sceneSample;\n    return;\n  }",
);
fragment = replaceOnce(
  fragment,
  "      if (diskRadius > DISK_INNER && diskRadius < DISK_OUTER) {",
  "      if (diskRadius > DISK_INNER && diskRadius < experimentDiskOuter) {",
);
fragment = replaceOnce(
  fragment,
  "  brightness *= physicalLayers;\n  brightness *= mix(1.10, 0.62, smoothstep(0.04, 0.90, radialProgress)); brightness *= FILM_DISK_EXPOSURE;",
  "  brightness *= physicalLayers;\n  brightness *= mix(1.10, 0.62, smoothstep(0.04, 0.90, radialProgress)); brightness *= visualExperimentFilmDiskExposure();",
);
fragment = replaceOnce(
  fragment,
  "  bool captured = false; int diskCrossingCount = 0; vec3 accumulatedDisk = vec3(0.0); float transmittance = 1.0;",
  "  bool captured = false; int diskCrossingCount = 0; vec3 accumulatedDisk = vec3(0.0); float transmittance = 1.0; float pathLength = 0.0; float diagnosticCoverage = 0.0;",
);
fragment = replaceOnce(
  fragment,
  "    h = clamp(h * clamp(0.90 * pow(max(acceptedErrorRatio, 1e-6), -0.20), 0.55, 1.80), KERR_MIN_STEP, KERR_MAX_STEP);",
  "    float acceptedStepLength = h;\n    h = clamp(h * clamp(0.90 * pow(max(acceptedErrorRatio, 1e-6), -0.20), 0.55, 1.80), KERR_MIN_STEP, KERR_MAX_STEP);",
);
fragment = replaceOnce(
  fragment,
  "        sampleDiskSurface(diskRadius, diskPhi, patternTime, diskColor, diskAlpha);\n        float colorGain = crossingColorGain(diskCrossingCount);",
  `        sampleDiskSurface(diskRadius, diskPhi, patternTime, diskColor, diskAlpha);\n        if (diskCrossingCount == 0) {\n          float hitPathLength = pathLength + crossing * acceptedStepLength;\n          float radialDirectDistance = max(OBSERVER_R - diskRadius, 1.0);\n          float pathStretch = hitPathLength / radialDirectDistance;\n          float incidenceCosine = diskLocalIncidenceCosine(diskRadius, L, kappa);\n          shapeIncidenceQualifiedDirectShoulder(candidateWeight, pathStretch, incidenceCosine, diskColor, diskAlpha);\n        }\n        float colorGain = crossingColorGain(diskCrossingCount);`,
);
fragment = replaceOnce(
  fragment,
  "        float effectiveAlpha = clamp(diskAlpha * alphaGain, 0.0, 0.90);\n        accumulatedDisk += transmittance * (diskColor * colorGain) * effectiveAlpha;\n        transmittance *= 1.0 - effectiveAlpha;",
  "        float effectiveAlpha = clamp(diskAlpha * alphaGain, 0.0, 0.90);\n        float incomingTransmittance = transmittance;\n        if (includeCrossingInDiagnostic(crossingDiagnosticMode, diskCrossingCount)) {\n          accumulatedDisk += incomingTransmittance * (diskColor * colorGain) * effectiveAlpha;\n          diagnosticCoverage += incomingTransmittance * effectiveAlpha;\n        }\n        transmittance *= 1.0 - effectiveAlpha;",
);
fragment = replaceOnce(
  fragment,
  "    previousSide = side;",
  "    pathLength += acceptedStepLength;\n    previousSide = side;",
);
fragment = replaceOnce(
  fragment,
  "  if (diskCrossingCount > 0) {",
  "  if (crossingDiagnosticMode > 0.5) {\n    outColor = vec4(accumulatedDisk, 1.0);\n    return;\n  }\n  if (diskCrossingCount > 0) {",
);

export const REFERENCE_BLACK_HOLE_FRAGMENT = fragment;
export { REFERENCE_BLACK_HOLE_INFO, REFERENCE_BLACK_HOLE_VERTEX };
