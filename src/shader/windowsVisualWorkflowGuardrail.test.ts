import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const smokeSource = readFileSync(
  resolve(process.cwd(), "scripts/windows-interaction-smoke.ps1"),
  "utf8",
);

describe("Windows Gargantua visual workflow guardrail", () => {
  it("keeps baseline IoU diagnostic-only and fails an effectively blank production candidate", () => {
    expect(smokeSource).toContain("VISUAL_COMPARISON_METRICS");
    expect(smokeSource).toContain("candidateBrightPixels");
    expect(smokeSource).toContain("Candidate Gargantua render is effectively blank");
    expect(smokeSource).not.toContain('if ($lowerIoU -gt 0.93)');
    expect(smokeSource).not.toContain('if ($upperIoU -lt 0.98)');
    expect(smokeSource).not.toContain("Lower accretion arc did not change visibly enough");
    expect(smokeSource).not.toContain("Lower-arc candidate changed the upper arc too much");
  });

  it("captures only after the renderer reports a validated WebGL frame", () => {
    const readyIndex = smokeSource.indexOf("$orbWindow = Wait-OrbRenderReady $visualProcess.Id");
    const captureIndex = smokeSource.indexOf("Save-ScreenRegion $OutputPath $expandedWindow.ClientBounds");
    expect(readyIndex).toBeGreaterThan(-1);
    expect(captureIndex).toBeGreaterThan(readyIndex);
  });
});
