import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSceneTextureSignature, buildSceneTextureSvg, type SceneTextureSnapshot } from "./sceneTexture";

const snapshot: SceneTextureSnapshot = {
  width: 920,
  height: 700,
  expanded: true,
  editingTaskId: "editing",
  tasks: [
    { id: "keep", title: "A < B & \"C\"", quadrant: "q1", status: "todo" },
    { id: "editing", title: "不应栅格化编辑器", quadrant: "q4", status: "doing" },
  ],
};

describe("scene texture snapshot", () => {
  it("uploads straight-alpha scene pixels without premultiplying them twice", () => {
    const source = readFileSync(resolve(process.cwd(), "src/shader/sceneTexture.ts"), "utf8");
    expect(source).toContain('premultiplyAlpha: "none"');
    expect(source).toContain('colorSpaceConversion: "none"');
  });

  it("renders all quadrant guides and escaped non-editing task text", () => {
    const svg = buildSceneTextureSvg(snapshot);

    expect(svg).toContain("A &lt; B &amp; &quot;C&quot;");
    expect(svg).not.toContain("不应栅格化编辑器");
    for (const quadrant of ["q1", "q2", "q3", "q4"]) {
      expect(svg).toContain(`data-quadrant="${quadrant}"`);
    }
  });

  it("changes its stable signature with visual task state", () => {
    const signature = buildSceneTextureSignature(snapshot);
    expect(buildSceneTextureSignature({ ...snapshot, tasks: [{ ...snapshot.tasks[0], status: "done" }] })).not.toBe(signature);
    expect(buildSceneTextureSignature({ ...snapshot })).toBe(signature);
  });

  it("adds a transparent, high-contrast terminal field for visible gravitational lensing", () => {
    const svg = buildSceneTextureSvg(snapshot);

    expect(svg).toContain('data-lens-field="terminal-guides"');
    expect(svg.match(/gravity\.field\//g)).toHaveLength(18);
    expect(svg).toContain("q1:1 q2:0 q3:0 q4:0");
    expect(svg).toContain("schwarzschild.trace/00");
    expect(svg).toContain("lens.map escaped-ray:17");
    expect(svg).toContain("task.orbit pointer-events/dom");
    expect(svg).toContain('fill-opacity=".42"');
    expect(svg).not.toContain('fill="#020508"');
    expect(buildSceneTextureSvg({ ...snapshot, expanded: false })).not.toContain("gravity.field/");
  });
});
