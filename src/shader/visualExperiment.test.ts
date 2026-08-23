import { describe, expect, it } from "vitest";
import {
  DEFAULT_VISUAL_EXPERIMENT,
  parseVisualExperimentConfig,
  VISUAL_EXPERIMENT_PARAMETER_DEFAULTS,
} from "./visualExperiment";

describe("visual experiment config", () => {
  it("keeps production default disabled at accepted #571 exposure", () => {
    expect(parseVisualExperimentConfig("")).toEqual(DEFAULT_VISUAL_EXPERIMENT);
    expect(DEFAULT_VISUAL_EXPERIMENT.enabled).toBe(false);
    expect(DEFAULT_VISUAL_EXPERIMENT.filmDiskExposure).toBe(
      VISUAL_EXPERIMENT_PARAMETER_DEFAULTS.FILM_DISK_EXPOSURE,
    );
    expect(VISUAL_EXPERIMENT_PARAMETER_DEFAULTS.FILM_DISK_EXPOSURE).toBe(1.55);
  });

  it("accepts only the explicit real shader parameter", () => {
    expect(
      parseVisualExperimentConfig(
        JSON.stringify({ experimentId: "batch-01-a", parameters: { FILM_DISK_EXPOSURE: 1.6 } }),
      ),
    ).toEqual({
      enabled: true,
      experimentId: "batch-01-a",
      filmDiskExposure: 1.6,
    });
  });

  it("falls back safely for malformed or non-positive values", () => {
    expect(parseVisualExperimentConfig("{")) .toEqual(DEFAULT_VISUAL_EXPERIMENT);
    expect(
      parseVisualExperimentConfig(
        JSON.stringify({ experimentId: "bad", parameters: { FILM_DISK_EXPOSURE: 0 } }),
      ),
    ).toEqual(DEFAULT_VISUAL_EXPERIMENT);
  });
});
