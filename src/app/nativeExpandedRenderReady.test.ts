import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const smokeSource = readFileSync(resolve(process.cwd(), "scripts/windows-interaction-smoke.ps1"), "utf8");

describe("native expanded renderer readiness", () => {
  it("waits for both native size and expanded WebGL2 render size before screenshots and interaction", () => {
    const start = smokeSource.indexOf("function Wait-ExpandedRenderReady");
    const end = smokeSource.indexOf("\nfunction Wait-SceneCompact", start);
    const helper = smokeSource.slice(start, end);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(helper).toContain("renderer=webgl2\\|frame=ready");
    expect(helper).toContain("$renderWidth");
    expect(helper).toContain("$renderHeight");
    expect(helper).toContain("$width -ge $MinimumWidth");
    expect(helper).toContain("$height -ge $MinimumHeight");
    expect(helper).toContain("$renderWidth -ge $MinimumWidth");
    expect(helper).toContain("$renderHeight -ge $MinimumHeight");
    expect(helper).toContain("renderer=canvas2d");

    const captureIndex = smokeSource.indexOf('"02-single-scene-expanded.png"');
    const readinessIndex = smokeSource.lastIndexOf("Wait-ExpandedRenderReady", captureIndex);
    expect(readinessIndex).toBeGreaterThanOrEqual(0);
    expect(readinessIndex).toBeLessThan(captureIndex);
  });
});
