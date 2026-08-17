import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const evidenceSource = readFileSync(
  resolve(process.cwd(), "scripts/windows-expanded-visual-evidence.ps1"),
  "utf8",
);
const workflowSource = readFileSync(
  resolve(process.cwd(), ".github/workflows/windows-build.yml"),
  "utf8",
);

describe("native expanded renderer readiness", () => {
  it("captures expanded evidence only after native and WebGL2 render sizes are ready", () => {
    expect(evidenceSource).toContain("function Wait-ExpandedRenderReady");
    expect(evidenceSource).toContain("renderer=webgl2\\|frame=ready");
    expect(evidenceSource).toContain("$renderWidth");
    expect(evidenceSource).toContain("$renderHeight");
    expect(evidenceSource).toContain("$width -ge $MinimumWidth");
    expect(evidenceSource).toContain("$height -ge $MinimumHeight");
    expect(evidenceSource).toContain("$renderWidth -ge $MinimumWidth");
    expect(evidenceSource).toContain("$renderHeight -ge $MinimumHeight");
    expect(evidenceSource).toContain("renderer=canvas2d");

    const readinessIndex = evidenceSource.indexOf("Wait-ExpandedRenderReady $process.Id 800 600");
    const captureIndex = evidenceSource.indexOf("Save-DesktopScreenshot $OutputPath");
    expect(readinessIndex).toBeGreaterThanOrEqual(0);
    expect(captureIndex).toBeGreaterThan(readinessIndex);
  });

  it("runs the evidence recapture after the full interaction smoke and before artifact upload", () => {
    const smokeIndex = workflowSource.indexOf("Interaction-test native Windows app");
    const evidenceIndex = workflowSource.indexOf("Capture expanded Windows visual evidence");
    const uploadIndex = workflowSource.indexOf("Upload Windows interaction screenshots");

    expect(smokeIndex).toBeGreaterThanOrEqual(0);
    expect(evidenceIndex).toBeGreaterThan(smokeIndex);
    expect(uploadIndex).toBeGreaterThan(evidenceIndex);
    expect(workflowSource).toContain("./scripts/windows-expanded-visual-evidence.ps1");
    expect(workflowSource).toContain('OutputPath "output/windows-smoke/02-single-scene-expanded.png"');
  });
});
