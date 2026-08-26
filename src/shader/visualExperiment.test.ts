import { describe, expect, it } from "vitest";
import {
  DEFAULT_VISUAL_EXPERIMENT,
  parseVisualExperimentConfig,
  VISUAL_EXPERIMENT_PARAMETER_DEFAULTS,
} from "./visualExperiment";

describe("visual experiment config", () => {
  it("keeps production defaults disabled only when the environment is unset", () => {
    expect(parseVisualExperimentConfig("")).toEqual(DEFAULT_VISUAL_EXPERIMENT);
    expect(DEFAULT_VISUAL_EXPERIMENT.enabled).toBe(false);
    expect(DEFAULT_VISUAL_EXPERIMENT.filmDiskExposure).toBe(
      VISUAL_EXPERIMENT_PARAMETER_DEFAULTS.FILM_DISK_EXPOSURE,
    );
    expect(DEFAULT_VISUAL_EXPERIMENT.diskOuter).toBe(
      VISUAL_EXPERIMENT_PARAMETER_DEFAULTS.DISK_OUTER,
    );
  });

  it("accepts exposure, disk outer, and both together", () => {
    expect(
      parseVisualExperimentConfig(
        JSON.stringify({ experimentId: "geometry-outer-20", parameters: { DISK_OUTER: 20 } }),
      ),
    ).toEqual({ enabled: true, experimentId: "geometry-outer-20", filmDiskExposure: 1.55, diskOuter: 20 });
    expect(
      parseVisualExperimentConfig(
        JSON.stringify({ experimentId: "exposure-160", parameters: { FILM_DISK_EXPOSURE: 1.6 } }),
      ),
    ).toEqual({ enabled: true, experimentId: "exposure-160", filmDiskExposure: 1.6, diskOuter: 35 });
    expect(
      parseVisualExperimentConfig(
        JSON.stringify({
          experimentId: "combined",
          parameters: { FILM_DISK_EXPOSURE: 1.4, DISK_OUTER: 14 },
        }),
      ),
    ).toEqual({ enabled: true, experimentId: "combined", filmDiskExposure: 1.4, diskOuter: 14 });
  });

  it("throws for set-but-invalid payloads instead of silently using production defaults", () => {
    expect(() => parseVisualExperimentConfig("{")).toThrow(/valid JSON/);
    expect(() =>
      parseVisualExperimentConfig(JSON.stringify({ experimentId: "bad", parameters: { FILM_DISK_EXPOSURE: 0 } })),
    ).toThrow(/FILM_DISK_EXPOSURE/);
    expect(() =>
      parseVisualExperimentConfig(JSON.stringify({ experimentId: "bad-outer", parameters: { DISK_OUTER: 4.2 } })),
    ).toThrow(/DISK_OUTER/);
    expect(() =>
      parseVisualExperimentConfig(JSON.stringify({ experimentId: "bad-outer-high", parameters: { DISK_OUTER: 45.1 } })),
    ).toThrow(/DISK_OUTER/);
    expect(() =>
      parseVisualExperimentConfig(JSON.stringify({ experimentId: "bad-key", parameters: { OBSERVER_THETA: 1.5 } })),
    ).toThrow(/unknown parameter/);
    expect(() => parseVisualExperimentConfig(JSON.stringify({ parameters: { DISK_OUTER: 14 } }))).toThrow(/experimentId/);
  });
});
