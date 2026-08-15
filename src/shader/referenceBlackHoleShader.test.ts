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
  it("uses a refined spin-corrected geodesic integration profile", () => {
    expect(REFERENCE_BLACK_HOLE_INFO).toEqual({
      model: "gargantua-inspired-spin-corrected-geodesic",
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
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float GARGANTUA_SPIN = 0.60;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float FRAME_DRAG_GAIN = 0.018;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float photonSphereRefinement = 1.0 - smoothstep(1.65, 3.20, radius);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float dt = clamp(0.16 * radius, 0.03, 1.5) * mix(1.0, 0.55, photonSphereRefinement);",
    );
  });

  it("applies moderate film spin through ray acceleration instead of screen warping", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float frameDragScale = candidateWeight * GARGANTUA_SPIN * FRAME_DRAG_GAIN / max(radius2 * radius, 0.25);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "acceleration += frameDragScale * cross(diskNormal, velocity);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("kerrScreenOffset");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("kerrMirror");
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
  });

  it("keeps one thin physical disk and aligns the normal candidate with Gargantua's film horizon", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_INNER = 1.8;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_OUTER = 8.0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_INCL = 1.50;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_ROLL = 0.00;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float GARGANTUA_DOPPLER_MIX = 0.0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float GARGANTUA_DISK_TEMP = 4500.0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float GARGANTUA_DISK_OPACITY = 0.48;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float GARGANTUA_ANNULUS_CENTER = 2.80;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float GARGANTUA_ANNULUS_WIDTH = 0.58;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float shadowRadius = mix(0.112, 0.105, u_expanded);",
    );
  });

  it("uses an unwarped ray plane for the Gargantua candidate while preserving the proven upper geometry", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "vec2 gargantuaRayPlane = rotate2(vec2(screen.x, -screen.y), DISK_ROLL) * worldScale;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "vec2 rayPlane = mix(legacyRayPlane, gargantuaRayPlane, candidateWeight);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float gargantuaStyleWeight = candidateWeight * smoothstep(0.50, 0.62, referenceUv.y);",
    );
  });

  it("separates ordered disk crossings so the secondary lensed image remains visible", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("int diskCrossingIndex = 0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("if (diskCrossingIndex > 0)");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("crossingGain = mix(1.0, 1.18, gargantuaStyleWeight);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("diskCrossingIndex += 1;");
  });

  it("pulls the higher-order image into a thinner critical-curve band", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float filmAnnulus = exp(-pow((diskRadius - GARGANTUA_ANNULUS_CENTER) / GARGANTUA_ANNULUS_WIDTH, 2.0));",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float filmOuterWing = 0.13 + 0.15 * smoothstep(3.5, DISK_OUTER, diskRadius);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float criticalBoost = 1.0 + gargantuaStyleWeight * 0.30 * exp(-pow((impact - B_CRIT) / 0.15, 2.0));",
    );
  });

  it("uses the movie's no-frequency-shift 4500 K photometry as the common A/B foundation", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float filmPhotometricWeight = 1.0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float dopplerMix = mix(0.60, GARGANTUA_DOPPLER_MIX, filmPhotometricWeight);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "vec3 diskColor = mix(physicalDiskColor, blackbody(GARGANTUA_DISK_TEMP), filmPhotometricWeight);",
    );
  });

  it("adds a common soft veiling flare without changing ray geometry", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float GARGANTUA_VEILING_HALO = 0.070;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float GARGANTUA_HORIZON_FLARE = 0.055;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float veilingHalo = exp(-dot(flarePlane, flarePlane));",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float horizonFlare = exp(-pow(screen.y / (shadowRadius * 0.22), 2.0))",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "vec3 flareLight = blackbody(GARGANTUA_DISK_TEMP) * flareIntensity;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("+ flareLight;");
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
  });

  it("uses the reference author's DPR ceiling without fixed resolution caps", () => {
    expect(getRenderProfile("low")).toEqual({ fps: 12, pixelRatioCap: 1 });
    expect(getRenderProfile("balanced")).toEqual({ fps: 15, pixelRatioCap: 1 });
    expect(getRenderProfile("high")).toEqual({ fps: 40, pixelRatioCap: 2 });
    expect(getRenderSize(920, 700, 2, 2)).toEqual({ width: 1840, height: 1400 });
  });
});