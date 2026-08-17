import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("Gargantua disk macro turbulence", () => {
  it("breaks overly regular disk ribbons in physical disk coordinates", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float macroNoise = vnoiseWrapY(vec2(hitRadius * 0.34, turns * 5.0 + swirl * 0.42), 5.0);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float macroStructure = mix(0.78, 1.16, smoothstep(0.18, 0.86, macroNoise));",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("brightness *= macroStructure;");
  });

  it("does not introduce screen-space lower-half shaping", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("screen.y < 0.0");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("referenceUv.y < 0.5");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("mirrorUv");
  });
});
