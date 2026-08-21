import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("incidence-qualified direct-disk two-polarization Jacobi shear core", () => {
  it("keeps the accepted #561/#571 transfer classifier and warm shelf unchanged", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float shortPathWeight = 1.0 - smoothstep(1.05, 1.45, pathStretch);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float grazingWeight = 1.0 - smoothstep(0.07, 0.26, incidenceCosine);",
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

  it("propagates two opposite optical-tidal Jacobi polarizations and gates #599 support by shear", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float polarMomentumCoherence = 1.0 - smoothstep(0.10, 0.22, polarMomentum);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float compactBundleWeight = smoothstep(3.2, 5.2, incidenceJacobian);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float jacobiFocus = 0.0; float jacobiFocusSlope = 1.0; float jacobiDefocus = 0.0; float jacobiDefocusSlope = 1.0;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "jacobiFocusSlope -= opticalTidalCurvature * jacobiFocus * acceptedStepLength;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "jacobiDefocusSlope += opticalTidalCurvature * jacobiDefocus * acceptedStepLength;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float jacobiShear = abs(defocusScale - focusScale) / max(defocusScale + focusScale, 1e-4);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float jacobiShearWeight = smoothstep(0.045, 0.16, jacobiShear);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("jacobiCompression");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("momentumShearWeight");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("transferAreaWeight");
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
