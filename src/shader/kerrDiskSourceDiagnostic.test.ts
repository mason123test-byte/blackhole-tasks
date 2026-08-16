import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("Kerr disk source structure", () => {
  it("restores procedural disk streaking after geometry continuity is validated", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "const float DISK_SOURCE_DIAGNOSTIC = 0.0;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float streak = mix(0.52 + 1.10 * rawStreak * rawStreak, 1.0, DISK_SOURCE_DIAGNOSTIC);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float grazing = mix(0.82 + 0.18 * smoothstep(0.0, 1.0, abs(sin(hitPhi))), 1.0, DISK_SOURCE_DIAGNOSTIC);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float localTemperature = mix(3200.0, GARGANTUA_DISK_TEMP, smoothstep(0.18, 0.82, rawStreak));",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "vec3 thermalColor = blackbody(localTemperature);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float radialEmission = innerEdge * outerEdge * pow(DISK_INNER / hitRadius, 0.72);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "projectKerrMomenta(r, theta, L, kappa, pr, ptheta);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("GARGANTUA_ANNULUS_CENTER");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("lowerMajorAxisScale");
  });
});