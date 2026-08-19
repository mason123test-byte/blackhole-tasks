import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BLACK_HOLE_RENDERER_INFO,
  MIRROR_COMPOSITOR_FRAGMENT,
  getRenderProfile,
  getRenderSize,
  getVisualComparisonSettings,
} from "./blackHoleRenderer";

const blackHoleCanvasSource = readFileSync(
  resolve(process.cwd(), "src/components/orb/BlackHoleCanvas.tsx"),
  "utf8",
);
const rendererSource = readFileSync(
  resolve(process.cwd(), "src/shader/blackHoleRenderer.ts"),
  "utf8",
);

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

  it("uses the published-geometry Kerr Gargantua WebGL renderer with error-controlled stepping", () => {
    expect(BLACK_HOLE_RENDERER_INFO).toMatchObject({
      model: "interstellar-gargantua-kerr-geodesic",
      integrationSteps: 176,
      tracePadding: 3,
      starGain: 0,
      sceneInput: "svg-gpu-texture",
      alphaMode: "reference-webgl-straight-alpha",
      styleReference: "https://arxiv.org/abs/1502.03808",
      physicsReference: "https://github.com/hungyipu/Odyssey",
    });
  });

  it("freezes only diagnostic visual-comparison frames", () => {
    expect(getVisualComparisonSettings("normal")).toEqual({ shaderMode: 1, fixedTime: null });
    expect(getVisualComparisonSettings("baseline")).toEqual({ shaderMode: 0, fixedTime: 12 });
    expect(getVisualComparisonSettings("candidate")).toEqual({ shaderMode: 1, fixedTime: 12 });
    expect(getVisualComparisonSettings("split")).toEqual({ shaderMode: 2, fixedTime: 12 });
  });

  it("expands visual-comparison windows before starting the expensive WebGL frame", () => {
    expect(blackHoleCanvasSource).toContain('if (mode !== "normal") {');
    expect(blackHoleCanvasSource).toContain('await invoke("set_scene_expanded", { expanded: true });');
    expect(blackHoleCanvasSource).toContain('if (visualComparisonMode !== "normal" && !expanded) return;');
    expect(blackHoleCanvasSource).toContain('[expanded, lowPowerMode, onError, quality, visualComparisonMode]');
  });

  it("keeps the validated diagnostic frame alive instead of destroying GL resources before Windows composition", () => {
    expect(rendererSource).toContain("const freezeAfterValidatedFrame = visualComparison.fixedTime !== null;");
    expect(rendererSource).toContain("let resizedFrame = false;");
    expect(rendererSource).toContain("rendererReady = false;");
    expect(rendererSource).toContain("readbackAttempts = 0;");
    expect(rendererSource).toContain("const expandedSceneReady = getExpanded() < 0.5 || sceneReady;");
    expect(rendererSource).toContain("validatedEnergy = expandedSceneReady ? energy : 0;");
    expect(rendererSource).not.toContain("const validatedEnergy = expandedSceneReady ? energy : 0;");
    const compositorDrawIndex = rendererSource.lastIndexOf("gl.drawArrays(gl.TRIANGLES, 0, 6);");
    const composedFinishIndex = rendererSource.lastIndexOf("gl.finish();");
    const readyReportIndex = rendererSource.indexOf('reportOrbFrame("webgl2", validatedEnergy');
    expect(compositorDrawIndex).toBeGreaterThan(-1);
    expect(composedFinishIndex).toBeGreaterThan(compositorDrawIndex);
    expect(readyReportIndex).toBeGreaterThan(composedFinishIndex);
    expect(rendererSource).toContain("if (!freezeAfterValidatedFrame || !rendererReady) {");
    expect(blackHoleCanvasSource).not.toContain("freezeTimer");
    expect(blackHoleCanvasSource).not.toContain("stopVisualRenderer");
    expect(blackHoleCanvasSource).toContain("return stopRenderer;");
  });

  it("adds only isotropic local ridge selection on top of the accepted #479 compositor", () => {
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain("vec2 ridgeTexel = 1.0 / max(u_resolution, vec2(1.0));");
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain(
      "vec4 ridgeLeft = textureLod(u_frame_texture, v_uv - vec2(ridgeTexel.x, 0.0), 0.0);",
    );
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain(
      "vec4 ridgeRight = textureLod(u_frame_texture, v_uv + vec2(ridgeTexel.x, 0.0), 0.0);",
    );
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain(
      "vec4 ridgeUp = textureLod(u_frame_texture, v_uv + vec2(0.0, ridgeTexel.y), 0.0);",
    );
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain(
      "vec4 ridgeDown = textureLod(u_frame_texture, v_uv - vec2(0.0, ridgeTexel.y), 0.0);",
    );
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain("float ridgeDetail = max(basePeak - ridgeNeighborPeak, 0.0);");
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain("smoothstep(0.018, 0.075, ridgeDetail)");
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain("smoothstep(0.58, 0.88, basePeak)");
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain("basePeak * 1.10");
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain("ridgeCore * 0.24");
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain(
      "vec4 farGlow = flareSample(min(6.0, availableLod), 0.022, 0.10, 0.045, 0.20);",
    );
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain(
      "float flareCoreReject = 1.0 - 0.82 * smoothstep(0.56, 0.82, basePeak);",
    );
    expect(MIRROR_COMPOSITOR_FRAGMENT).not.toContain("screen.y");
    expect(MIRROR_COMPOSITOR_FRAGMENT).not.toContain("mirroredUv");
    expect(MIRROR_COMPOSITOR_FRAGMENT).not.toContain("1.0 - v_uv.y");
    expect(MIRROR_COMPOSITOR_FRAGMENT).not.toContain("annulusMask");
  });
});