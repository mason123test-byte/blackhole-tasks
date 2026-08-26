import { describe, expect, it } from "vitest";
import {
  DEFAULT_VISUAL_EXPERIMENT,
  parseVisualExperimentConfig,
  VISUAL_EXPERIMENT_PARAMETER_DEFAULTS,
} from "./visualExperiment";

describe("visual experiment config", () => {
  it("keeps production defaults disabled at accepted #571 settings", () => {
    expect(parseVisualExperimentConfig("")).toEqual(DEFAULT_VISUAL_EXPERIMENT);
    expect(DEFAULT_VISUAL_EXPERIMENT.enabled).toBe(false);
    expect(DEFAULT_VISUAL_EXPERIMENT.filmDiskExposure).toBe(
      VISUAL_EXPERIMENT_PARAMETER_DEFAULTS.FILM_DISK_EXPOSURE,
    );
    expect(DEFAULT_VISUAL_EXPERIMENT.diskOuter).toBe(
      VISUAL_EXPERIMENT_PARAMETER_DEFAULTS.DISK_OUTER,
    );
    expect(VISUAL_EXPERIMENT_PARAMETER_DEFAULTS.FILM_DISK_EXPOSURE).toBe(1.55);
    expect(VISUAL_EXPERIMENT_PARAMETER_DEFAULTS.DISK_OUTER).toBe(35);
  });

  it("accepts explicit real shader parameters independently", () => {
    expect(
      parseVisualExperimentConfig(
        JSON.stringify({ experimentId: "geometry-outer-20", parameters: { DISK_OUTER: 20 } }),
      ),
    ).toEqual({
      enabled: true,
      experimentId: "geometry-outer-20",
      filmDiskExposure: 1.55,
      diskOuter: 20,
    });
    expect(
      parseVisualExperimentConfig(
        JSON.stringify({ experimentId: "exposure-160", parameters: { FILM_DISK_EXPOSURE: 1.6 } }),
      ),
    ).toEqual({
      enabled: true,
      experimentId: "exposure-160",
      filmDiskExposure: 1.6,
      diskOuter: 35,
    });
  });

  it("falls back safely for malformed or physically invalid values", () => {
    expect(parseVisualExperimentConfig("{")).toEqual(DEFAULT_VISUAL_EXPERIMENT);
    expect(
      parseVisualExperimentConfig(
        JSON.stringify({ experimentId: "bad", parameters: { FILM_DISK_EXPOSURE: 0 } }),
      ),
    ).toEqual(DEFAULT_VISUAL_EXPERIMENT);
    expect(
      parseVisualExperimentConfig(
        JSON.stringify({ experimentId: "bad-outer", parameters: { DISK_OUTER: 4.2 } }),
      ),
    ).toEqual(DEFAULT_VISUAL_EXPERIMENT);
  });
});
