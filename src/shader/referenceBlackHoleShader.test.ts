import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getRenderProfile, getRenderSize } from "./blackHoleRenderer";
import {
  REFERENCE_BLACK_HOLE_FRAGMENT,
  REFERENCE_BLACK_HOLE_INFO,
} from "./referenceBlackHoleShader";

const rendererSource = readFileSync(
  resolve(process.cwd(), "src/shader/blackHoleRenderer.ts"),
  "utf8",
);

describe("Ghostty Inferno WebGL black-hole port", () => {
  it("uses the Ghostty shader's physical integration profile", () => {
    expect(REFERENCE_BLACK_HOLE_INFO).toEqual({
      model: "schwarzschild-geodesic",
      integrationSteps: 48,
      tracePadding: 3,
      starGain: 0,
      sceneInput: "svg-gpu-texture",
      alphaMode: "reference-webgl-straight-alpha",
      reference: "https://github.com/s0xDk/ghostty-blackhole",
      webglReference: "https://s13k.dev/blackhole/",
    });
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("#define N_STEPS 48");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float STAR_GAIN = 0.0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DILATION_MIN = 0.20;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float dt = clamp(0.16 * radius, 0.03, 1.5);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float aberration = 0.035 * smoothstep(1.0, 2.0, impact / bmax);",
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
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "const float NEAR_DISK_INNER = 2.4;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_ROLL = 0.35;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float shadowRadius = mix(0.150, 0.140, u_expanded);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float bmax = DISK_OUTER + 3.0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float nearSide = smoothstep(-0.4, 1.6, diskPoint.z);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float innerRadius = mix(DISK_INNER, NEAR_DISK_INNER, nearSide);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("vec4 sceneSample = texture(u_scene_texture, sampledUv);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("sceneAlpha = sceneSample.a * lensWindow");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("sceneColor = sceneSample.rgb * 1.30;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain(
      "sceneAlpha = smoothstep(0.02, 0.22, lensWindow) * u_scene_ready;",
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
    expect(getRenderProfile("balanced")).toEqual({ fps: 15, pixelRatioCap: 1 });
    expect(getRenderProfile("high")).toEqual({ fps: 40, pixelRatioCap: 2 });
    expect(getRenderSize(920, 700, 2, 2)).toEqual({ width: 1840, height: 1400 });
  });
});
