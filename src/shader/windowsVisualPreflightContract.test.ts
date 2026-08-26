import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Windows visual experiment preflight evidence contract", () => {
  it("fails closed for missing image, missing receipt, and non-GPU receipt", () => {
    const script = resolve(process.cwd(), "scripts/windows-visual-experiment-preflight-contract.ps1");
    const result = spawnSync("pwsh", ["-NoProfile", "-File", script, "-SelfTest"], {
      encoding: "utf8",
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("PREFLIGHT_CONTRACT_SELF_TEST_OK");
  });
});
