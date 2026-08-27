export const VISUAL_EXPERIMENT_PARAMETER_DEFAULTS = {
  FILM_DISK_EXPOSURE: 1.55,
  DISK_OUTER: 35.0,
} as const;

export interface VisualExperimentConfig {
  experimentId: string;
  parameters: {
    FILM_DISK_EXPOSURE?: number;
    DISK_OUTER?: number;
  };
}

export interface NormalizedVisualExperiment {
  enabled: boolean;
  experimentId: string;
  filmDiskExposure: number;
  diskOuter: number;
}

export const DEFAULT_VISUAL_EXPERIMENT: NormalizedVisualExperiment = {
  enabled: false,
  experimentId: "accepted-571",
  filmDiskExposure: VISUAL_EXPERIMENT_PARAMETER_DEFAULTS.FILM_DISK_EXPOSURE,
  diskOuter: VISUAL_EXPERIMENT_PARAMETER_DEFAULTS.DISK_OUTER,
};

const ALLOWED_VISUAL_EXPERIMENT_PARAMETERS = new Set(["FILM_DISK_EXPOSURE", "DISK_OUTER"]);

export function normalizeVisualExperimentConfig(value: unknown): NormalizedVisualExperiment {
  if (!value || typeof value !== "object") {
    throw new Error("visual experiment config must be an object");
  }
  const config = value as Partial<VisualExperimentConfig>;
  if (typeof config.experimentId !== "string" || !config.experimentId.trim()) {
    throw new Error("visual experiment experimentId is required");
  }
  if (!config.parameters || typeof config.parameters !== "object" || Array.isArray(config.parameters)) {
    throw new Error("visual experiment parameters object is required");
  }
  const parameterKeys = Object.keys(config.parameters);
  if (parameterKeys.length === 0) {
    throw new Error("visual experiment parameters must not be empty");
  }
  if (parameterKeys.some((key) => !ALLOWED_VISUAL_EXPERIMENT_PARAMETERS.has(key))) {
    throw new Error("visual experiment contains an unknown parameter");
  }
  if (parameterKeys.includes("DISK_OUTER") && (parameterKeys.length !== 1 || parameterKeys[0] !== "DISK_OUTER")) {
    throw new Error("DISK_OUTER sweep requires exactly one DISK_OUTER parameter");
  }
  const exposure = config.parameters.FILM_DISK_EXPOSURE;
  if (exposure !== undefined && (typeof exposure !== "number" || !Number.isFinite(exposure) || exposure <= 0)) {
    throw new Error("FILM_DISK_EXPOSURE must be a finite positive number");
  }
  const diskOuter = config.parameters.DISK_OUTER;
  if (
    diskOuter !== undefined &&
    (typeof diskOuter !== "number" || !Number.isFinite(diskOuter) || diskOuter <= 4.2 || diskOuter > 45.0)
  ) {
    throw new Error("DISK_OUTER must satisfy 4.2 < value <= 45");
  }
  return {
    enabled: true,
    experimentId: config.experimentId.trim(),
    filmDiskExposure: exposure ?? VISUAL_EXPERIMENT_PARAMETER_DEFAULTS.FILM_DISK_EXPOSURE,
    diskOuter: diskOuter ?? VISUAL_EXPERIMENT_PARAMETER_DEFAULTS.DISK_OUTER,
  };
}

export function parseVisualExperimentConfig(raw: string): NormalizedVisualExperiment {
  if (!raw) return DEFAULT_VISUAL_EXPERIMENT;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("visual experiment config is not valid JSON");
  }
  return normalizeVisualExperimentConfig(parsed);
}
