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
});
