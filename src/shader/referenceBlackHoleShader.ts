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

void kerrSensitivityDerivative(
  float r, float theta, float pr, float ptheta, float L, float kappa,
  float sr, float stheta, float spr, float sptheta, float sL, float sKappa,
  out float dsr, out float dstheta, out float dspr, out float dsptheta
) {
  float sensitivityScale = max(
    1.0,
    max(max(abs(sr), abs(stheta)), max(max(abs(spr), abs(sptheta)), max(abs(sL), abs(sKappa))))
  );
  float eps = 1e-4 / sensitivityScale;
  float drPlus; float dthetaPlus; float dphiPlus; float dprPlus; float dpthetaPlus;
  float drMinus; float dthetaMinus; float dphiMinus; float dprMinus; float dpthetaMinus;
  kerrDerivatives(
    r + eps * sr, theta + eps * stheta, pr + eps * spr, ptheta + eps * sptheta,
    L + eps * sL, kappa + eps * sKappa,
    drPlus, dthetaPlus, dphiPlus, dprPlus, dpthetaPlus
  );
  kerrDerivatives(
    r - eps * sr, theta - eps * stheta, pr - eps * spr, ptheta - eps * sptheta,
    L - eps * sL, kappa - eps * sKappa,
    drMinus, dthetaMinus, dphiMinus, dprMinus, dpthetaMinus
  );
  float invSpan = 0.5 / eps;
  dsr = (drPlus - drMinus) * invSpan;
  dstheta = (dthetaPlus - dthetaMinus) * invSpan;
  dspr = (dprPlus - dprMinus) * invSpan;
  dsptheta = (dpthetaPlus - dpthetaMinus) * invSpan;
}

void shapeIncidenceQualifiedDirectShoulder(
  float candidateWeight,
  float pathStretch,
  float incidenceCosine,
  float polarMomentum,
  float incidenceJacobian,
  float radialTransferCompression,
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
    * radialTransferCompression;
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
  "  initDngrCameraRay(cameraPlane.x, cameraPlane.y, r, theta, phi, pr, ptheta, L, kappa);",
  `  initDngrCameraRay(cameraPlane.x, cameraPlane.y, r, theta, phi, pr, ptheta, L, kappa);\n  const float tangentBundleEpsilon = 0.002;\n  float trPlus; float ttPlus; float tpPlus; float tprPlus; float tptPlus; float tLPlus; float tkPlus;\n  float trMinus; float ttMinus; float tpMinus; float tprMinus; float tptMinus; float tLMinus; float tkMinus;\n  initDngrCameraRay(cameraPlane.x, cameraPlane.y + tangentBundleEpsilon, trPlus, ttPlus, tpPlus, tprPlus, tptPlus, tLPlus, tkPlus);\n  initDngrCameraRay(cameraPlane.x, cameraPlane.y - tangentBundleEpsilon, trMinus, ttMinus, tpMinus, tprMinus, tptMinus, tLMinus, tkMinus);\n  float tangentInvSpan = 0.5 / tangentBundleEpsilon;\n  float sr = (trPlus - trMinus) * tangentInvSpan;\n  float stheta = (ttPlus - ttMinus) * tangentInvSpan;\n  float spr = (tprPlus - tprMinus) * tangentInvSpan;\n  float sptheta = (tptPlus - tptMinus) * tangentInvSpan;\n  float sL = (tLPlus - tLMinus) * tangentInvSpan;\n  float sKappa = (tkPlus - tkMinus) * tangentInvSpan;`,
);
fragment = replaceOnce(
  fragment,
  "  bool captured = false; int diskCrossingCount = 0; vec3 accumulatedDisk = vec3(0.0); float transmittance = 1.0;",
  "  bool captured = false; int diskCrossingCount = 0; vec3 accumulatedDisk = vec3(0.0); float transmittance = 1.0; float pathLength = 0.0; float previousSr = sr; float previousStheta = stheta;",
);
fragment = replaceOnce(
  fragment,
  "    previousR = r; previousPhi = phi;",
  "    previousR = r; previousPhi = phi; previousSr = sr; previousStheta = stheta;",
);
fragment = replaceOnce(
  fragment,
  "    h = clamp(h * clamp(0.90 * pow(max(acceptedErrorRatio, 1e-6), -0.20), 0.55, 1.80), KERR_MIN_STEP, KERR_MAX_STEP);",
  "    float acceptedStepLength = h;\n    float dsr; float dstheta; float dspr; float dsptheta;\n    kerrSensitivityDerivative(r, theta, pr, ptheta, L, kappa, sr, stheta, spr, sptheta, sL, sKappa, dsr, dstheta, dspr, dsptheta);\n    sr += dsr * acceptedStepLength; stheta += dstheta * acceptedStepLength;\n    spr += dspr * acceptedStepLength; sptheta += dsptheta * acceptedStepLength;\n    h = clamp(h * clamp(0.90 * pow(max(acceptedErrorRatio, 1e-6), -0.20), 0.55, 1.80), KERR_MIN_STEP, KERR_MAX_STEP);",
);
fragment = replaceOnce(
  fragment,
  "        sampleDiskSurface(diskRadius, diskPhi, patternTime, diskColor, diskAlpha);\n        float colorGain = crossingColorGain(diskCrossingCount);",
  `        sampleDiskSurface(diskRadius, diskPhi, patternTime, diskColor, diskAlpha);\n        if (diskCrossingCount == 0) {\n          float hitPathLength = pathLength + crossing * acceptedStepLength;\n          float radialDirectDistance = max(OBSERVER_R - diskRadius, 1.0);\n          float pathStretch = hitPathLength / radialDirectDistance;\n          float incidenceCosine = diskLocalIncidenceCosine(diskRadius, L, kappa);\n          float polarMomentum = diskLocalPolarMomentum(diskRadius, L, kappa);\n          float incidenceJacobian = diskIncidenceCameraJacobian(diskRadius, cameraPlane);\n          float hitSr = mix(previousSr, sr, crossing);\n          float hitStheta = mix(previousStheta, stheta, crossing);\n          float hitDr; float hitDtheta; float hitDphi; float hitDpr; float hitDptheta;\n          kerrDerivatives(diskRadius, 0.5 * PI, pr, ptheta, L, kappa, hitDr, hitDtheta, hitDphi, hitDpr, hitDptheta);\n          float safeHitDtheta = hitDtheta < 0.0 ? min(hitDtheta, -1e-5) : max(hitDtheta, 1e-5);\n          float diskRadiusSensitivity = hitSr - hitDr * hitStheta / safeHitDtheta;\n          float radialTransferSlope = abs(diskRadiusSensitivity) / max(diskRadius, 1.0);\n          float radialTransferCompression = 1.0 / (1.0 + radialTransferSlope);\n          shapeIncidenceQualifiedDirectShoulder(candidateWeight, pathStretch, incidenceCosine, polarMomentum, incidenceJacobian, radialTransferCompression, diskColor, diskAlpha);\n        }\n        float colorGain = crossingColorGain(diskCrossingCount);`,
);
fragment = replaceOnce(
  fragment,
  "    previousSide = side;",
  "    pathLength += acceptedStepLength;\n    previousSide = side;",
);

export const REFERENCE_BLACK_HOLE_FRAGMENT = fragment;
export { REFERENCE_BLACK_HOLE_INFO, REFERENCE_BLACK_HOLE_VERTEX };
