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

float diskLocalPolarMomentum(float diskRadius, float L, float kappa) {
  float equatorialPtheta = sqrt(max(kappa - KERR_A2 - L * L, 0.0));
  return equatorialPtheta / max(diskRadius, 1e-4);
}

float diskIncidenceCameraJacobian(float diskRadius, vec2 cameraPlane) {
  const float bundleEpsilon = 0.002;
  float rPlus; float thetaPlus; float phiPlus; float prPlus; float pthetaPlus; float LPlus; float kappaPlus;
  float rMinus; float thetaMinus; float phiMinus; float prMinus; float pthetaMinus; float LMinus; float kappaMinus;
  initDngrCameraRay(cameraPlane.x, cameraPlane.y + bundleEpsilon, rPlus, thetaPlus, phiPlus, prPlus, pthetaPlus, LPlus, kappaPlus);
  initDngrCameraRay(cameraPlane.x, cameraPlane.y - bundleEpsilon, rMinus, thetaMinus, phiMinus, prMinus, pthetaMinus, LMinus, kappaMinus);
  float incidencePlus = diskLocalIncidenceCosine(diskRadius, LPlus, kappaPlus);
  float incidenceMinus = diskLocalIncidenceCosine(diskRadius, LMinus, kappaMinus);
  return abs(incidencePlus - incidenceMinus) / (2.0 * bundleEpsilon);
}

void shapeIncidenceQualifiedDirectShoulder(
  float candidateWeight,
  float pathStretch,
  float incidenceCosine,
  float polarMomentum,
  float incidenceJacobian,
  float jacobiRankDeficiency,
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

  float polarMomentumCoherence = 1.0 - smoothstep(0.10, 0.22, polarMomentum);
  float compactBundleWeight = smoothstep(3.2, 5.2, incidenceJacobian);
  float transferCoreSupport = candidateWeight
    * directTransferWeight
    * polarMomentumCoherence
    * compactBundleWeight
    * jacobiRankDeficiency;
  vec3 transferKnifeCore = vec3(1.0, 0.965, 0.84) * 0.82;
  diskColor = max(diskColor, transferKnifeCore * transferCoreSupport);
}
`;

let fragment = BASE_REFERENCE_BLACK_HOLE_FRAGMENT;
fragment = replaceOnce(
  fragment,
  "\nvoid rayTracedReference() {",
  `${incidenceHelpers}\nvoid rayTracedReference() {`,
);
fragment = replaceOnce(
  fragment,
  "  bool captured = false; int diskCrossingCount = 0; vec3 accumulatedDisk = vec3(0.0); float transmittance = 1.0;",
  "  bool captured = false; int diskCrossingCount = 0; vec3 accumulatedDisk = vec3(0.0); float transmittance = 1.0; float pathLength = 0.0; float j00 = 0.0; float j01 = 0.0; float j10 = 0.0; float j11 = 0.0; float v00 = 1.0; float v01 = 0.0; float v10 = 0.0; float v11 = 1.0;",
);
fragment = replaceOnce(
  fragment,
  "    h = clamp(h * clamp(0.90 * pow(max(acceptedErrorRatio, 1e-6), -0.20), 0.55, 1.80), KERR_MIN_STEP, KERR_MAX_STEP);",
  "    float acceptedStepLength = h;\n    h = clamp(h * clamp(0.90 * pow(max(acceptedErrorRatio, 1e-6), -0.20), 0.55, 1.80), KERR_MIN_STEP, KERR_MAX_STEP);",
);
fragment = replaceOnce(
  fragment,
  "        sampleDiskSurface(diskRadius, diskPhi, patternTime, diskColor, diskAlpha);\n        float colorGain = crossingColorGain(diskCrossingCount);",
  `        sampleDiskSurface(diskRadius, diskPhi, patternTime, diskColor, diskAlpha);\n        if (diskCrossingCount == 0) {\n          float hitPathLength = pathLength + crossing * acceptedStepLength;\n          float radialDirectDistance = max(OBSERVER_R - diskRadius, 1.0);\n          float pathStretch = hitPathLength / radialDirectDistance;\n          float incidenceCosine = diskLocalIncidenceCosine(diskRadius, L, kappa);\n          float polarMomentum = diskLocalPolarMomentum(diskRadius, L, kappa);\n          float incidenceJacobian = diskIncidenceCameraJacobian(diskRadius, cameraPlane);\n          float partialStep = crossing * acceptedStepLength;\n          float hj00 = j00 + v00 * partialStep;\n          float hj01 = j01 + v01 * partialStep;\n          float hj10 = j10 + v10 * partialStep;\n          float hj11 = j11 + v11 * partialStep;\n          float invPath = 1.0 / max(hitPathLength, 1e-4);\n          hj00 *= invPath; hj01 *= invPath; hj10 *= invPath; hj11 *= invPath;\n          float jacobiFrobenius2 = hj00 * hj00 + hj01 * hj01 + hj10 * hj10 + hj11 * hj11;\n          float jacobiDeterminant = abs(hj00 * hj11 - hj01 * hj10);\n          float jacobiRankRatio = clamp(2.0 * jacobiDeterminant / max(jacobiFrobenius2, 1e-5), 0.0, 1.0);\n          float jacobiRankDeficiency = 1.0 - jacobiRankRatio;\n          shapeIncidenceQualifiedDirectShoulder(candidateWeight, pathStretch, incidenceCosine, polarMomentum, incidenceJacobian, jacobiRankDeficiency, diskColor, diskAlpha);\n        }\n        float colorGain = crossingColorGain(diskCrossingCount);`,
);
fragment = replaceOnce(
  fragment,
  "    previousSide = side;",
  "    float opticalTidalCurvature = 3.0 / max(r * r * r, 1.0);\n    float momentumNorm2 = max(pr * pr + ptheta * ptheta, 1e-5);\n    float tidalCos2 = (pr * pr - ptheta * ptheta) / momentumNorm2;\n    float tidalSin2 = (2.0 * pr * ptheta) / momentumNorm2;\n    float t00 = opticalTidalCurvature * tidalCos2;\n    float t01 = opticalTidalCurvature * tidalSin2;\n    float t10 = t01;\n    float t11 = -t00;\n    float a00 = -(t00 * j00 + t01 * j10);\n    float a10 = -(t10 * j00 + t11 * j10);\n    float a01 = -(t00 * j01 + t01 * j11);\n    float a11 = -(t10 * j01 + t11 * j11);\n    v00 += a00 * acceptedStepLength; v10 += a10 * acceptedStepLength;\n    v01 += a01 * acceptedStepLength; v11 += a11 * acceptedStepLength;\n    j00 += v00 * acceptedStepLength; j10 += v10 * acceptedStepLength;\n    j01 += v01 * acceptedStepLength; j11 += v11 * acceptedStepLength;\n    pathLength += acceptedStepLength;\n    previousSide = side;",
);

export const REFERENCE_BLACK_HOLE_FRAGMENT = fragment;
export { REFERENCE_BLACK_HOLE_INFO, REFERENCE_BLACK_HOLE_VERTEX };
