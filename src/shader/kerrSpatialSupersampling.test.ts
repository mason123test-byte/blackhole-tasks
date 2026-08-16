import { describe, expect, it } from "vitest";
import { getRaySupersampleScale } from "./blackHoleRenderer";

describe("Kerr spatial supersampling", () => {
  it("oversamples 1x Windows rays without multiplying HiDPI or low-power cost", () => {
    expect(getRaySupersampleScale(1, false)).toBe(1.5);
    expect(getRaySupersampleScale(1.25, false)).toBe(1.5);
    expect(getRaySupersampleScale(1.5, false)).toBe(1);
    expect(getRaySupersampleScale(2, false)).toBe(1);
    expect(getRaySupersampleScale(1, true)).toBe(1);
  });
});
