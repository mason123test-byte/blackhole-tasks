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
      "float streak = mix(0.72 + 0.34 * rawStreak, 1.0, DISK_SOURCE_DIAGNOSTIC);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float grazing = mix(0.80 + 0.20 * smoothstep(0.0, 1.0, abs(sin(hitPhi))), 1.0, DISK_SOURCE_DIAGNOSTIC);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float experimentDiskOuter = visualExperimentDiskOuter();",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float radialProgress = clamp((hitRadius - DISK_INNER) / (experimentDiskOuter - DISK_INNER), 0.0, 1.0);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float innerHeat = 1.0 - smoothstep(0.04, 0.72, radialProgress);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float streakHeat = smoothstep(0.28, 0.92, rawStreak);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float localTemperature = mix(2900.0, 4800.0, clamp(0.74 * innerHeat + 0.26 * streakHeat, 0.0, 1.0));",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float radialEmission = innerEdge * outerEdge * pow(DISK_INNER / hitRadius, 0.38);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float radialWarp = (fineNoise - 0.5) * 5.5 + (broadNoise - 0.5) * 3.0;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "projectKerrMomenta(r, theta, L, kappa, pr, ptheta);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("GARGANTUA_ANNULUS_CENTER");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("lowerMajorAxisScale");
  });
});
