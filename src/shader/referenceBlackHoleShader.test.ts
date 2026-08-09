import { describe, expect, it } from "vitest";
import {
  REFERENCE_BLACK_HOLE_FRAGMENT,
  REFERENCE_BLACK_HOLE_INFO,
} from "./referenceBlackHoleShader";

describe("reference-faithful black-hole shader", () => {
  it("keeps the Ghostty Inferno integration and trace boundary", () => {
    expect(REFERENCE_BLACK_HOLE_INFO).toEqual({
      model: "schwarzschild-geodesic",
      integrationSteps: 48,
      tracePadding: 3,
      starGain: 0,
      sceneInput: "svg-gpu-texture",
      alphaMode: "premultiplied-coverage",
      reference: "https://github.com/s0xDk/ghostty-blackhole",
    });
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("#define N_STEPS 48");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float bmax = DISK_OUTER + 3.0;");
  });

  it("converts WebGL bottom-up UV into Ghostty top-down coordinates", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "vec2 referenceUv = vec2(v_uv.x, 1.0 - v_uv.y);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "vec2 screen = (referenceUv - 0.5) * vec2(aspect, 1.0);",
    );
  });

  it("keeps application animation out of the physical light calculation", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("u_hover");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("u_pulse");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("u_detail");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("pulseLight");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("stars(escapedDirection)");
  });

  it("keeps the near-field projection continuous and attenuates it once", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "vec2 sampledScreen = mix(screen, escapedScreen, lensWindow);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "sceneColor = texture(u_scene_texture, sampledUv).rgb;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain(
      "sceneColor = texture(u_scene_texture, sampledUv).rgb * towardScene;",
    );
  });

  it("outputs premultiplied coverage without straight-alpha division", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "outColor = vec4(min(premultiplied, vec3(coverage)), coverage);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toMatch(/\/\s*coverage/);
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("straightColor");
  });
});
