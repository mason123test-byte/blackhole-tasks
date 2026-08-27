import type { NormalizedVisualExperiment } from "./visualExperiment";

export const GPU_UNIFORM_RECEIPT_SOURCE = "gpu-uniform-readback" as const;

export interface VisualExperimentUniformLocations {
  enabled: WebGLUniformLocation | null;
  filmDiskExposure: WebGLUniformLocation | null;
  diskOuter: WebGLUniformLocation | null;
}

export interface RequiredVisualExperimentUniformLocations {
  enabled: WebGLUniformLocation;
  filmDiskExposure: WebGLUniformLocation;
  diskOuter: WebGLUniformLocation;
}

export interface EffectiveVisualExperimentReceipt {
  source: typeof GPU_UNIFORM_RECEIPT_SOURCE;
  experimentId: string;
  enabled: boolean;
  filmDiskExposure: number;
  diskOuter: number;
}

export function requireVisualExperimentUniformLocations(
  locations: VisualExperimentUniformLocations,
): RequiredVisualExperimentUniformLocations {
  if (locations.enabled === null) throw new Error("missing u_visual_experiment_enabled uniform location");
  if (locations.filmDiskExposure === null) {
    throw new Error("missing u_experiment_film_disk_exposure uniform location");
  }
  if (locations.diskOuter === null) throw new Error("missing u_experiment_disk_outer uniform location");
  return locations as RequiredVisualExperimentUniformLocations;
}

function assertClose(actual: number, expected: number, name: string) {
  if (!Number.isFinite(actual)) throw new Error(`${name} GPU uniform readback is not finite`);
  if (Math.abs(actual - expected) > 0.00001) {
    throw new Error(`${name} GPU uniform mismatch: requested=${expected} effective=${actual}`);
  }
}

export function readVisualExperimentUniformReceipt(
  gl: Pick<WebGL2RenderingContext, "getUniform">,
  program: WebGLProgram,
  locations: RequiredVisualExperimentUniformLocations,
  requested: NormalizedVisualExperiment,
): EffectiveVisualExperimentReceipt {
  const enabledValue = Number(gl.getUniform(program, locations.enabled));
  const exposureValue = Number(gl.getUniform(program, locations.filmDiskExposure));
  const diskOuterValue = Number(gl.getUniform(program, locations.diskOuter));
  const requestedEnabled = requested.enabled ? 1 : 0;

  assertClose(enabledValue, requestedEnabled, "u_visual_experiment_enabled");
  assertClose(exposureValue, requested.filmDiskExposure, "u_experiment_film_disk_exposure");
  assertClose(diskOuterValue, requested.diskOuter, "u_experiment_disk_outer");

  return {
    source: GPU_UNIFORM_RECEIPT_SOURCE,
    experimentId: requested.experimentId,
    enabled: enabledValue >= 0.5,
    filmDiskExposure: exposureValue,
    diskOuter: diskOuterValue,
  };
}

export function encodeEffectiveVisualExperimentReceipt(receipt: EffectiveVisualExperimentReceipt) {
  return [
    `effectiveSource=${receipt.source}`,
    `effectiveExperimentId=${encodeURIComponent(receipt.experimentId)}`,
    `effectiveEnabled=${receipt.enabled ? 1 : 0}`,
    `effectiveFilmDiskExposure=${receipt.filmDiskExposure.toFixed(6)}`,
    `effectiveDiskOuter=${receipt.diskOuter.toFixed(6)}`,
  ].join(";");
}
