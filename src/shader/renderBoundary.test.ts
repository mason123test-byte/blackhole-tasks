import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceFiles = [
  "../app/OrbApp.tsx",
  "../components/orb/BlackHoleCanvas.tsx",
  "../components/orb/GravitySceneTexture.tsx",
  "./blackHoleRenderer.ts",
];

describe("black-hole surface boundary", () => {
  it("never uses a Canvas2D task or fallback path", () => {
    for (const relativePath of sourceFiles) {
      const source = readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), "utf8");
      expect(source, relativePath).not.toMatch(/getContext\s*\(\s*["']2d["']/);
      expect(source, relativePath).not.toContain("CanvasRenderingContext2D");
      expect(source, relativePath).not.toContain("u_scene_texture");
    }
  });
});
