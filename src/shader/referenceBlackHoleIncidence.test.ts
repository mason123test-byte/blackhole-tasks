import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("incidence-qualified direct-disk propagated Jacobi core", () => {
  it("keeps the accepted #561/#571 transfer classifier and warm shelf unchanged", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float shortPathWeight = 1.0 - smoothstep(1.05, 1.45, pathStretch);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float grazingWeight = 1.0 - smoothstep(0.07, 0.26, incidenceCosine);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float shoulderBand = smoothstep(0.58, 0.72, directPeak)",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "* (1.0 - smoothstep(0.78, 0.90, directPeak));",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "diskColor *= mix(1.0, 0.38, shoulderSuppression);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float warmShelfSupport = smoothstep(0.22, 0.68, shoulderSuppression);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "diskColor = mix(diskColor, max(diskColor, warmShelf), warmShelfSupport);",
    );
  });

  it("keeps #599 continuity gates and adds one propagated scalar Jacobi focusing state", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float polarMomentumCoherence = 1.0 - smoothstep(0.10, 0.22, polarMomentum);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float compactBundleWeight = smoothstep(3.2, 5.2, incidenceJacobian);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float jacobiSeparation = 0.0; float jacobiSlope = 1.0;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float opticalTidalCurvature = 3.0 / max(r * r * r, 1.0);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "jacobiSlope -= opticalTidalCurvature * jacobiSeparation * acceptedStepLength;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float jacobiCompression = clamp(1.0 - jacobiScale, 0.0, 1.0);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float jacobiFocusingWeight = smoothstep(0.035, 0.11, jacobiCompression);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("momentumShearWeight");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("transferAreaWeight");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("foldCurvature");
  });

  it("keeps geometry and forbidden screen-space paths unchanged", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float OBSERVER_THETA = 1.515;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_OUTER = 35.00;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("#define N_STEPS 176");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const int MAX_DISK_CROSSINGS = 4;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("screen.y <");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("fakeAnnulus");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("mirroredUv");
  });
});
