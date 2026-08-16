import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("DNGR-sized Kerr critical beam footprint", () => {
  it("uses a two-pixel physical camera footprint only for critical Kerr rays", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("void traceKerrSample(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("criticalHint = step(minRayRadius, 5.8);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float rayBundlePixel = 2.0 * cameraHalfTan / u_resolution.y;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("vec2 bundleNormal = length(cameraPlane) > 1e-8 ? normalize(cameraPlane)");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("bundleNormal * rayBundlePixel * 2.0");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("(centerColor + bundlePlus + bundleMinus) / 3.0");
  });

  it("does not use the beam footprint to sculpt a lower screen region", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("screen.y < 0.0");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("referenceUv.y < 0.5");
  });
});
