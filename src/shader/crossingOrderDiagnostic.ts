export type VisualComparisonMode = "normal" | "baseline" | "candidate" | "split";
export type CrossingOrderDiagnosticMode = "normal" | "first" | "second" | "third-plus";

export interface VisualComparisonSettings {
  shaderMode: number;
  fixedTime: number | null;
  crossingOrder: CrossingOrderDiagnosticMode;
}

export const CROSSING_DIAGNOSTIC_RECEIPT_SOURCE = "gpu-uniform-readback" as const;

export interface EffectiveCrossingDiagnosticReceipt {
  source: typeof CROSSING_DIAGNOSTIC_RECEIPT_SOURCE;
  requestedMode: CrossingOrderDiagnosticMode;
  effectiveShaderMode: number;
  effectiveCrossingOrder: CrossingOrderDiagnosticMode;
}

export function normalizeVisualComparisonMode(value: unknown): VisualComparisonMode {
  return value === "baseline" || value === "candidate" || value === "split" ? value : "normal";
}

export function crossingDiagnosticModeFromExperimentId(experimentId: string): CrossingOrderDiagnosticMode {
  if (experimentId === "crossing-first") return "first";
  if (experimentId === "crossing-second") return "second";
  if (experimentId === "crossing-third-plus") return "third-plus";
  return "normal";
}

export function getVisualComparisonSettings(
  mode: VisualComparisonMode,
  crossingOrder: CrossingOrderDiagnosticMode = "normal",
): VisualComparisonSettings {
  if (crossingOrder === "first") return { shaderMode: 3, fixedTime: 12, crossingOrder };
  if (crossingOrder === "second") return { shaderMode: 4, fixedTime: 12, crossingOrder };
  if (crossingOrder === "third-plus") return { shaderMode: 5, fixedTime: 12, crossingOrder };
  if (mode === "baseline") return { shaderMode: 0, fixedTime: 12, crossingOrder: "normal" };
  if (mode === "split") return { shaderMode: 2, fixedTime: 12, crossingOrder: "normal" };
  if (mode === "candidate") return { shaderMode: 1, fixedTime: 12, crossingOrder: "normal" };
  return { shaderMode: 1, fixedTime: null, crossingOrder: "normal" };
}

export function includesCrossingOrder(mode: CrossingOrderDiagnosticMode, crossingIndex: number) {
  if (!Number.isInteger(crossingIndex) || crossingIndex < 0) {
    throw new Error("crossingIndex must be a non-negative integer");
  }
  if (mode === "normal") return true;
  if (mode === "first") return crossingIndex === 0;
  if (mode === "second") return crossingIndex === 1;
  return crossingIndex >= 2;
}

function crossingOrderFromShaderMode(shaderMode: number): CrossingOrderDiagnosticMode {
  if (Math.abs(shaderMode - 3) <= 0.00001) return "first";
  if (Math.abs(shaderMode - 4) <= 0.00001) return "second";
  if (Math.abs(shaderMode - 5) <= 0.00001) return "third-plus";
  return "normal";
}

export function readCrossingDiagnosticUniformReceipt(
  gl: Pick<WebGL2RenderingContext, "getUniform">,
  program: WebGLProgram,
  location: WebGLUniformLocation | null,
  requestedMode: CrossingOrderDiagnosticMode,
  requestedShaderMode: number,
): EffectiveCrossingDiagnosticReceipt {
  if (location === null) throw new Error("missing u_visual_compare uniform location");
  const effectiveShaderMode = Number(gl.getUniform(program, location));
  if (!Number.isFinite(effectiveShaderMode)) {
    throw new Error("u_visual_compare GPU uniform readback is not finite");
  }
  if (Math.abs(effectiveShaderMode - requestedShaderMode) > 0.00001) {
    throw new Error(
      `u_visual_compare GPU uniform mismatch: requested=${requestedShaderMode} effective=${effectiveShaderMode}`,
    );
  }
  const effectiveCrossingOrder = crossingOrderFromShaderMode(effectiveShaderMode);
  if (effectiveCrossingOrder !== requestedMode) {
    throw new Error(
      `crossing-order GPU uniform mismatch: requested=${requestedMode} effective=${effectiveCrossingOrder}`,
    );
  }
  return {
    source: CROSSING_DIAGNOSTIC_RECEIPT_SOURCE,
    requestedMode,
    effectiveShaderMode,
    effectiveCrossingOrder,
  };
}

export function encodeCrossingDiagnosticReceipt(receipt: EffectiveCrossingDiagnosticReceipt) {
  return [
    `crossingSource=${receipt.source}`,
    `requestedCrossingOrder=${encodeURIComponent(receipt.requestedMode)}`,
    `effectiveVisualCompare=${receipt.effectiveShaderMode.toFixed(6)}`,
    `effectiveCrossingOrder=${encodeURIComponent(receipt.effectiveCrossingOrder)}`,
  ].join(";");
}
