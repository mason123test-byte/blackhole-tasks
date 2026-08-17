import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflowSource = readFileSync(
  resolve(process.cwd(), ".github/workflows/windows-build.yml"),
  "utf8",
);
const smokeEntrySource = readFileSync(
  resolve(process.cwd(), "scripts/windows-interaction-smoke.ps1"),
  "utf8",
);
const fullSmokeSource = readFileSync(
  resolve(process.cwd(), "scripts/windows-interaction-smoke-full.ps1"),
  "utf8",
);

describe("Windows Gargantua visual workflow guardrail", () => {
  it("keeps baseline IoU diagnostic-only and fails an effectively blank production candidate", () => {
    expect(fullSmokeSource).toContain("VISUAL_COMPARISON_METRICS");
    expect(fullSmokeSource).toContain("candidateBrightPixels");
    expect(fullSmokeSource).toContain("Candidate Gargantua render is effectively blank");
    expect(fullSmokeSource).not.toContain('if ($lowerIoU -gt 0.93)');
    expect(fullSmokeSource).not.toContain('if ($upperIoU -lt 0.98)');
    expect(fullSmokeSource).not.toContain("Lower accretion arc did not change visibly enough");
    expect(fullSmokeSource).not.toContain("Lower-arc candidate changed the upper arc too much");
  });

  it("captures only after the renderer reports a validated WebGL frame", () => {
    const readyIndex = fullSmokeSource.indexOf(
      "$orbWindow = Wait-OrbRenderReady $visualProcess.Id",
    );
    const captureIndex = fullSmokeSource.indexOf(
      "Save-ScreenRegion $OutputPath $expandedWindow.ClientBounds",
    );
    expect(readyIndex).toBeGreaterThan(-1);
    expect(captureIndex).toBeGreaterThan(readyIndex);
  });

  it("has an explicit VisualOnly boundary before native task lifecycle interactions", () => {
    expect(smokeEntrySource).toContain("[switch]$VisualOnly");
    expect(smokeEntrySource).toContain("windows-interaction-smoke-full.ps1");
    expect(smokeEntrySource).toContain("$fullSource.Substring(0, $boundaryIndex)");
    expect(smokeEntrySource).toContain("WINDOWS_VISUAL_ONLY_OK");
    expect(smokeEntrySource).toContain("interactionLifecycleExecuted=false");
    expect(smokeEntrySource).not.toContain("DragFromTo($dragStartX");

    const metricsIndex = fullSmokeSource.indexOf(
      "Write-VisualComparisonEvidence $visualBaselinePath $visualCandidatePath",
    );
    const lifecycleIndex = fullSmokeSource.indexOf("$diagnosticMarkerPath =");
    expect(metricsIndex).toBeGreaterThan(-1);
    expect(lifecycleIndex).toBeGreaterThan(metricsIndex);
  });

  it("splits default visual validation from workflow-dispatch full validation", () => {
    expect(workflowSource).toContain("validation_mode:");
    expect(workflowSource).toContain("- visual");
    expect(workflowSource).toContain("- full");
    expect(workflowSource).toContain("name: Fast checks");
    expect(workflowSource).toContain("name: Windows visual evidence");
    expect(workflowSource).toContain("name: Full Windows validation");
    expect(workflowSource).toContain("npm run tauri build -- --no-bundle");
    expect(workflowSource).toContain("-VisualOnly");
    expect(workflowSource).toContain("inputs.validation_mode == 'full'");
    expect(workflowSource).toContain("Build Tauri EXE and installers");
    expect(workflowSource).toContain("cancel-in-progress: true");
  });

  it("settles the inline add UI before issuing the native task drag in full mode", () => {
    const createdIndex = fullSmokeSource.indexOf(
      'Wait-SmokeTaskState $smokeTaskTitle $true "q1" "todo" | Out-Null',
    );
    const escapeIndex = fullSmokeSource.indexOf(
      '[System.Windows.Forms.SendKeys]::SendWait("{ESC}")',
      createdIndex,
    );
    const settleIndex = fullSmokeSource.indexOf(
      "Start-Sleep -Milliseconds 500",
      escapeIndex,
    );
    const dragIndex = fullSmokeSource.indexOf(
      "[BlackHoleWindowProbe]::DragFromTo($dragStartX, $taskY, $dragTargetX, $dragTargetY)",
      createdIndex,
    );

    expect(createdIndex).toBeGreaterThan(-1);
    expect(escapeIndex).toBeGreaterThan(createdIndex);
    expect(settleIndex).toBeGreaterThan(escapeIndex);
    expect(dragIndex).toBeGreaterThan(settleIndex);
  });
});
