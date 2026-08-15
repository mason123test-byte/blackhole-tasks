import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("Kerr polar-axis coordinate handling", () => {
  it("reflects Boyer-Lindquist polar coordinates instead of clamping rays at the axis", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("void normalizePolarStage(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("void normalizePolarState(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("if (theta < 0.0)");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("theta = -theta;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("phi += PI;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("ptheta = -ptheta;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("if (theta > PI)");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("theta = 2.0 * PI - theta;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("normalizePolarStage(theta2, ptheta2);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("normalizePolarStage(theta3, ptheta3);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("normalizePolarStage(theta4, ptheta4);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("normalizePolarState(theta, phi, ptheta);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("clamp(theta + 0.5 * h");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("clamp(theta + h");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("theta = clamp(theta + sixth");
  });
});
