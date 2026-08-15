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

describe("Interstellar Gargantua WebGL black-hole port", () => {
  it("uses a refined physical geodesic integration profile", () => {
    expect(REFERENCE_BLACK_HOLE_INFO).toEqual({
      model: "gargantua-inspired-schwarzschild-geodesic",
      integrationSteps: 80,
      tracePadding: 3,
      starGain: 0,
      sceneInput: "svg-gpu-texture",
      alphaMode: "reference-webgl-straight-alpha",
      reference: "https://github.com/s0xDk/ghostty-blackhole",
      styleReference: "https://arxiv.org/abs/1502.03808",
      webglReference: "https://ebruneton.github.io/black_hole_shader/",
    });
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("#define N_STEPS 80");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float STAR_GAIN = 0.0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DILATION_MIN = 0.20;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float photonSphereRefinement = 1.0 - smoothstep(1.65, 3.20, radius);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float dt = clamp(0.16 * radius, 0.03, 1.5) * mix(1.0, 0.55, photonSphereRefinement);",
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
  });

  it("keeps one thin physical disk and aligns the normal candidate with Gargantua's film horizon", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_INNER = 1.8;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_OUTER = 8.0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_INCL = 1.50;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_ROLL = 0.00;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float GARGANTUA_DOPPLER_MIX = 0.08;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float GARGANTUA_DISK_OPACITY = 0.52;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float GARGANTUA_ANNULUS_CENTER = 2.95;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float GARGANTUA_ANNULUS_WIDTH = 0.68;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float shadowRadius = mix(0.112, 0.105, u_expanded);",
    );
    expect(rendererSource).toContain(
      'if (mode === "candidate") return { shaderMode: 1, fixedTime: 12 };',
    );
    expect(rendererSource).toContain("return { shaderMode: 1, fixedTime: null };");
  });

  it("uses an unwarped ray plane for the Gargantua candidate while preserving the proven upper film treatment", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "vec2 gargantuaRayPlane = rotate2(vec2(screen.x, -screen.y), DISK_ROLL) * worldScale;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "vec2 rayPlane = mix(legacyRayPlane, gargantuaRayPlane, candidateWeight);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float gargantuaStyleWeight = candidateWeight * smoothstep(0.50, 0.62, referenceUv.y);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("float gargantuaWeight = candidateWeight;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("lowerMinorAxisScale = mix(1.0, 1.40, lowerLensWeight)");
  });

  it("separates ordered disk crossings so the secondary lensed image remains visible", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("int diskCrossingIndex = 0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float crossingGain = 1.0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("if (diskCrossingIndex > 0)");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("crossingGain = mix(1.0, 1.24, gargantuaStyleWeight);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("diskCrossingIndex += 1;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float discOpacity = mix(0.90, GARGANTUA_DISK_OPACITY, gargantuaStyleWeight);",
    );
  });

  it("tightens the lower Gargantua secondary image around the critical curve", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float filmAnnulus = exp(-pow((diskRadius - GARGANTUA_ANNULUS_CENTER) / GARGANTUA_ANNULUS_WIDTH, 2.0));",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float filmOuterWing = 0.15 + 0.18 * smoothstep(3.5, DISK_OUTER, diskRadius);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float filmEmissivity = filmOuterWing + 1.45 * filmAnnulus;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float criticalBoost = 1.0 + gargantuaStyleWeight * 0.38 * exp(-pow((impact - B_CRIT) / 0.18, 2.0));",
    );
  });

  it("suppresses strong Doppler asymmetry only where the film-style secondary image needs it", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float dopplerMix = mix(0.60, GARGANTUA_DOPPLER_MIX, gargantuaStyleWeight);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("shift = mix(1.0, shift, dopplerMix);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float beamPower = mix(2.5, 1.15, gargantuaStyleWeight);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float exposure = mix(1.20, 1.30, gargantuaStyleWeight);");
  });

  it("filters final disk streak density without reducing its mean energy", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float textureFilterRadius = 0.16;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float streakContrast = 1.6;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "streaks = (streaksMinus + 2.0 * streaks + streaksPlus) * 0.25;",
    );
  });

  it("selects the candidate inside WebGL through the comparison uniform", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("uniform float u_visual_compare;");
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