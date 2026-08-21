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

void shapeIncidenceQualifiedDirectShoulder(
  float candidateWeight,
  float pathStretch,
  float incidenceCosine,
  float polarMomentum,
  float foldCurvature,
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
  float causticCurvatureWeight = smoothstep(0.08, 0.22, foldCurvature);
  float transferCoreSupport = candidateWeight
    * directTransferWeight
    * polarMomentumCoherence
    * causticCurvatureWeight;
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
  "  float r; float theta; float phi; float pr; float ptheta; float L; float kappa;\n  initDngrCameraRay(cameraPlane.x, cameraPlane.y, r, theta, phi, pr, ptheta, L, kappa);",
  `  float r; float theta; float phi; float pr; float ptheta; float L; float kappa;\n  initDngrCameraRay(cameraPlane.x, cameraPlane.y, r, theta, phi, pr, ptheta, L, kappa);\n  float bundleEpsilon = 0.002;\n  float rp; float thetap; float phip; float prp; float pthetap; float Lp; float kappap;\n  float rm; float thetam; float phim; float prm; float pthetam; float Lm; float kappam;\n  initDngrCameraRay(cameraPlane.x, cameraPlane.y + bundleEpsilon, rp, thetap, phip, prp, pthetap, Lp, kappap);\n  initDngrCameraRay(cameraPlane.x, cameraPlane.y - bundleEpsilon, rm, thetam, phim, prm, pthetam, Lm, kappam);`,
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
  "        sampleDiskSurface(diskRadius, diskPhi, patternTime, diskColor, diskAlpha);\n        float colorGain = crossingColorGain(diskCrossingCount);",
  `        sampleDiskSurface(diskRadius, diskPhi, patternTime, diskColor, diskAlpha);\n        if (diskCrossingCount == 0) {\n          float hitPathLength = pathLength + crossing * acceptedStepLength;\n          float radialDirectDistance = max(OBSERVER_R - diskRadius, 1.0);\n          float pathStretch = hitPathLength / radialDirectDistance;\n          float incidenceCosine = diskLocalIncidenceCosine(diskRadius, L, kappa);\n          float polarMomentum = diskLocalPolarMomentum(diskRadius, L, kappa);\n          float polarPlus = diskLocalPolarMomentum(diskRadius, Lp, kappap);\n          float polarMinus = diskLocalPolarMomentum(diskRadius, Lm, kappam);\n          float curvatureNumerator = abs(polarPlus - 2.0 * polarMomentum + polarMinus);\n          float slopeSpan = max(abs(polarPlus - polarMinus), 1e-5);\n          float foldCurvature = curvatureNumerator / slopeSpan;\n          shapeIncidenceQualifiedDirectShoulder(candidateWeight, pathStretch, incidenceCosine, polarMomentum, foldCurvature, diskColor, diskAlpha);\n        }\n        float colorGain = crossingColorGain(diskCrossingCount);`,
);
fragment = replaceOnce(
  fragment,
  "    previousSide = side;",
  "    pathLength += acceptedStepLength;\n    previousSide = side;",
);

export const REFERENCE_BLACK_HOLE_FRAGMENT = fragment;
export { REFERENCE_BLACK_HOLE_INFO, REFERENCE_BLACK_HOLE_VERTEX };
