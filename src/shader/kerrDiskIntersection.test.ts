import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("Kerr thin-disk crossing stability", () => {
  it("keeps accepted adaptive Kerr steps intact and brackets real disk-plane crossings", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float crossing = previousSide / (previousSide - side);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float diskRadius = mix(previousR, r, crossing);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float diskPhi = mix(previousPhi, phi, crossing);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("equatorStepLimit");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("equatorDistance");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("float hermiteScalar(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("float refineEquatorialCrossing(");
  });
});
