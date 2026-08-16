import { describe, expect, it } from "vitest";
import {
  REFERENCE_BLACK_HOLE_FRAGMENT,
  REFERENCE_BLACK_HOLE_INFO,
} from "./referenceBlackHoleShader";

describe("Kerr critical-ray tracing budget", () => {
  it("gives almost-trapped rays enough accepted steps to form stable higher-order disk images", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("#define N_STEPS 240");
    expect(REFERENCE_BLACK_HOLE_INFO.integrationSteps).toBe(240);
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const int MAX_DISK_CROSSINGS = 4;");
  });
});
