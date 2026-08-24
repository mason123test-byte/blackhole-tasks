import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const workflow = read(".github/workflows/windows-build.yml");
const batchScript = read("scripts/windows-visual-batch.ps1");
const smokeEntry = read("scripts/windows-interaction-smoke.ps1");
const fullSmoke = read("scripts/windows-interaction-smoke-full.ps1");
const roiHelper = read("scripts/windows-fixed-roi-metrics.ps1");

const jobBody = (name: string, nextName: string) => {
  const start = workflow.indexOf(`  ${name}:`);
  const end = workflow.indexOf(`\n  ${nextName}:`, start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return workflow.slice(start, end);
};

describe("Windows visual batch infrastructure", () => {
  it("declares one control and the required eight experiment exposures", () => {
    expect(batchScript).toContain(
      '[pscustomobject]@{ id = "control"; exposure = $null }',
    );
    for (const id of ["01", "02", "03", "04"]) {
      expect(batchScript).toContain(
        `[pscustomobject]@{ id = "smoke-${id}"; exposure = 1.55 }`,
      );
    }
    for (const [id, exposure] of [
      ["05", "1.45"],
      ["06", "1.50"],
      ["07", "1.60"],
      ["08", "1.65"],
    ]) {
      expect(batchScript).toContain(
        `[pscustomobject]@{ id = "smoke-${id}"; exposure = ${exposure} }`,
      );
    }
    expect(batchScript).toContain(
      'if ($null -ne $case.exposure)',
    );
    expect(batchScript).toContain(
      'experimentId = $case.id',
    );
    expect(batchScript).toContain(
      'Remove-Item Env:BLACKHOLE_VISUAL_EXPERIMENT',
    );
  });

  it("isolates every process capture and publishes only exact batch evidence", () => {
    expect(batchScript).toContain(
      'blackhole-visual-batch-$($case.id)-$([Guid]::NewGuid()',
    );
    expect(batchScript).toContain("-CandidateOnly");
    expect(smokeEntry).toContain("[switch]$CandidateOnly");
    expect(fullSmoke).toContain(
      'Stop-Process -Id $visualProcess.Id -Force',
    );
    expect(batchScript).not.toContain("visual-baseline.png");
    expect(batchScript).not.toContain("visual-split.png");
    expect(batchScript).not.toContain("visual-difference.png");

    for (const name of [
      "control.png",
      "smoke-01.png",
      "smoke-02.png",
      "smoke-03.png",
      "smoke-04.png",
      "smoke-05.png",
      "smoke-06.png",
      "smoke-07.png",
      "smoke-08.png",
      "metrics.jsonl",
      "batch-summary.json",
      "contact-sheet.png",
      "batch.log",
    ]) {
      expect(batchScript).toContain(`"${name}"`);
      expect(workflow).toContain(
        `output/windows-visual-batch/${name}`,
      );
    }
  });

  it("has one fixed ROI implementation shared by normal and batch capture", () => {
    expect(roiHelper.match(/function Get-FrozenRoiMetrics/g) ?? []).toHaveLength(1);
    expect(fullSmoke).toContain(
      '. (Join-Path $PSScriptRoot "windows-fixed-roi-metrics.ps1")',
    );
    expect(batchScript).toContain(
      '. (Join-Path $PSScriptRoot "windows-fixed-roi-metrics.ps1")',
    );
    expect(fullSmoke).toContain(
      "Get-FrozenRoiMetrics $visualCandidatePath",
    );
    expect(batchScript).toContain(
      "Get-FrozenRoiMetrics $outputImagePath",
    );
    expect(fullSmoke).not.toContain("function Get-FrozenRoiMetrics");
    expect(batchScript).not.toContain("function Get-FrozenRoiMetrics");
  });

  it("builds the batch EXE once and reuses it for nine sequential captures", () => {
    expect(workflow).toMatch(
      /options:\s*[\s\S]*- visual\s*[\s\S]*- full\s*[\s\S]*- batch/,
    );
    const batchJob = jobBody("windows-batch", "windows-full");
    expect(batchJob.match(/run: npm ci/g) ?? []).toHaveLength(1);
    expect(
      batchJob.match(/run: npm run tauri build -- --no-bundle/g) ?? [],
    ).toHaveLength(1);
    expect(batchJob).toContain(
      "Capture control and eight experiments sequentially",
    );
    expect(batchJob).toContain("./scripts/windows-visual-batch.ps1");
    expect(batchScript).toContain("BATCH_OK processRuns=9");
  });

  it("keeps ordinary visual and full workflow behavior intact", () => {
    const visualJob = jobBody("windows-visual", "windows-batch");
    const fullStart = workflow.indexOf("  windows-full:");
    const fullJob = workflow.slice(fullStart);

    expect(visualJob).toContain(
      "github.event_name != 'workflow_dispatch' || inputs.validation_mode == 'visual'",
    );
    expect(visualJob).toContain("npm run tauri build -- --no-bundle");
    expect(visualJob).toContain("-VisualOnly");
    expect(visualJob).not.toContain("windows-visual-batch.ps1");

    expect(fullJob).toContain(
      "github.event_name == 'workflow_dispatch' && inputs.validation_mode == 'full'",
    );
    expect(fullJob).toContain("npm run tauri build");
    expect(fullJob).toContain("Interaction-test native Windows app");
    expect(fullJob).not.toContain("windows-visual-batch.ps1");
  });

  it("records nine strict metrics rows and a non-acceptance summary", () => {
    expect(batchScript).toContain('captureStatus = "success"');
    expect(batchScript).toContain("fixedRoiMetrics = $metrics");
    expect(batchScript).toContain("deltaFromControl = $delta");
    expect(batchScript).toContain("$metricLineCount -ne 9");
    expect(batchScript).toContain("successfulGroups = $rows.Count");
    expect(batchScript).toContain("stableWithinScreenshotTolerance = $stable155");
    expect(batchScript).toContain("detected = $parameterSensitivity");
    expect(batchScript).toContain("notAVisualAcceptance = $true");
    expect(batchScript).not.toContain("infrastructureVerdict");
  });
});

