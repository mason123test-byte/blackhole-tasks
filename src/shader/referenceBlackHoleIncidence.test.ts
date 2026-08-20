import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("incidence-qualified direct-disk photometry", () => {
  it("uses a local disk-hit incidence invariant with path stretch only as support", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float diskLocalIncidenceCosine(float diskRadius, float L, float kappa)",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float equatorialPtheta = sqrt(max(kappa - KERR_A2 - L * L, 0.0));",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float localPhi = abs(L) * diskRadius / max(equatorialSigmaMetric, 1e-4);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float grazingWeight = 1.0 - smoothstep(0.07, 0.26, incidenceCosine);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float directTransferWeight = shortPathWeight * grazingWeight;",
    );
  });

  it("suppresses only the higher mid-bright shoulder while protecting low light and the core", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float shoulderBand = smoothstep(0.58, 0.72, directPeak)",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "* (1.0 - smoothstep(0.78, 0.90, directPeak));",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float coreProtect = smoothstep(0.80, 0.94, directPeak)",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "diskColor *= mix(1.0, 0.38, shoulderSuppression);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("screen.y <");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("fakeAnnulus");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("mirroredUv");
  });

  it("leaves Kerr geometry and crossing structure frozen", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float OBSERVER_THETA = 1.515;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_OUTER = 35.00;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("#define N_STEPS 176");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const int MAX_DISK_CROSSINGS = 4;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "shapeIncidenceQualifiedDirectShoulder(candidateWeight, pathStretch, incidenceCosine, diskColor, diskAlpha);",
    );
  });
});
