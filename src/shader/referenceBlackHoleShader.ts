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

void kerrTangentDerivative(
  float r, float theta, float pr, float ptheta, float L, float kappa,
  float sr, float stheta, float sphi, float spr, float sptheta, float sL, float sKappa,
  out float dsr, out float dstheta, out float dsphi, out float dspr, out float dsptheta
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
  dsphi = (dphiPlus - dphiMinus) * invSpan;
  dspr = (dprPlus - dprMinus) * invSpan;
  dsptheta = (dpthetaPlus - dpthetaMinus) * invSpan;
}

vec2 tangentPrincipalAxis2(
  float r,
  float srRight,
  float sthetaRight,
  float srUp,
  float sthetaUp
) {
  vec2 radialRow = vec2(srRight, srUp) / max(r, 1.0);
  vec2 polarRow = vec2(sthetaRight, sthetaUp);
  float c00 = dot(radialRow, radialRow);
  float c01 = dot(radialRow, polarRow);
  float c11 = dot(polarRow, polarRow);
  vec2 axis2 = vec2(c00 - c11, 2.0 * c01);
  float axisNorm = length(axis2);
  return axisNorm > 1e-6 ? axis2 / axisNorm : vec2(1.0, 0.0);
}

void shapeIncidenceQualifiedDirectShoulder(
  float candidateWeight,
  float pathStretch,
  float incidenceCosine,
  float polarMomentum,
  float incidenceJacobian,
  float principalAxisTwistSupport,
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
    * principalAxisTwistSupport;
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
  `  initDngrCameraRay(cameraPlane.x, cameraPlane.y, r, theta, phi, pr, ptheta, L, kappa);\n  const float tangentBundleEpsilon = 0.002;\n  float rrPlus; float rtPlus; float rpPlus; float rprPlus; float rptPlus; float rLPlus; float rkPlus;\n  float rrMinus; float rtMinus; float rpMinus; float rprMinus; float rptMinus; float rLMinus; float rkMinus;\n  initDngrCameraRay(cameraPlane.x + tangentBundleEpsilon, cameraPlane.y, rrPlus, rtPlus, rpPlus, rprPlus, rptPlus, rLPlus, rkPlus);\n  initDngrCameraRay(cameraPlane.x - tangentBundleEpsilon, cameraPlane.y, rrMinus, rtMinus, rpMinus, rprMinus, rptMinus, rLMinus, rkMinus);\n  float urPlus; float utPlus; float upPlus; float uprPlus; float uptPlus; float uLPlus; float ukPlus;\n  float urMinus; float utMinus; float upMinus; float uprMinus; float uptMinus; float uLMinus; float ukMinus;\n  initDngrCameraRay(cameraPlane.x, cameraPlane.y + tangentBundleEpsilon, urPlus, utPlus, upPlus, uprPlus, uptPlus, uLPlus, ukPlus);\n  initDngrCameraRay(cameraPlane.x, cameraPlane.y - tangentBundleEpsilon, urMinus, utMinus, upMinus, uprMinus, uptMinus, uLMinus, ukMinus);\n  float tangentInvSpan = 0.5 / tangentBundleEpsilon;\n  float srR = (rrPlus - rrMinus) * tangentInvSpan; float stR = (rtPlus - rtMinus) * tangentInvSpan;\n  float spR = (rpPlus - rpMinus) * tangentInvSpan; float sprR = (rprPlus - rprMinus) * tangentInvSpan;\n  float sptR = (rptPlus - rptMinus) * tangentInvSpan; float sLR = (rLPlus - rLMinus) * tangentInvSpan; float sKR = (rkPlus - rkMinus) * tangentInvSpan;\n  float srU = (urPlus - urMinus) * tangentInvSpan; float stU = (utPlus - utMinus) * tangentInvSpan;\n  float spU = (upPlus - upMinus) * tangentInvSpan; float sprU = (uprPlus - uprMinus) * tangentInvSpan;\n  float sptU = (uptPlus - uptMinus) * tangentInvSpan; float sLU = (uLPlus - uLMinus) * tangentInvSpan; float sKU = (ukPlus - ukMinus) * tangentInvSpan;\n  vec2 principalAxis2 = tangentPrincipalAxis2(r, srR, stR, srU, stU);`,
);
fragment = replaceOnce(
  fragment,
  "  bool captured = false; int diskCrossingCount = 0; vec3 accumulatedDisk = vec3(0.0); float transmittance = 1.0;",
  "  bool captured = false; int diskCrossingCount = 0; vec3 accumulatedDisk = vec3(0.0); float transmittance = 1.0; float pathLength = 0.0; float principalAxisTwist = 0.0; float lastAxisTwistStep = 0.0;",
);
fragment = replaceOnce(
  fragment,
  "    previousR = r; previousPhi = phi;",
  `    float acceptedStepLength = h;\n    previousR = r; previousPhi = phi;\n    float dsrR; float dstR; float dspR; float dsprR; float dsptR;\n    float dsrU; float dstU; float dspU; float dsprU; float dsptU;\n    kerrTangentDerivative(r, theta, pr, ptheta, L, kappa, srR, stR, spR, sprR, sptR, sLR, sKR, dsrR, dstR, dspR, dsprR, dsptR);\n    kerrTangentDerivative(r, theta, pr, ptheta, L, kappa, srU, stU, spU, sprU, sptU, sLU, sKU, dsrU, dstU, dspU, dsprU, dsptU);\n    float nextSrR = srR + dsrR * acceptedStepLength; float nextStR = stR + dstR * acceptedStepLength; float nextSpR = spR + dspR * acceptedStepLength;\n    float nextSprR = sprR + dsprR * acceptedStepLength; float nextSptR = sptR + dsptR * acceptedStepLength;\n    float nextSrU = srU + dsrU * acceptedStepLength; float nextStU = stU + dstU * acceptedStepLength; float nextSpU = spU + dspU * acceptedStepLength;\n    float nextSprU = sprU + dsprU * acceptedStepLength; float nextSptU = sptU + dsptU * acceptedStepLength;`,
);
fragment = replaceOnce(
  fragment,
  "    normalizePolarState(theta, phi, ptheta); projectKerrMomenta(r, theta, L, kappa, pr, ptheta);",
  `    normalizePolarState(theta, phi, ptheta); projectKerrMomenta(r, theta, L, kappa, pr, ptheta);\n    srR = nextSrR; stR = nextStR; spR = nextSpR; sprR = nextSprR; sptR = nextSptR;\n    srU = nextSrU; stU = nextStU; spU = nextSpU; sprU = nextSprU; sptU = nextSptU;\n    vec2 nextPrincipalAxis2 = tangentPrincipalAxis2(r, srR, stR, srU, stU);\n    lastAxisTwistStep = 0.5 * acos(clamp(dot(principalAxis2, nextPrincipalAxis2), -1.0, 1.0));\n    principalAxisTwist += lastAxisTwistStep;\n    principalAxis2 = nextPrincipalAxis2;`,
);
fragment = replaceOnce(
  fragment,
  "        sampleDiskSurface(diskRadius, diskPhi, patternTime, diskColor, diskAlpha);\n        float colorGain = crossingColorGain(diskCrossingCount);",
  `        sampleDiskSurface(diskRadius, diskPhi, patternTime, diskColor, diskAlpha);\n        if (diskCrossingCount == 0) {\n          float hitPathLength = pathLength + crossing * acceptedStepLength;\n          float radialDirectDistance = max(OBSERVER_R - diskRadius, 1.0);\n          float pathStretch = hitPathLength / radialDirectDistance;\n          float incidenceCosine = diskLocalIncidenceCosine(diskRadius, L, kappa);\n          float polarMomentum = diskLocalPolarMomentum(diskRadius, L, kappa);\n          float incidenceJacobian = diskIncidenceCameraJacobian(diskRadius, cameraPlane);\n          float hitPrincipalAxisTwist = principalAxisTwist - (1.0 - crossing) * lastAxisTwistStep;\n          float principalAxisTwistSupport = clamp(hitPrincipalAxisTwist / (0.5 * PI), 0.0, 1.0);\n          shapeIncidenceQualifiedDirectShoulder(candidateWeight, pathStretch, incidenceCosine, polarMomentum, incidenceJacobian, principalAxisTwistSupport, diskColor, diskAlpha);\n        }\n        float colorGain = crossingColorGain(diskCrossingCount);`,
);
fragment = replaceOnce(
  fragment,
  "    previousSide = side;",
  "    pathLength += acceptedStepLength;\n    previousSide = side;",
);

export const REFERENCE_BLACK_HOLE_FRAGMENT = fragment;
export { REFERENCE_BLACK_HOLE_INFO, REFERENCE_BLACK_HOLE_VERTEX };
