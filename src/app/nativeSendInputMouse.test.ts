import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const smokeSource = readFileSync(resolve(process.cwd(), "scripts/windows-interaction-smoke.ps1"), "utf8");

describe("native Windows mouse injection", () => {
  it("uses SendInput absolute mouse events for click and drag", () => {
    expect(smokeSource).toContain("private static extern uint SendInput(");
    expect(smokeSource).toContain("MOUSEEVENTF_ABSOLUTE");
    expect(smokeSource).toContain("MOUSEEVENTF_VIRTUALDESK");
    expect(smokeSource).toContain("SendAbsoluteMouseMove");
    expect(smokeSource).toContain("SendMouseButton");
    expect(smokeSource).not.toContain("private static extern void mouse_event");
  });
});
