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

  it("declares the exposure helper before its first GLSL call", () => {
    const enabledUniformIndex = REFERENCE_BLACK_HOLE_FRAGMENT.indexOf(
      "uniform float u_visual_experiment_enabled;",
    );
    const exposureConstantIndex = REFERENCE_BLACK_HOLE_FRAGMENT.indexOf(
      "const float FILM_DISK_EXPOSURE = 1.55;",
    );
    const helperIndex = REFERENCE_BLACK_HOLE_FRAGMENT.indexOf(
      "float visualExperimentFilmDiskExposure() {",
    );
    const sampleDiskIndex = REFERENCE_BLACK_HOLE_FRAGMENT.indexOf("void sampleDiskSurface(");
    const callIndex = REFERENCE_BLACK_HOLE_FRAGMENT.indexOf(
      "brightness *= visualExperimentFilmDiskExposure();",
    );

    expect(enabledUniformIndex).toBeGreaterThan(-1);
    expect(exposureConstantIndex).toBeGreaterThan(enabledUniformIndex);
    expect(helperIndex).toBeGreaterThan(exposureConstantIndex);
    expect(sampleDiskIndex).toBeGreaterThan(helperIndex);
    expect(callIndex).toBeGreaterThan(helperIndex);
  });

  it("exposes only the evidence-selected disk outer geometry while keeping camera geometry frozen", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("uniform float u_experiment_disk_outer;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "return u_visual_experiment_enabled > 0.5 ? u_experiment_disk_outer : DISK_OUTER;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("diskRadius < experimentDiskOuter");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("u_experiment_disk_inner");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("u_experiment_observer_theta");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float OBSERVER_THETA = 1.515;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_OUTER = 35.00;");
  });
});
