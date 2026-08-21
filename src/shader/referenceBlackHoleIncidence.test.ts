import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("incidence-qualified direct-disk camera-Jacobian core", () => {
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

  it("keeps #585 polar continuity but qualifies it with a local screen-to-transfer incidence Jacobian", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float diskLocalPolarMomentum(float diskRadius, float L, float kappa)",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float diskIncidenceCameraJacobian(float diskRadius, vec2 cameraPlane)",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "const float bundleEpsilon = 0.002;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "initDngrCameraRay(cameraPlane.x, cameraPlane.y + bundleEpsilon",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "initDngrCameraRay(cameraPlane.x, cameraPlane.y - bundleEpsilon",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float polarMomentumCoherence = 1.0 - smoothstep(0.10, 0.22, polarMomentum);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float compactBundleWeight = smoothstep(3.2, 5.2, incidenceJacobian);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "* polarMomentumCoherence\n    * compactBundleWeight;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("polarTravel");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("sourceHighFrequency");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("ridgeNeighborPeak");
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
