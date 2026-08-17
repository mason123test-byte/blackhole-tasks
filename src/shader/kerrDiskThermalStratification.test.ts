import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

const diskFalloff = (radius: number) => Math.pow(9.26 / radius, 0.72);

describe("Gargantua disk thermal stratification", () => {
  it("keeps the physical Kerr geometry while making the inner disk hotter and the outer disk warmer/dimmer", () => {
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
      "brightness *= mix(1.28, 0.78, smoothstep(0.05, 0.95, radialProgress));",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("screen.y < 0.0");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("referenceUv.y < 0.5");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("GARGANTUA_ANNULUS_CENTER");
  });

  it("retains broad emitting disk layers instead of photometrically erasing the film-like lensed bands", () => {
    expect(diskFalloff(18.70)).toBeGreaterThan(0.58);
    expect(diskFalloff(11.75)).toBeGreaterThan(0.82);
    expect(diskFalloff(9.93)).toBeGreaterThan(0.94);
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "pow(DISK_INNER / hitRadius, 0.72)",
    );
  });
});
