import { describe, expect, it } from "vitest";
import {
  crossingDiagnosticModeFromExperimentId,
  getVisualComparisonSettings,
  includesCrossingOrder,
  normalizeVisualComparisonMode,
  readCrossingDiagnosticUniformReceipt,
} from "./crossingOrderDiagnostic";

describe("crossing-order diagnostics", () => {
  it("derives the diagnostic selector only from validated experiment ids", () => {
    expect(normalizeVisualComparisonMode("candidate")).toBe("candidate");
    expect(normalizeVisualComparisonMode("crossing-first")).toBe("normal");
    expect(crossingDiagnosticModeFromExperimentId("crossing-first")).toBe("first");
    expect(crossingDiagnosticModeFromExperimentId("crossing-second")).toBe("second");
    expect(crossingDiagnosticModeFromExperimentId("crossing-third-plus")).toBe("third-plus");
    expect(crossingDiagnosticModeFromExperimentId("accepted-571")).toBe("normal");
    expect(getVisualComparisonSettings("candidate", "first")).toEqual({ shaderMode: 3, fixedTime: 12, crossingOrder: "first" });
    expect(getVisualComparisonSettings("candidate", "second")).toEqual({ shaderMode: 4, fixedTime: 12, crossingOrder: "second" });
    expect(getVisualComparisonSettings("candidate", "third-plus")).toEqual({ shaderMode: 5, fixedTime: 12, crossingOrder: "third-plus" });
  });

  it("selects contributions strictly by zero-based crossing order", () => {
    expect([0, 1, 2, 3].filter((index) => includesCrossingOrder("first", index))).toEqual([0]);
    expect([0, 1, 2, 3].filter((index) => includesCrossingOrder("second", index))).toEqual([1]);
    expect([0, 1, 2, 3].filter((index) => includesCrossingOrder("third-plus", index))).toEqual([2, 3]);
    expect([0, 1, 2, 3].filter((index) => includesCrossingOrder("normal", index))).toEqual([0, 1, 2, 3]);
    expect(() => includesCrossingOrder("first", -1)).toThrow(/non-negative integer/);
  });

  it("fails closed unless the crossing selector is read back from the GPU", () => {
    const program = {} as WebGLProgram;
    const location = {} as WebGLUniformLocation;
    const goodGl = { getUniform: () => 4 } as Pick<WebGL2RenderingContext, "getUniform">;
    expect(readCrossingDiagnosticUniformReceipt(goodGl, program, location, "second", 4)).toMatchObject({
      source: "gpu-uniform-readback",
      requestedMode: "second",
      effectiveShaderMode: 4,
      effectiveCrossingOrder: "second",
    });
    expect(() => readCrossingDiagnosticUniformReceipt(goodGl, program, null, "second", 4)).toThrow(/missing/);
    expect(() => readCrossingDiagnosticUniformReceipt({ getUniform: () => Number.NaN }, program, location, "second", 4)).toThrow(/not finite/);
    expect(() => readCrossingDiagnosticUniformReceipt({ getUniform: () => 3 }, program, location, "second", 4)).toThrow(/GPU uniform mismatch/);
  });
});
