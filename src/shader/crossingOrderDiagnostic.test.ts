import { describe, expect, it } from "vitest";
import {
  getVisualComparisonSettings,
  includesCrossingOrder,
  normalizeVisualComparisonMode,
  readCrossingDiagnosticUniformReceipt,
} from "./crossingOrderDiagnostic";

describe("crossing-order diagnostics", () => {
  it("normalizes and maps diagnostic modes without screen-coordinate inference", () => {
    expect(normalizeVisualComparisonMode("crossing-first")).toBe("crossing-first");
    expect(normalizeVisualComparisonMode("crossing-second")).toBe("crossing-second");
    expect(normalizeVisualComparisonMode("crossing-third-plus")).toBe("crossing-third-plus");
    expect(normalizeVisualComparisonMode("unknown")).toBe("normal");
    expect(getVisualComparisonSettings("crossing-first")).toEqual({ shaderMode: 3, fixedTime: 12, crossingOrder: "first" });
    expect(getVisualComparisonSettings("crossing-second")).toEqual({ shaderMode: 4, fixedTime: 12, crossingOrder: "second" });
    expect(getVisualComparisonSettings("crossing-third-plus")).toEqual({ shaderMode: 5, fixedTime: 12, crossingOrder: "third-plus" });
  });

  it("selects contributions strictly by zero-based crossing order", () => {
    expect([0, 1, 2, 3].filter((index) => includesCrossingOrder("first", index))).toEqual([0]);
    expect([0, 1, 2, 3].filter((index) => includesCrossingOrder("second", index))).toEqual([1]);
    expect([0, 1, 2, 3].filter((index) => includesCrossingOrder("third-plus", index))).toEqual([2, 3]);
    expect([0, 1, 2, 3].filter((index) => includesCrossingOrder("normal", index))).toEqual([0, 1, 2, 3]);
    expect(() => includesCrossingOrder("first", -1)).toThrow(/non-negative integer/);
  });

  it("fails closed unless the requested diagnostic selector is read back from the GPU", () => {
    const program = {} as WebGLProgram;
    const location = {} as WebGLUniformLocation;
    const goodGl = { getUniform: () => 4 } as Pick<WebGL2RenderingContext, "getUniform">;
    expect(readCrossingDiagnosticUniformReceipt(goodGl, program, location, "crossing-second", 4)).toMatchObject({
      source: "gpu-uniform-readback",
      requestedMode: "crossing-second",
      effectiveShaderMode: 4,
      effectiveCrossingOrder: "second",
    });
    expect(() => readCrossingDiagnosticUniformReceipt(goodGl, program, null, "crossing-second", 4)).toThrow(/missing/);
    expect(() => readCrossingDiagnosticUniformReceipt({ getUniform: () => Number.NaN }, program, location, "crossing-second", 4)).toThrow(/not finite/);
    expect(() => readCrossingDiagnosticUniformReceipt({ getUniform: () => 3 }, program, location, "crossing-second", 4)).toThrow(/GPU uniform mismatch/);
  });
});
