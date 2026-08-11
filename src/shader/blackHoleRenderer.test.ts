import { describe, expect, it } from "vitest";
import {
  BLACK_HOLE_RENDERER_INFO,
  MIRROR_COMPOSITOR_FRAGMENT,
  getRenderProfile,
  getRenderSize,
  getVisualComparisonSettings,
} from "./blackHoleRenderer";

describe("black-hole render profiles", () => {
  it("uses the reference author's WebGL pixel-ratio ceiling", () => {
    expect(getRenderProfile("low")).toEqual({ fps: 12, pixelRatioCap: 1 });
    expect(getRenderProfile("balanced")).toEqual({ fps: 15, pixelRatioCap: 1 });
    expect(getRenderProfile("high")).toEqual({ fps: 40, pixelRatioCap: 2 });
  });

  it("forces the low-cost profile when low-power mode is enabled", () => {
    expect(getRenderProfile("high", true)).toEqual(getRenderProfile("low"));
  });

  it("renders at client resolution on 1x Windows and preserves HiDPI detail", () => {
    expect(getRenderSize(920, 700, 1, 2)).toEqual({ width: 920, height: 700 });
    expect(getRenderSize(920, 700, 2, 2)).toEqual({ width: 1840, height: 1400 });
    expect(getRenderSize(240, 180, 1, 1)).toEqual({ width: 240, height: 180 });
  });

  it("uses the reference Schwarzschild WebGL compositor with a GPU scene texture", () => {
    expect(BLACK_HOLE_RENDERER_INFO).toMatchObject({
      model: "schwarzschild-geodesic",
      integrationSteps: 48,
      tracePadding: 3,
      starGain: 0,
      sceneInput: "svg-gpu-texture",
      alphaMode: "reference-webgl-straight-alpha",
      webglReference: "https://s13k.dev/blackhole/",
    });
  });

  it("freezes only diagnostic visual-comparison frames", () => {
    expect(getVisualComparisonSettings("normal")).toEqual({ shaderMode: 1, fixedTime: null });
    expect(getVisualComparisonSettings("baseline")).toEqual({ shaderMode: 0, fixedTime: 12 });
    expect(getVisualComparisonSettings("candidate")).toEqual({ shaderMode: 1, fixedTime: 12 });
    expect(getVisualComparisonSettings("split")).toEqual({ shaderMode: 2, fixedTime: 12 });
  });

  it("keeps the diagonal disk, outer wings, and scene background out of lower-arc reconstruction", () => {
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain(
      "vec2 mirroredUv = vec2(0.5 + abs(v_uv.x - 0.5), 1.0 - v_uv.y);",
    );
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain(
      "vec4 mirroredFrame = texture(u_frame_texture, mirroredUv);",
    );
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain(
      "float lowerHalf = smoothstep(0.50, 0.54, referenceUv.y);",
    );
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain(
      "float annulusMask = smoothstep(0.14, 0.17, radius) * (1.0 - smoothstep(0.29, 0.32, radius));",
    );
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain(
      "float mirrorMask = lowerHalf * annulusMask * mirroredLightMask;",
    );
    expect(MIRROR_COMPOSITOR_FRAGMENT).not.toContain(
      "lowerHalf * (1.0 - smoothstep(0.43, 0.47, length(screen)))",
    );
  });

  it("preserves straight-alpha coverage while reconstructing the lower arc", () => {
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain(
      "float mirrorWeight = mirrorMask * candidateWeight;",
    );
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain(
      "vec3 reconstructedColor = mix(baseFrame.rgb, mirroredFrame.rgb, mirrorWeight);",
    );
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain(
      "float reconstructedAlpha = max(baseFrame.a, mirroredFrame.a * mirrorWeight);",
    );
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain(
      "outColor = vec4(reconstructedColor, reconstructedAlpha);",
    );
    expect(MIRROR_COMPOSITOR_FRAGMENT).not.toContain(
      "mix(baseFrame, mirroredFrame",
    );
  });
});
