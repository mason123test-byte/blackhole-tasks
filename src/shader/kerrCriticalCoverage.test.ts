import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("Kerr critical-curve subpixel coverage", () => {
  it("samples neighboring physical camera rays across the critical-curve normal", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("void traceKerrSample(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float minRayRadius = r;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float maxRayWinding = 0.0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("criticalHint = step(minRayRadius, 5.8);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float rayBundlePixel = 2.0 * cameraHalfTan / u_resolution.y;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "vec2 bundleNormal = length(cameraPlane) > 1e-8 ? normalize(cameraPlane) : vec2(0.0, 1.0);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "cameraPlane + bundleNormal * rayBundlePixel * 0.45",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "cameraPlane - bundleNormal * rayBundlePixel * 0.45",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("screen.y >");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("referenceUv.y >");
  });
});
