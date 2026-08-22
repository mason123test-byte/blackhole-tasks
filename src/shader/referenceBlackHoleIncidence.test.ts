import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("incidence-qualified full-Kerr propagation-history principal-axis twist core", () => {
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

  it("propagates both actual Kerr tangent directions without tracing a second geodesic", () => {
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

  it("uses propagation-history principal-axis rotation instead of endpoint singular spectrum", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("vec2 tangentPrincipalAxis2(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "lastAxisTwistStep = 0.5 * acos(clamp(dot(principalAxis2, nextPrincipalAxis2), -1.0, 1.0));",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float hitPrincipalAxisTwist = principalAxisTwist - (1.0 - crossing) * lastAxisTwistStep;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float principalAxisTwistSupport = clamp(hitPrincipalAxisTwist / (0.5 * PI), 0.0, 1.0);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("transferRankDeficiency");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("sigmaMin");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("principalAxisTwistWeight = smoothstep");
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
