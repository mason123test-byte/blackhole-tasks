import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("incidence-qualified direct-disk warm shelf with transfer curvature", () => {
  it("keeps the #561/#571 physical incidence and path-stretch classifier unchanged", () => {
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
  });

  it("keeps the accepted nonlinear sub-white warm shelf unchanged", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float warmShelfSupport = smoothstep(0.22, 0.68, shoulderSuppression);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float warmShelfPeak = min(0.68, max(0.0, directPeak * 0.94));",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "vec3 warmShelf = vec3(1.0, 0.93, 0.74) * warmShelfPeak;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "diskColor = mix(diskColor, max(diskColor, warmShelf), warmShelfSupport);",
    );
  });

  it("uses a three-point second-order polar transfer curvature proxy without tracing neighbor geodesics", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float bundleEpsilon = 0.002;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "initDngrCameraRay(cameraPlane.x, cameraPlane.y + bundleEpsilon",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "initDngrCameraRay(cameraPlane.x, cameraPlane.y - bundleEpsilon",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float curvatureNumerator = abs(polarPlus - 2.0 * polarMomentum + polarMinus);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float foldCurvature = curvatureNumerator / slopeSpan;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float causticCurvatureWeight = smoothstep(0.08, 0.22, foldCurvature);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "* causticCurvatureWeight;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("incidenceJacobian");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("polarPathCoherence");
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
