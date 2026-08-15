import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("Kerr thin-disk crossing refinement", () => {
  it("refines equatorial crossings within accepted adaptive steps instead of linearly mixing endpoints", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float hermiteScalar(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float refineEquatorialCrossing(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float acceptedH = h;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float crossing = refineEquatorialCrossing(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float diskRadius = hermiteScalar(previousR, r, dr0, dr1, acceptedH, crossing);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float diskPhi = hermiteScalar(previousPhi, phi, dphi0, dphi1, acceptedH, crossing);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("float crossing = previousSide / (previousSide - side);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("float diskRadius = mix(previousR, r, crossing);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("float diskPhi = mix(previousPhi, phi, crossing);");
  });
});
