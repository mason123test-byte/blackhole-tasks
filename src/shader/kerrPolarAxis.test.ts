import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("Kerr polar-axis coordinate handling", () => {
  it("reflects Boyer-Lindquist polar coordinates while adaptive trials limit axis crossings", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("void normalizePolarStage(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("void normalizePolarState(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("void normalizePackedStage(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("if (theta < 0.0)");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("theta = -theta;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("phi += PI;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("ptheta = -ptheta;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("if (theta > PI)");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("theta = 2.0 * PI - theta;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("normalizePackedStage(s2, p2);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("normalizePackedStage(s3, p3);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("normalizePackedStage(s4, p4);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("normalizePackedStage(s5, p5);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("normalizePackedStage(s6, p6);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("normalizePolarState(theta, phi, ptheta);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float axisDistance = min(theta, PI - theta);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float axisStepLimit = 0.20 * axisDistance / max(abs(dtheta0), 1e-4);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("clamp(theta + 0.5 * h");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("clamp(theta + h");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("theta = clamp(theta + sixth");
  });
});