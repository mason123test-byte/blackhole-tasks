export type VisualComparisonMode =
  | "normal"
  | "baseline"
  | "candidate"
  | "split"
  | "crossing-first"
  | "crossing-second"
  | "crossing-third-plus";

export type CrossingOrderDiagnosticMode = "normal" | "first" | "second" | "third-plus";

export interface VisualComparisonSettings {
  shaderMode: number;
  fixedTime: number | null;
  crossingOrder: CrossingOrderDiagnosticMode;
}

export const CROSSING_DIAGNOSTIC_RECEIPT_SOURCE = "gpu-uniform-readback" as const;

export interface EffectiveCrossingDiagnosticReceipt {
  source: typeof CROSSING_DIAGNOSTIC_RECEIPT_SOURCE;
  requestedMode: VisualComparisonMode;
  effectiveShaderMode: number;
  effectiveCrossingOrder: CrossingOrderDiagnosticMode;
}

export function normalizeVisualComparisonMode(value: unknown): VisualComparisonMode {
  return value === "baseline" ||
    value === "candidate" ||
    value === "split" ||
    value === "crossing-first" ||
    value === "crossing-second" ||
    value === "crossing-third-plus"
    ? value
    : "normal";
}

export function getVisualComparisonSettings(mode: VisualComparisonMode): VisualComparisonSettings {
  if (mode === "baseline") return { shaderMode: 0, fixedTime: 12, crossingOrder: "normal" };
  if (mode === "split") return { shaderMode: 2, fixedTime: 12, crossingOrder: "normal" };
  if (mode === "crossing-first") return { shaderMode: 3, fixedTime: 12, crossingOrder: "first" };
  if (mode === "crossing-second") return { shaderMode: 4, fixedTime: 12, crossingOrder: "second" };
  if (mode === "crossing-third-plus") return { shaderMode: 5, fixedTime: 12, crossingOrder: "third-plus" };
  if (mode === "candidate") return { shaderMode: 1, fixedTime: 12, crossingOrder: "normal" };
  return { shaderMode: 1, fixedTime: null, crossingOrder: "normal" };
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
  requestedMode: VisualComparisonMode,
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
  const requestedCrossingOrder = getVisualComparisonSettings(requestedMode).crossingOrder;
  if (effectiveCrossingOrder !== requestedCrossingOrder) {
    throw new Error(
      `crossing-order GPU uniform mismatch: requested=${requestedCrossingOrder} effective=${effectiveCrossingOrder}`,
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
    `requestedVisualMode=${encodeURIComponent(receipt.requestedMode)}`,
    `effectiveVisualCompare=${receipt.effectiveShaderMode.toFixed(6)}`,
    `effectiveCrossingOrder=${encodeURIComponent(receipt.effectiveCrossingOrder)}`,
  ].join(";");
}
