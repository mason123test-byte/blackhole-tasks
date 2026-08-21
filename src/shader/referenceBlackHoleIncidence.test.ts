import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("incidence-qualified direct-disk transfer-area core", () => {
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

  it("uses a two-axis local transfer-area Jacobian without neighbor geodesic tracing", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float diskTransferAreaJacobian(float diskRadius, vec2 cameraPlane)",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "const float bundleEpsilon = 0.002;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "initDngrCameraRay(cameraPlane.x + bundleEpsilon, cameraPlane.y",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "initDngrCameraRay(cameraPlane.x, cameraPlane.y + bundleEpsilon",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "return abs(dpDx * diDy - dpDy * diDx);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float transferAreaWeight = smoothstep(0.45, 1.35, transferAreaJacobian);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float polarMomentumCoherence = 1.0 - smoothstep(0.10, 0.22, polarMomentum);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("polarTravel");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("foldCurvature");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("sourceHighFrequency");
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
