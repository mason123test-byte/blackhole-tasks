import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("incidence-qualified actual-Kerr configuration-momentum focusing history core", () => {
  it("keeps accepted #571 and frozen #599 continuity semantics unchanged", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float shortPathWeight = 1.0 - smoothstep(1.05, 1.45, pathStretch);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float grazingWeight = 1.0 - smoothstep(0.07, 0.26, incidenceCosine);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float polarMomentumCoherence = 1.0 - smoothstep(0.10, 0.22, polarMomentum);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float compactBundleWeight = smoothstep(3.2, 5.2, incidenceJacobian);",
    );
  });

  it("propagates two camera tangents through the actual Kerr derivative field", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("void kerrTangentDerivative(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "initDngrCameraRay(cameraPlane.x + tangentBundleEpsilon, cameraPlane.y",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "initDngrCameraRay(cameraPlane.x, cameraPlane.y + tangentBundleEpsilon",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "kerrTangentDerivative(r, theta, pr, ptheta, L, kappa, srR",
    );
  });

  it("uses threshold-free pre-hit configuration-momentum focusing alignment history", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float tangentPhaseFocusingAlignment(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "return clamp(-dot(configurationDisplacement, momentumDisplacement) / normalization, 0.0, 1.0);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "strongestFocusingAlignment = max(strongestFocusingAlignment, focusingAlignment);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "incidenceJacobian, strongestFocusingAlignment, diskColor, diskAlpha",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("principalAxisTwist");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("sigmaMin");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("transferRankDeficiency");
  });

  it("keeps frozen geometry and forbidden screen-space paths unchanged", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float OBSERVER_THETA = 1.515;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_OUTER = 35.00;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("#define N_STEPS 176");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const int MAX_DISK_CROSSINGS = 4;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("screen.y <");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("fakeAnnulus");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("mirroredUv");
  });
});
