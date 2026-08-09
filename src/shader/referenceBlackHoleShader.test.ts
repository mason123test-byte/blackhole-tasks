import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { getRenderProfile, getRenderSize } from "./blackHoleRenderer";
import {
  REFERENCE_BLACK_HOLE_FRAGMENT,
  REFERENCE_BLACK_HOLE_INFO,
} from "./referenceBlackHoleShader";

const rendererSource = readFileSync(
  fileURLToPath(new URL("./blackHoleRenderer.ts", import.meta.url)),
  "utf8",
);

describe("reference-author WebGL black-hole port", () => {
  it("uses the reference author's high-detail transparent WebGL profile", () => {
    expect(REFERENCE_BLACK_HOLE_INFO).toEqual({
      model: "schwarzschild-geodesic",
      integrationSteps: 64,
      tracePadding: 3,
      starGain: 0.35,
      sceneInput: "svg-gpu-texture",
      alphaMode: "reference-webgl-straight-alpha",
      reference: "https://github.com/s0xDk/ghostty-blackhole",
      webglReference: "https://s13k.dev/blackhole/",
    });
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("#define N_STEPS 64");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float STAR_GAIN = 0.35;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DILATION = 0.56;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float dt = clamp(0.20 * radius, 0.03, 1.0);",
    );
  });

  it("uses the reference author's straight-alpha compositor instead of premultiplied coverage", () => {
    expect(rendererSource).toContain("premultipliedAlpha: false");
    expect(rendererSource).not.toContain("premultipliedAlpha: true");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float lightAlpha = clamp((captured ? 1.0 : 0.0) + (1.0 - transmittance)",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "outColor = vec4(straightColor, coverage);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("premultiplied");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("min(premultiplied");
  });

  it("keeps the reference Inferno constants and GPU scene-lensing boundary", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_INNER = 1.8;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_OUTER = 8.0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_INCL = 1.50;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_ROLL = 0.35;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float bmax = DISK_OUTER + 3.0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "sceneColor = texture(u_scene_texture, sampledUv).rgb;",
    );
  });

  it("converts WebGL bottom-up UV into Ghostty top-down coordinates", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "vec2 referenceUv = vec2(v_uv.x, 1.0 - v_uv.y);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "vec2 screen = (referenceUv - 0.5) * vec2(aspect, 1.0);",
    );
  });

  it("keeps application animation controls out of the physical light calculation", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("u_hover");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("u_pulse");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("u_detail");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("pulseLight");
  });

  it("uses the reference author's DPR ceiling without fixed resolution caps", () => {
    expect(getRenderProfile("low")).toEqual({ fps: 12, pixelRatioCap: 1 });
    expect(getRenderProfile("balanced")).toEqual({ fps: 30, pixelRatioCap: 2 });
    expect(getRenderProfile("high")).toEqual({ fps: 40, pixelRatioCap: 2 });
    expect(getRenderSize(920, 700, 2, 2)).toEqual({ width: 1840, height: 1400 });
  });
});
