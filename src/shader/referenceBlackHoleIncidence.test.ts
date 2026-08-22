import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("incidence-qualified full-Kerr first-hit transfer Jacobian core", () => {
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

  it("propagates both camera-plane Kerr tangent directions into the physical first-hit map", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("void kerrTangentDerivative(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "initDngrCameraRay(cameraPlane.x + tangentBundleEpsilon, cameraPlane.y",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "initDngrCameraRay(cameraPlane.x, cameraPlane.y + tangentBundleEpsilon",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float dRadiusRight = hitSrR - hitDr * hitStR / safeHitDtheta;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float dPhiUp = hitSpU - hitDphi * hitStU / safeHitDtheta;",
    );
  });

  it("uses a scale-free first-hit rank observable without a new threshold scan", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "vec2 radialGradient = vec2(dRadiusRight, dRadiusUp) / max(diskRadius, 1.0);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "vec2 azimuthGradient = vec2(dPhiRight, dPhiUp);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float transferRankDeficiency = 1.0 - clamp(transferRankRatio, 0.0, 1.0);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("radialTransferCompression");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("transferRankWeight = smoothstep");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("opticalTidalCurvature");
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
