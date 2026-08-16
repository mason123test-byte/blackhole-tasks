import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("Kerr thin-disk crossing refinement", () => {
  it("limits equatorial overshoot without preventing a real disk-plane crossing", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float equatorSide = theta - 0.5 * PI;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float equatorDistance = abs(equatorSide);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("if (equatorSide * dtheta0 < 0.0) {");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float equatorStepLimit = 1.20 * max(equatorDistance, 0.010) / max(abs(dtheta0), 1e-4);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("h = min(h, max(KERR_MIN_STEP, equatorStepLimit));");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("0.30 * max(equatorDistance");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float crossing = previousSide / (previousSide - side);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float diskRadius = mix(previousR, r, crossing);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float diskPhi = mix(previousPhi, phi, crossing);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("float hermiteScalar(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("float refineEquatorialCrossing(");
  });
});
