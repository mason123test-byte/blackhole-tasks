import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("incidence-qualified Kerr tangent-linear transfer core", () => {
  it("keeps accepted #571 and frozen #599 semantics unchanged", () => {
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

  it("propagates a full-Kerr tangent sensitivity rather than a simplified Jacobi proxy", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "void kerrSensitivityDerivative(",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "r + eps * sr, theta + eps * stheta, pr + eps * spr, ptheta + eps * sptheta",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "sr += dsr * acceptedStepLength; stheta += dstheta * acceptedStepLength;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float diskRadiusSensitivity = hitSr - hitDr * hitStheta / safeHitDtheta;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float radialTransferCompression = 1.0 / (1.0 + radialTransferSlope);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("opticalTidalCurvature");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("frameDragFraction");
  });

  it("does not trace a second geodesic or add a new compression threshold", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("radialTransferWeight = smoothstep");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("traceNeighbor");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("screen.y <");
  });

  it("keeps frozen geometry", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float OBSERVER_THETA = 1.515;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_OUTER = 35.00;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("#define N_STEPS 176");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const int MAX_DISK_CROSSINGS = 4;");
  });
});
