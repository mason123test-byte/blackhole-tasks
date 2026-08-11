import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceFiles = [
  "../app/OrbApp.tsx",
  "../components/orb/BlackHoleCanvas.tsx",
  "./blackHoleRenderer.ts",
  "./referenceBlackHoleShader.ts",
  "./sceneTexture.ts",
];

const readSource = (relativePath: string) =>
  readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");

const smokeSource = readFileSync(
  fileURLToPath(new URL("../../scripts/windows-interaction-smoke.ps1", import.meta.url)),
  "utf8",
);

describe("black-hole surface boundary", () => {
  it("feeds a scene texture into WebGL without any Canvas2D path", () => {
    for (const relativePath of sourceFiles) {
      const source = readSource(relativePath);
      expect(source, relativePath).not.toMatch(/getContext\s*\(\s*["']2d["']/);
      expect(source, relativePath).not.toContain("CanvasRenderingContext2D");
    }

    expect(readSource("./blackHoleRenderer.ts")).toContain("u_scene_texture");
  });

  it("keeps visual comparison diagnostic-only and emits deterministic Windows evidence", () => {
    const appSource = readSource("../app/OrbApp.tsx");
    expect(appSource).not.toContain("visual-baseline");
    expect(appSource).not.toContain("visual-candidate");
    expect(appSource).not.toContain("visual-split");

    for (const filename of [
      "visual-baseline.png",
      "visual-candidate.png",
      "visual-split.png",
      "visual-difference.png",
      "visual-comparison-metrics.txt",
    ]) {
      expect(smokeSource).toContain(filename);
    }
    expect(smokeSource).toContain("lowerIoU");
    expect(smokeSource).toContain("upperIoU");
  });
});
