import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const workflow = read(".github/workflows/windows-build.yml");
const batchScript = read("scripts/windows-visual-batch.ps1");
const preflight = read("scripts/windows-visual-experiment-preflight.ps1");
const smokeEntry = read("scripts/windows-interaction-smoke.ps1");
const fullSmoke = read("scripts/windows-interaction-smoke-full.ps1");
const roiHelper = read("scripts/windows-fixed-roi-metrics.ps1");
const shader = read("src/shader/referenceBlackHoleShader.ts");
const experimentConfig = read("src/shader/visualExperiment.ts");

const jobBody = (name: string, nextName: string) => {
  const start = workflow.indexOf(`  ${name}:`);
  const end = workflow.indexOf(`\n  ${nextName}:`, start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return workflow.slice(start, end);
};

describe("Windows visual batch infrastructure", () => {
  it("declares one control and eight evidence-derived DISK_OUTER geometry candidates", () => {
    expect(batchScript).toContain('id="control";diskOuter=35.0;enabled=$false');
    for (const [id, diskOuter] of [
      ["01", "32.0"], ["02", "29.0"], ["03", "26.0"], ["04", "23.0"],
      ["05", "20.0"], ["06", "18.0"], ["07", "16.0"], ["08", "14.0"],
    ]) {
      expect(batchScript).toContain(`id="smoke-${id}";diskOuter=${diskOuter};enabled=$true`);
    }
    expect(batchScript).toContain("DISK_OUTER=[double]$case.diskOuter");
    expect(experimentConfig).toContain("DISK_OUTER?: number");
    expect(shader).toContain("visualExperimentDiskOuter()");
    expect(shader).toContain("diskRadius < experimentDiskOuter");
  });

  it("requires a native effective-value receipt before accepting each capture", () => {
    expect(smokeEntry).toContain("visual-candidate-effective.txt");
    expect(smokeEntry).toContain("effectiveExperimentId=");
    expect(batchScript).toContain("Read-EffectiveReceipt");
    expect(batchScript).toContain("EFFECTIVE_RECEIPT_OK");
    expect(batchScript).toContain("requested=[ordered]@{");
    expect(batchScript).toContain("effective=[ordered]@{");
    expect(batchScript).toContain("Eight candidate effective DISK_OUTER values must be unique.");
    expect(batchScript).not.toContain("parameterSensitivity");
  });

  it("runs a same-EXE control=35 versus candidate=14 runtime preflight before batch", () => {
    expect(preflight).toContain('id = "preflight-control"; enabled = $false; diskOuter = 35.0');
    expect(preflight).toContain('id = "preflight-outer-14"; enabled = $true; diskOuter = 14.0');
    expect(preflight).toContain("VISUAL_EXPERIMENT_PREFLIGHT_OK");
    const visualJob = jobBody("windows-visual", "windows-batch");
    const batchJob = jobBody("windows-batch", "windows-full");
    expect(visualJob).toContain("windows-visual-experiment-preflight.ps1");
    expect(batchJob.indexOf("windows-visual-experiment-preflight.ps1")).toBeLessThan(
      batchJob.indexOf("windows-visual-batch.ps1"),
    );
  });

  it("isolates every process capture and publishes only exact batch evidence", () => {
    expect(batchScript).toContain('blackhole-visual-batch-$($case.id)-$([Guid]::NewGuid()');
    expect(batchScript).toContain("-CandidateOnly");
    expect(smokeEntry).toContain("[switch]$CandidateOnly");
    expect(fullSmoke).toContain('Stop-Process -Id $visualProcess.Id -Force');
    for (const name of [
      "control.png", "smoke-01.png", "smoke-02.png", "smoke-03.png", "smoke-04.png",
      "smoke-05.png", "smoke-06.png", "smoke-07.png", "smoke-08.png",
      "metrics.jsonl", "batch-summary.json", "contact-sheet.png", "batch.log",
    ]) {
      expect(batchScript).toContain(`"${name}"`);
      expect(workflow).toContain(`output/windows-visual-batch/${name}`);
    }
  });

  it("keeps the old ROI helper auxiliary and shared rather than using it as parameter proof", () => {
    expect(roiHelper.match(/function Get-FrozenRoiMetrics/g) ?? []).toHaveLength(1);
    expect(fullSmoke).toContain('. (Join-Path $PSScriptRoot "windows-fixed-roi-metrics.ps1")');
    expect(batchScript).toContain('. (Join-Path $PSScriptRoot "windows-fixed-roi-metrics.ps1")');
    expect(batchScript).toContain("Get-FrozenRoiMetrics $outputImagePath");
    expect(batchScript).toContain("auxiliaryRoiMetricsOnly=$true");
  });

  it("builds once and records nine requested/effective rows without claiming visual acceptance", () => {
    const batchJob = jobBody("windows-batch", "windows-full");
    expect(batchJob.match(/run: npm ci/g) ?? []).toHaveLength(1);
    expect(batchJob.match(/run: npm run tauri build -- --no-bundle/g) ?? []).toHaveLength(1);
    expect(batchScript).toContain('captureStatus="success"');
    expect(batchScript).toContain("$metricLineCount -ne 9");
    expect(batchScript).toContain("parameterReceiptVerified=$true");
    expect(batchScript).toContain('mode="manual-exploration"');
    expect(batchScript).toContain("automatedGeometryLoss=$false");
    expect(batchScript).toContain("notAVisualAcceptance=$true");
    expect(batchScript).toContain("BATCH_OK processRuns=9");
  });
});
