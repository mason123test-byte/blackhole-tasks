import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("Gargantua physical disk inner-edge visibility", () => {
  it("keeps the published 9.26M edge sharp enough for real Kerr higher-order images", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float innerEdge = smoothstep(DISK_INNER, DISK_INNER * 1.025, hitRadius);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain(
      "smoothstep(DISK_INNER, DISK_INNER * 1.12, hitRadius)",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("GARGANTUA_ANNULUS_CENTER");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("lowerMajorAxisScale");
  });
});
