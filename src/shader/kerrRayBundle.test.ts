import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("Kerr critical-curve ray-bundle sampling", () => {
  it("supersamples almost-trapped candidate rays with neighboring physical camera rays", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("void traceKerrSample(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("out float criticalHint");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float minRayRadius = r;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("minRayRadius = min(minRayRadius, r);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("criticalHint = step(minRayRadius, 5.8);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("vec2 rayBundlePixel = vec2(2.0 * aspect / u_resolution.x, 2.0 / u_resolution.y) * cameraHalfTan;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("cameraPlane + rayBundlePixel * 0.35");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("cameraPlane - rayBundlePixel * 0.35");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("screen.y < 0.0");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("referenceUv.y > 0.5");
  });
});
