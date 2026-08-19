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

  it("adds only a local mip micro-contrast layer while preserving the current flare stack", () => {
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain("vec4 localBlur = textureLod(u_frame_texture, v_uv, 1.0);");
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain(
      "float positiveDetail = max(basePeak - localPeak, 0.0);",
    );
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain(
      "float negativeDetail = max(localPeak - basePeak, 0.0);",
    );
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain("smoothstep(0.025, 0.12, positiveDetail)");
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain("smoothstep(0.018, 0.10, negativeDetail)");
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain("gradedBase *= mix(1.0, 0.94, microShoulder);");
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain("microCore * 0.18");
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain(
      "vec4 farGlow = flareSample(min(6.5, availableLod), 0.022, 0.10, 0.045, 0.20);",
    );
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain(
      "float flareCoreReject = 1.0 - 0.82 * smoothstep(0.56, 0.82, basePeak);",
    );
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain("vec3 ivory = vec3(1.0, 0.945, 0.80);");
    expect(MIRROR_COMPOSITOR_FRAGMENT).toContain("vec3 paleGold = vec3(1.0, 0.875, 0.68);");
    expect(rendererSource).toContain("gl.LINEAR_MIPMAP_LINEAR");
    expect(rendererSource).toContain("gl.generateMipmap(gl.TEXTURE_2D);");
    expect(MIRROR_COMPOSITOR_FRAGMENT).not.toContain("flareRing(");
    expect(MIRROR_COMPOSITOR_FRAGMENT).not.toContain("mirroredUv");
    expect(MIRROR_COMPOSITOR_FRAGMENT).not.toContain("1.0 - v_uv.y");
    expect(MIRROR_COMPOSITOR_FRAGMENT).not.toContain("annulusMask");
    expect(MIRROR_COMPOSITOR_FRAGMENT).not.toContain("screen.y");
  });
});