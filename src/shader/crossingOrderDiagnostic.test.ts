import { describe, expect, it } from "vitest";
import {
  CROSSING_DIAGNOSTIC_MIN_RGB_PIXELS,
  crossingDiagnosticModeFromExperimentId,
  getVisualComparisonSettings,
  includesCrossingOrder,
  isCrossingDiagnosticFrameReady,
  normalizeVisualComparisonMode,
  readCrossingDiagnosticUniformReceipt,
} from "./crossingOrderDiagnostic";

describe("crossing-order diagnostics", () => {
  it("derives staged diagnostic selectors only from validated experiment ids", () => {
    expect(normalizeVisualComparisonMode("candidate")).toBe("candidate");
    expect(normalizeVisualComparisonMode("crossing-first")).toBe("normal");
    expect(crossingDiagnosticModeFromExperimentId("crossing-first")).toBe("first");
    expect(crossingDiagnosticModeFromExperimentId("crossing-second")).toBe("second");
    expect(crossingDiagnosticModeFromExperimentId("crossing-third-plus")).toBe("third-plus");
    expect(crossingDiagnosticModeFromExperimentId("crossing-third-reach")).toBe("third-reach");
    expect(crossingDiagnosticModeFromExperimentId("crossing-third-pre-trans")).toBe("third-pre-trans");
    expect(crossingDiagnosticModeFromExperimentId("crossing-termination")).toBe("termination");
    expect(crossingDiagnosticModeFromExperimentId("accepted-571")).toBe("normal");
    expect(getVisualComparisonSettings("candidate", "first")).toEqual({ shaderMode: 3, fixedTime: 12, crossingOrder: "first" });
    expect(getVisualComparisonSettings("candidate", "second")).toEqual({ shaderMode: 4, fixedTime: 12, crossingOrder: "second" });
    expect(getVisualComparisonSettings("candidate", "third-plus")).toEqual({ shaderMode: 5, fixedTime: 12, crossingOrder: "third-plus" });
    expect(getVisualComparisonSettings("candidate", "third-reach")).toEqual({ shaderMode: 6, fixedTime: 12, crossingOrder: "third-reach" });
    expect(getVisualComparisonSettings("candidate", "third-pre-trans")).toEqual({ shaderMode: 7, fixedTime: 12, crossingOrder: "third-pre-trans" });
    expect(getVisualComparisonSettings("candidate", "termination")).toEqual({ shaderMode: 8, fixedTime: 12, crossingOrder: "termination" });
  });

  it("selects crossing stages strictly from real zero-based diskCrossingCount", () => {
    expect([0, 1, 2, 3].filter((index) => includesCrossingOrder("first", index))).toEqual([0]);
    expect([0, 1, 2, 3].filter((index) => includesCrossingOrder("second", index))).toEqual([1]);
    expect([0, 1, 2, 3].filter((index) => includesCrossingOrder("third-plus", index))).toEqual([2, 3]);
    expect([0, 1, 2, 3].filter((index) => includesCrossingOrder("third-reach", index))).toEqual([2, 3]);
    expect([0, 1, 2, 3].filter((index) => includesCrossingOrder("third-pre-trans", index))).toEqual([2, 3]);
    expect([0, 1, 2, 3].filter((index) => includesCrossingOrder("termination", index))).toEqual([]);
    expect(() => includesCrossingOrder("first", -1)).toThrow(/non-negative integer/);
  });

  it("keeps renderer readiness fail-closed for all-black diagnostic frames", () => {
    const base = {
      crossingOrder: "third-plus" as const,
      expandedSceneReady: true,
      glError: 0,
      noErrorValue: 0,
      framebufferComplete: true,
      rgbContributionPixels: 0,
      alphaPixels: 920 * 700,
    };
    expect(isCrossingDiagnosticFrameReady(base)).toBe(false);
    expect(isCrossingDiagnosticFrameReady({ ...base, rgbContributionPixels: CROSSING_DIAGNOSTIC_MIN_RGB_PIXELS - 1 })).toBe(false);
    expect(isCrossingDiagnosticFrameReady({ ...base, rgbContributionPixels: CROSSING_DIAGNOSTIC_MIN_RGB_PIXELS })).toBe(true);
    expect(isCrossingDiagnosticFrameReady({ ...base, crossingOrder: "normal", rgbContributionPixels: 1000 })).toBe(false);
  });

  it("fails closed unless every staged selector is read back from the GPU", () => {
    const program = {} as WebGLProgram;
    const location = {} as WebGLUniformLocation;
    for (const [mode, shaderMode] of [
      ["second", 4],
      ["third-plus", 5],
      ["third-reach", 6],
      ["third-pre-trans", 7],
      ["termination", 8],
    ] as const) {
      const gl = { getUniform: () => shaderMode } as Pick<WebGL2RenderingContext, "getUniform">;
      expect(readCrossingDiagnosticUniformReceipt(gl, program, location, mode, shaderMode)).toMatchObject({
        source: "gpu-uniform-readback",
        requestedMode: mode,
        effectiveShaderMode: shaderMode,
        effectiveCrossingOrder: mode,
      });
    }
    const goodGl = { getUniform: () => 4 } as Pick<WebGL2RenderingContext, "getUniform">;
    expect(() => readCrossingDiagnosticUniformReceipt(goodGl, program, null, "second", 4)).toThrow(/missing/);
    expect(() => readCrossingDiagnosticUniformReceipt({ getUniform: () => Number.NaN }, program, location, "second", 4)).toThrow(/not finite/);
    expect(() => readCrossingDiagnosticUniformReceipt({ getUniform: () => 3 }, program, location, "second", 4)).toThrow(/GPU uniform mismatch/);
  });
});
