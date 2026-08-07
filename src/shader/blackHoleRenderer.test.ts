import { describe, expect, it } from "vitest";
import { BLACK_HOLE_RENDERER_INFO, getRenderProfile } from "./blackHoleRenderer";

describe("black-hole render profiles", () => {
  it("uses full reference detail for balanced and high quality", () => {
    expect(getRenderProfile("low")).toMatchObject({ idleFps: 12, activeFps: 24, pixelRatioCap: 1 });
    expect(getRenderProfile("balanced")).toMatchObject({ idleFps: 18, activeFps: 30, pixelRatioCap: 1.25, detail: 1 });
    expect(getRenderProfile("high")).toMatchObject({ idleFps: 24, activeFps: 40, pixelRatioCap: 1.5, detail: 1 });
  });

  it("forces the low-cost profile when low-power mode is enabled", () => {
    expect(getRenderProfile("high", true)).toEqual(getRenderProfile("low"));
  });

  it("uses the reference Schwarzschild geodesic model with a GPU scene texture", () => {
    expect(BLACK_HOLE_RENDERER_INFO).toMatchObject({
      model: "schwarzschild-geodesic",
      integrationSteps: 48,
      sceneInput: "svg-gpu-texture",
    });
  });
});
