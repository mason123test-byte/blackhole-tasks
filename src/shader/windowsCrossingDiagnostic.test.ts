import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Windows crossing-order diagnostic evidence contract", () => {
  it("fails closed for malformed GPU receipts and classifies all staged findings", () => {
    const script = resolve(process.cwd(), "scripts/windows-crossing-diagnostic.ps1");
    const result = spawnSync("pwsh", ["-NoProfile", "-File", script, "-SelfTest"], {
      encoding: "utf8",
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("CROSSING_DIAGNOSTIC_SELF_TEST_OK");
    expect(result.stdout).toContain("stagedFindings=4");
    const lengthMatch = result.stdout.match(/longReceiptLength=(\d+)/);
    expect(lengthMatch).not.toBeNull();
    expect(Number(lengthMatch?.[1])).toBeGreaterThan(400);
  }, 15_000);

  it("uses actual Win32 title length while preserving all-black diagnostic evidence without accepting it visually", () => {
    const smoke = readFileSync(resolve(process.cwd(), "scripts/windows-interaction-smoke.ps1"), "utf8");
    const diagnostic = readFileSync(resolve(process.cwd(), "scripts/windows-crossing-diagnostic.ps1"), "utf8");
    expect(smoke).toContain('EntryPoint = "GetWindowTextLengthW"');
    expect(smoke).toContain("new StringBuilder(titleLength + 1)");
    expect(smoke).not.toContain("new StringBuilder(512)");
    expect(smoke).not.toContain("new StringBuilder(1024)");
    expect(smoke).toContain("AllowEmptyDiagnosticCapture");
    expect(smoke).toContain("$script:AllowEmptyDiagnosticCapture");
    expect(diagnostic).toContain('visualAcceptance=$false');
    expect(diagnostic).toContain('third-valid-crossing-not-reached');
    expect(diagnostic).toContain('third-reached-but-emission-zero');
    expect(diagnostic).toContain('third-emission-present-but-post-transmittance-zero');
    expect(diagnostic).toContain('terminationReasons');
    expect(diagnostic).toContain('diagnostic-metrics.json');
  });
});
