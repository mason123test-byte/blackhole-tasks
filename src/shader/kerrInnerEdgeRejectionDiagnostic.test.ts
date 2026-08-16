import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("Kerr near-inner-edge rejection diagnostic", () => {
  it("records real equatorial crossings rejected just inside the physical disk inner edge", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float rejectedInnerDelta = 1e9;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("int rejectedInnerOrder = 0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("diskRadius > DISK_INNER - 1.0 && diskRadius <= DISK_INNER");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("rejectedInnerOrder = equatorialCrossingCount;");
  });

  it("shows rejected near-inner crossings only as diagnostic output, never as disk contribution", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("if (DISK_ORDER_DIAGNOSTIC > 0.5 && rejectedInnerOrder > 0)");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("outColor = vec4(1.00, 0.00, 1.00, 1.0);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("outColor = vec4(0.00, 1.00, 1.00, 1.0);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("screen.y < 0.0");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("referenceUv.y < 0.5");
  });
});
