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

  it("waits for a validated expanded WebGL frame instead of sleeping or toggling an already-expanded visual window", () => {
    expect(smokeSource).toContain("function Wait-ExpandedRenderReady");
    expect(smokeSource).toContain("$expandedWindow = Wait-ExpandedRenderReady $visualProcess.Id 800 600 30000");
    expect(smokeSource).toContain('"VISUAL_COMPARISON_READY mode=$Mode title=$($expandedWindow.Title)"');
    expect(smokeSource).not.toContain("Failed to expand $Mode visual comparison");
    expect(smokeSource).not.toContain("Start-Sleep -Milliseconds 1600");
  });
});
