import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Windows crossing-order diagnostic evidence contract", () => {
  it("fails closed for non-GPU, wrong-default, wrong-order, and parses receipts longer than 400 characters", () => {
    const script = resolve(process.cwd(), "scripts/windows-crossing-diagnostic.ps1");
    const result = spawnSync("pwsh", ["-NoProfile", "-File", script, "-SelfTest"], {
      encoding: "utf8",
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("CROSSING_DIAGNOSTIC_SELF_TEST_OK");
    const lengthMatch = result.stdout.match(/longReceiptLength=(\d+)/);
    expect(lengthMatch).not.toBeNull();
    expect(Number(lengthMatch?.[1])).toBeGreaterThan(400);
  }, 15_000);

  it("uses actual Win32 title length and does not accept receipt-only diagnostic readiness", () => {
    const smoke = readFileSync(
      resolve(process.cwd(), "scripts/windows-interaction-smoke.ps1"),
      "utf8",
    );
    expect(smoke).toContain('EntryPoint = "GetWindowTextLengthW"');
    expect(smoke).toContain("new StringBuilder(titleLength + 1)");
    expect(smoke).not.toContain("new StringBuilder(512)");
    expect(smoke).not.toContain("new StringBuilder(1024)");
    expect(smoke).toContain("[int]$Matches[1] -ge 8");
    expect(smoke).not.toContain("GPU receipt plus a valid WebGL framebuffer");
  });
});
