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

  it("settles the inline add UI before issuing the native task drag", () => {
    const createdIndex = smokeSource.indexOf(
      'Wait-SmokeTaskState $smokeTaskTitle $true "q1" "todo" | Out-Null',
    );
    const escapeIndex = smokeSource.indexOf(
      '[System.Windows.Forms.SendKeys]::SendWait("{ESC}")',
      createdIndex,
    );
    const settleIndex = smokeSource.indexOf("Start-Sleep -Milliseconds 500", escapeIndex);
    const dragIndex = smokeSource.indexOf(
      "[BlackHoleWindowProbe]::DragFromTo($dragStartX, $taskY, $dragTargetX, $dragTargetY)",
      createdIndex,
    );

    expect(createdIndex).toBeGreaterThan(-1);
    expect(escapeIndex).toBeGreaterThan(createdIndex);
    expect(settleIndex).toBeGreaterThan(escapeIndex);
    expect(dragIndex).toBeGreaterThan(settleIndex);
  });

  it("settles the compact scene before the persistence reopen click", () => {
    const persistenceCloseIndex = smokeSource.indexOf(
      'Invoke-SceneCloseClick $expanded "persistence"',
    );
    const compactIndex = smokeSource.indexOf(
      "$orb = Wait-SceneCompact $process.Id 300 230 10000",
      persistenceCloseIndex,
    );
    const settleIndex = smokeSource.indexOf(
      "Start-Sleep -Milliseconds 500",
      compactIndex,
    );
    const centerIndex = smokeSource.indexOf(
      "$orbCenterX = [int](($orb.ClientBounds.Left + $orb.ClientBounds.Right) / 2)",
      compactIndex,
    );

    expect(persistenceCloseIndex).toBeGreaterThan(-1);
    expect(compactIndex).toBeGreaterThan(persistenceCloseIndex);
    expect(settleIndex).toBeGreaterThan(compactIndex);
    expect(centerIndex).toBeGreaterThan(settleIndex);
  });
});
