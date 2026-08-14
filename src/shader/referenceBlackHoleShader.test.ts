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
  });

  it("preserves faint disk emission instead of multiplying it by coverage twice", () => {
    expect(rendererSource).toContain("premultipliedAlpha: false");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float diskOpacity = clamp(1.0 - transmittance, 0.0, 1.0);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float diskCoverage = max(diskOpacity, max(diskLight.r, max(diskLight.g, diskLight.b)));",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "vec3 premultipliedContribution = sceneColor * transmittance * sceneAlpha",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "vec3 straightColor = coverage > 0.0001 ? premultipliedContribution / coverage : vec3(0.0);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "outColor = vec4(clamp(straightColor, 0.0, 1.0), coverage);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain(
      "vec3 straightColor = sceneColor * transmittance + starLight * transmittance + diskLight;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("sceneColor *= 1.30");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("sceneColor = sceneSample.rgb * 1.30");
  });

  it("keeps one physical Inferno disk and the compact candidate mapping", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_INNER = 1.8;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_OUTER = 8.0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_INCL = 1.50;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_ROLL = 0.35;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float referenceShadowRadius = mix(0.150, 0.140, u_expanded);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float shadowRadius = mix(referenceShadowRadius, mix(0.112, 0.105, u_expanded), candidateWeight);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("planeCrossings");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("diskCrossings");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("lowerFarWeight");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("float diskInner = mix(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("float diskOuter = mix(");
  });

  it("extends both lower wings along the disk axis without overextending the right tail", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float lowerLensWeight = candidateWeight * smoothstep(0.50, 0.70, referenceUv.y)",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "* smoothstep(shadowRadius * 1.15, shadowRadius * 1.90, screenDistance);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float lowerTargetScale = mix(0.42, 0.72, smoothstep(-0.12, 0.12, screen.x));",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float lowerMajorAxisScale = mix(1.0, lowerTargetScale, lowerLensWeight);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "vec2 baseRayPlane = rotate2(vec2(screen.x, -screen.y), DISK_ROLL) * worldScale;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "vec2 rayPlane = vec2(baseRayPlane.x * lowerMajorAxisScale, baseRayPlane.y);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("traceScreen");
  });

  it("filters final Inferno streak density without reducing its mean energy", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float textureFilterRadius = 0.16;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float streakContrast = 1.6;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "streaks = (streaksMinus + 2.0 * streaks + streaksPlus) * 0.25;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("lowerEmissionGain");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float exposure = 1.40;",
    );
  });

  it("selects the candidate inside WebGL through the comparison uniform", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("uniform float u_visual_compare;");
    expect(rendererSource).toContain(
      'if (mode === "candidate") return { shaderMode: 1, fixedTime: 12 };',
    );
    expect(rendererSource).toContain(
      "gl.uniform1f(uniforms.visualCompare, visualComparison.shaderMode);",
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