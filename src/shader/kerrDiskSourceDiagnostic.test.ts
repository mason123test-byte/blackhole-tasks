import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("Kerr disk source structure", () => {
  it("restores procedural disk streaking after geometry continuity is validated", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "const float DISK_SOURCE_DIAGNOSTIC = 0.0;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float rawStreak = diskStreakSample(hitRadius, turns, swirl);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float streak = mix(0.74 + 0.30 * rawStreak, 1.0, DISK_SOURCE_DIAGNOSTIC);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float grazing = mix(0.82 + 0.18 * smoothstep(0.0, 1.0, abs(sin(hitPhi))), 1.0, DISK_SOURCE_DIAGNOSTIC);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float radialProgress = clamp((hitRadius - DISK_INNER) / (DISK_OUTER - DISK_INNER), 0.0, 1.0);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float innerHeat = 1.0 - smoothstep(0.05, 0.78, radialProgress);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float streakHeat = smoothstep(0.22, 0.90, rawStreak);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float localTemperature = mix(3100.0, 5200.0, clamp(0.72 * innerHeat + 0.28 * streakHeat, 0.0, 1.0));",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float radialEmission = innerEdge * outerEdge * pow(DISK_INNER / hitRadius, 2.35);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "projectKerrMomenta(r, theta, L, kappa, pr, ptheta);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("GARGANTUA_ANNULUS_CENTER");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("lowerMajorAxisScale");
  });
});
