import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("Gargantua disk filament structure", () => {
  it("adds restrained fine structure in physical disk coordinates only", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float filamentNoise = vnoiseWrapY(vec2(hitRadius * 3.8 + rawStreak * 1.4, turns * 43.0 + swirl * 5.2), 43.0);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float filament = smoothstep(0.42, 0.86, filamentNoise);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "brightness *= mix(0.90, 1.14, filament);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float turns = hitPhi / (2.0 * PI);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("screen.y < 0.0");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("referenceUv.y < 0.5");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("GARGANTUA_ANNULUS_CENTER");
  });
});
