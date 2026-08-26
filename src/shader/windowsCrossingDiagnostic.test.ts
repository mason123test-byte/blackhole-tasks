import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Windows crossing-order diagnostic evidence contract", () => {
  it("fails closed for non-GPU, wrong-default, and wrong-order receipts", () => {
    const script = resolve(process.cwd(), "scripts/windows-crossing-diagnostic.ps1");
    const result = spawnSync("pwsh", ["-NoProfile", "-File", script, "-SelfTest"], {
      encoding: "utf8",
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("CROSSING_DIAGNOSTIC_SELF_TEST_OK");
  }, 15_000);
});
