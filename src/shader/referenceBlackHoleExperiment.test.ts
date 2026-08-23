import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("diagnostic-only visual experiment uniforms", () => {
  it("keeps accepted production exposure as the disabled default", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "uniform float u_visual_experiment_enabled;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "uniform float u_experiment_film_disk_exposure;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "return u_visual_experiment_enabled > 0.5 ? u_experiment_film_disk_exposure : FILM_DISK_EXPOSURE;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "brightness *= visualExperimentFilmDiskExposure();",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float FILM_DISK_EXPOSURE = 1.55;");
  });

  it("does not expose frozen geometry through experiment uniforms", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("u_experiment_disk_outer");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("u_experiment_observer_theta");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float OBSERVER_THETA = 1.515;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_OUTER = 35.00;");
  });
});
