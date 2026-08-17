import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const smokeSource = readFileSync(resolve(process.cwd(), "scripts/windows-interaction-smoke.ps1"), "utf8");

describe("native task completion hit target", () => {
  it("clicks inside the expanded completion control instead of reusing the drag-row y coordinate", () => {
    expect(smokeSource).toContain("$q2CheckY = $taskY + 6");
    expect(smokeSource).toContain("[BlackHoleWindowProbe]::ClickAt($q2CheckX, $q2CheckY)");
    expect(smokeSource).not.toContain("[BlackHoleWindowProbe]::ClickAt($q2CheckX, $taskY)");
  });
});
