import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("Kerr canonical momentum integration", () => {
  it("keeps the Odyssey-style accepted RK momenta instead of reprojecting every accepted step", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("void projectKerrMomenta(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float thetaPotential = max(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("kappa - KERR_A2 * sin2 - L * L / sin2");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float radialPotential =");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("- 4.0 * KERR_A * r * L");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("- delta * kappa;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain(
      "normalizePolarState(theta, phi, ptheta); projectKerrMomenta(r, theta, L, kappa, pr, ptheta);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "normalizePolarState(theta, phi, ptheta);\n    h = clamp(",
    );
  });

  it("retains the conserved-potential helper for diagnostics without using it in the production step path", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float prSign = pr < 0.0 ? -1.0 : 1.0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float pthetaSign = ptheta < 0.0 ? -1.0 : 1.0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("pr = prSign * sqrt(max(radialPotential, 0.0)) / delta;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("ptheta = pthetaSign * sqrt(thetaPotential);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("screen.y < 0.0");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("referenceUv.y < 0.5");
  });
});
