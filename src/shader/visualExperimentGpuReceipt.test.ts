import { describe, expect, it } from "vitest";
import {
  encodeEffectiveVisualExperimentReceipt,
  readVisualExperimentUniformReceipt,
  requireVisualExperimentUniformLocations,
} from "./visualExperimentGpuReceipt";
import type { NormalizedVisualExperiment } from "./visualExperiment";

const requested: NormalizedVisualExperiment = {
  enabled: true,
  experimentId: "outer-14",
  filmDiskExposure: 1.55,
  diskOuter: 14,
};

const location = {} as WebGLUniformLocation;
const program = {} as WebGLProgram;

function fakeGl(values: number[]) {
  let index = 0;
  return {
    getUniform: () => values[index++],
  } as Pick<WebGL2RenderingContext, "getUniform">;
}

describe("GPU visual experiment receipt", () => {
  it("fails closed when any required uniform location is missing", () => {
    expect(() => requireVisualExperimentUniformLocations({
      enabled: null,
      filmDiskExposure: location,
      diskOuter: location,
    })).toThrow(/u_visual_experiment_enabled/);
    expect(() => requireVisualExperimentUniformLocations({
      enabled: location,
      filmDiskExposure: null,
      diskOuter: location,
    })).toThrow(/u_experiment_film_disk_exposure/);
    expect(() => requireVisualExperimentUniformLocations({
      enabled: location,
      filmDiskExposure: location,
      diskOuter: null,
    })).toThrow(/u_experiment_disk_outer/);
  });

  it("returns a GPU-sourced receipt only when readback matches requested values", () => {
    const locations = requireVisualExperimentUniformLocations({
      enabled: location,
      filmDiskExposure: location,
      diskOuter: location,
    });
    const receipt = readVisualExperimentUniformReceipt(fakeGl([1, 1.5499999523162842, 14]), program, locations, requested);
    expect(receipt.source).toBe("gpu-uniform-readback");
    expect(receipt).toMatchObject({ experimentId: "outer-14", enabled: true, diskOuter: 14 });
    expect(receipt.filmDiskExposure).toBeCloseTo(1.55, 5);
    expect(encodeEffectiveVisualExperimentReceipt(receipt)).toContain("effectiveSource=gpu-uniform-readback");
  });

  it("fails closed for non-finite or mismatched GPU readback", () => {
    const locations = requireVisualExperimentUniformLocations({
      enabled: location,
      filmDiskExposure: location,
      diskOuter: location,
    });
    expect(() => readVisualExperimentUniformReceipt(fakeGl([1, Number.NaN, 14]), program, locations, requested)).toThrow(/not finite/);
    expect(() => readVisualExperimentUniformReceipt(fakeGl([1, 1.55, 35]), program, locations, requested)).toThrow(/mismatch/);
    expect(() => readVisualExperimentUniformReceipt(fakeGl([0, 1.55, 14]), program, locations, requested)).toThrow(/mismatch/);
  });
});
