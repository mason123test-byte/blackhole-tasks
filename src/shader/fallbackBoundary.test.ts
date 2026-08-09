import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

describe("strict Inferno fallback boundary", () => {
  it("contains no fixed low-resolution, pulse, reload, or bootstrap fallback", () => {
    const renderer = read("./blackHoleRenderer.ts");
    const canvas = read("../components/orb/BlackHoleCanvas.tsx");
    const app = read("../app/OrbApp.tsx");
    expect(renderer).not.toMatch(/MAX_RENDER_|renderScale|blackhole-webgl-context-retries/);
    expect(renderer).not.toMatch(/bootstrapTimers|getHover|getPulse|detail:/);
    expect(renderer).not.toContain("window.location.reload()");
    expect(canvas).not.toMatch(/hovered|pulse/);
    expect(app).not.toMatch(/orb:render-pulse|setPulse|pulseTimer/);
  });

  it("contains no retired compatibility modules or retry clicks", () => {
    const rust = read("../../src-tauri/src/lib.rs");
    const smoke = read("../../scripts/windows-interaction-smoke.ps1");
    expect(rust).not.toContain("#[cfg(any())]");
    expect(rust).not.toContain("orb:render-pulse");
    expect(smoke).not.toContain("RETRY_");
    expect(existsSync(fileURLToPath(new URL(
      "../components/orb/GravitySceneTexture.tsx",
      import.meta.url,
    )))).toBe(false);
  });
});
