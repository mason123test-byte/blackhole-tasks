import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("Kerr thin-disk crossing refinement", () => {
  it("shrinks accepted Kerr steps near the equatorial disk before locating crossings", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float equatorDistance = abs(theta - 0.5 * PI);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float equatorStepLimit = 0.30 * max(equatorDistance, 0.010) / max(abs(dtheta0), 1e-4);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("h = min(h, max(KERR_MIN_STEP, equatorStepLimit));");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float crossing = previousSide / (previousSide - side);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float diskRadius = mix(previousR, r, crossing);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float diskPhi = mix(previousPhi, phi, crossing);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("float hermiteScalar(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("float refineEquatorialCrossing(");
  });
});
