import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("Gargantua disk streak contrast", () => {
  it("keeps texture but avoids high-contrast ribbon striping", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float streak = mix(0.74 + 0.30 * rawStreak, 1.0, DISK_SOURCE_DIAGNOSTIC);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain(
      "0.52 + 1.10 * rawStreak * rawStreak",
    );
  });

  it("does not alter geometry with screen-space shaping", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("screen.y < 0.0");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("referenceUv.y < 0.5");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("mirrorUv");
  });
});
