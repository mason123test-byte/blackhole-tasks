import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const smokeSource = readFileSync(
  resolve(process.cwd(), "scripts/windows-interaction-smoke-full.ps1"),
  "utf8",
);

describe("native pointer input settling", () => {
  it("lets WebView2 update hit testing after moving the Win32 cursor", () => {
    expect(smokeSource).toMatch(
      /if \(!SetCursorPos\(x, y\)\) return false;\s+Thread\.Sleep\(80\);\s+mouse_event\(0x0002/,
    );
    expect(smokeSource).toMatch(
      /if \(!SetCursorPos\(startX, startY\)\) return false;\s+Thread\.Sleep\(100\);\s+mouse_event\(0x0002/,
    );
  });

  it("holds a native click long enough for WebView2 to observe both edges", () => {
    expect(smokeSource).toMatch(
      /mouse_event\(0x0002, 0, 0, 0, UIntPtr\.Zero\);\s+Thread\.Sleep\((?:40|50|60|80)\);\s+mouse_event\(0x0004, 0, 0, 0, UIntPtr\.Zero\);/,
    );
  });
});
