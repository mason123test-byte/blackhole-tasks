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

export function normalizeVisualExperimentConfig(value: unknown): NormalizedVisualExperiment {
  if (!value || typeof value !== "object") return DEFAULT_VISUAL_EXPERIMENT;
  const config = value as Partial<VisualExperimentConfig>;
  if (typeof config.experimentId !== "string" || !config.experimentId.trim()) {
    return DEFAULT_VISUAL_EXPERIMENT;
  }
  if (!config.parameters || typeof config.parameters !== "object") {
    return DEFAULT_VISUAL_EXPERIMENT;
  }
  const exposure = config.parameters.FILM_DISK_EXPOSURE;
  if (exposure !== undefined && (typeof exposure !== "number" || !Number.isFinite(exposure) || exposure <= 0)) {
    return DEFAULT_VISUAL_EXPERIMENT;
  }
  const diskOuter = config.parameters.DISK_OUTER;
  if (
    diskOuter !== undefined &&
    (typeof diskOuter !== "number" || !Number.isFinite(diskOuter) || diskOuter <= 4.2 || diskOuter > 45.0)
  ) {
    return DEFAULT_VISUAL_EXPERIMENT;
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
  try {
    return normalizeVisualExperimentConfig(JSON.parse(raw));
  } catch {
    return DEFAULT_VISUAL_EXPERIMENT;
  }
}
