import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const batchScript = readFileSync("scripts/windows-visual-batch.ps1", "utf8");
const workflow = readFileSync(".github/workflows/windows-build.yml", "utf8");

describe("Windows visual batch infrastructure", () => {
  it("declares exactly one control and eight isolated experiment captures", () => {
    expect(batchScript).toContain('[pscustomobject]@{ id = "control"; exposure = $null }');
    for (const id of ["01", "02", "03", "04"]) {
      expect(batchScript).toContain(`[pscustomobject]@{ id = "smoke-${id}"; exposure = 1.55 }`);
    }
    expect(batchScript).toContain('[pscustomobject]@{ id = "smoke-05"; exposure = 1.45 }');
    expect(batchScript).toContain('[pscustomobject]@{ id = "smoke-06"; exposure = 1.50 }');
    expect(batchScript).toContain('[pscustomobject]@{ id = "smoke-07"; exposure = 1.60 }');
    expect(batchScript).toContain('[pscustomobject]@{ id = "smoke-08"; exposure = 1.65 }');
    expect(batchScript).toContain('Remove-Item Env:BLACKHOLE_VISUAL_EXPERIMENT -ErrorAction SilentlyContinue');
    expect(batchScript).toContain('ConvertTo-Json -Compress');
  });

  it("keeps batch outputs isolated to the nine candidate images and batch evidence", () => {
    expect(batchScript).toContain('visual-candidate.png');
    expect(batchScript).not.toContain('Copy-Item -LiteralPath (Join-Path $caseDirectory "visual-baseline.png")');
    expect(batchScript).not.toContain('Copy-Item -LiteralPath (Join-Path $caseDirectory "visual-split.png")');
    expect(batchScript).not.toContain('Copy-Item -LiteralPath (Join-Path $caseDirectory "visual-difference.png")');
    for (const name of ["metrics.jsonl", "batch-summary.json", "contact-sheet.png", "batch.log"]) {
      expect(batchScript).toContain(name);
    }
  });

  it("adds an explicit workflow_dispatch batch mode with one dependency install and one EXE build", () => {
    expect(workflow).toMatch(/options:\s*[\s\S]*- visual\s*[\s\S]*- full\s*[\s\S]*- batch/);
    const afterBatch = workflow.split("  windows-batch:")[1];
    expect(afterBatch).toBeTruthy();
    const batchJob = afterBatch.split("\n  windows-full:")[0];
    expect(batchJob.match(/npm ci/g)).toHaveLength(1);
    expect(batchJob.match(/npm run tauri build -- --no-bundle/g)).toHaveLength(1);
    expect(batchJob).toContain("./scripts/windows-visual-batch.ps1");
    expect(batchJob).toContain("github.event_name == 'workflow_dispatch' && inputs.validation_mode == 'batch'");
  });

  it("does not expose frozen geometry or introduce alternate rendering paths", () => {
    expect(batchScript).not.toMatch(/DISK_OUTER|OBSERVER_THETA|KERR_A|screen\.y|canvas2d|fallback renderer/i);
  });
});
