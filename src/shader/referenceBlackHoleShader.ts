import {
  REFERENCE_BLACK_HOLE_FRAGMENT as BASE_REFERENCE_BLACK_HOLE_FRAGMENT,
  REFERENCE_BLACK_HOLE_INFO,
  REFERENCE_BLACK_HOLE_VERTEX,
} from "./referenceBlackHoleShaderBaseline";

function replaceShaderAnchor(source: string, anchor: string, replacement: string, label: string) {
  const index = source.indexOf(anchor);
  if (index < 0) {
    throw new Error(`Missing black-hole shader anchor: ${label}`);
  }
  return source.slice(0, index) + replacement + source.slice(index + anchor.length);
}

const shortPathPhotometry = `void shapeShortPathDirectPhotometry(float candidateWeight, float pathStretch, inout vec3 diskColor, float diskAlpha) {
  float shortPathWeight = 1.0 - smoothstep(1.05, 1.45, pathStretch);
  float directPeak = max(diskColor.r, max(diskColor.g, diskColor.b));
  float directCore = smoothstep(0.64, 0.88, directPeak)
    * smoothstep(0.50, 0.76, diskAlpha);
  float directResponse = directCore * directCore;
  float directColorGain = mix(0.32, 1.00, directResponse);
  vec3 directWarmCore = vec3(0.98, 0.91, 0.72) * min(0.93, directPeak * 1.02);
  vec3 shapedDirect = diskColor * directColorGain;
  shapedDirect = mix(shapedDirect, max(shapedDirect, directWarmCore), directResponse * 0.38);
  diskColor = mix(diskColor, shapedDirect, candidateWeight * shortPathWeight);
}

`;

let candidateFragment = replaceShaderAnchor(
  BASE_REFERENCE_BLACK_HOLE_FRAGMENT,
  "void rayTracedReference() {",
  `${shortPathPhotometry}void rayTracedReference() {`,
  "ray-trace entry",
);

candidateFragment = replaceShaderAnchor(
  candidateFragment,
  "  float dilation = mix(1.0, DILATION_MIN, u_expanded); float patternTime = u_time * dilation; float h = 0.90;",
  "  float affinePathLength = 0.0;\n  float dilation = mix(1.0, DILATION_MIN, u_expanded); float patternTime = u_time * dilation; float h = 0.90;",
  "path accumulator",
);

candidateFragment = replaceShaderAnchor(
  candidateFragment,
  "    previousR = r; previousPhi = phi;",
  "    float acceptedStepLength = h;\n    float pathBeforeStep = affinePathLength;\n    affinePathLength += acceptedStepLength;\n    previousR = r; previousPhi = phi;",
  "accepted-step path accounting",
);

candidateFragment = replaceShaderAnchor(
  candidateFragment,
  "        float colorGain = crossingColorGain(diskCrossingCount);",
  "        float hitPathLength = pathBeforeStep + crossing * acceptedStepLength;\n        float radialDirectDistance = max(OBSERVER_R - diskRadius, 1.0);\n        float pathStretch = hitPathLength / radialDirectDistance;\n        if (diskCrossingCount == 0) {\n          shapeShortPathDirectPhotometry(candidateWeight, pathStretch, diskColor, diskAlpha);\n        }\n        float colorGain = crossingColorGain(diskCrossingCount);",
  "first-crossing path classification",
);

export const REFERENCE_BLACK_HOLE_FRAGMENT = candidateFragment;
export { REFERENCE_BLACK_HOLE_INFO, REFERENCE_BLACK_HOLE_VERTEX };
