import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tauriSource = readFileSync(resolve(process.cwd(), "src-tauri/src/lib.rs"), "utf8");
const backendSource = readFileSync(resolve(process.cwd(), "src/services/backend.ts"), "utf8");
const orbAppSource = readFileSync(resolve(process.cwd(), "src/app/OrbApp.tsx"), "utf8");

describe("compact scene focus retention", () => {
  it("keeps the orb focused after UI-driven collapse so the first reopen click is actionable", () => {
    expect(tauriSource).toContain("if focus {");
    expect(tauriSource).toContain("window.set_focus().map_err(map_window)?;");
    expect(tauriSource).toContain("set_scene_expanded_inner(&app, expanded, true)");
    expect(tauriSource).not.toContain("if expanded && focus {");
    expect(tauriSource).not.toContain("set_scene_expanded_inner(&app, expanded, expanded)");
  });

  it("waits for React paint only before expansion, never before collapse", () => {
    expect(backendSource).toContain("const waitForPaint = () =>");
    expect(backendSource).toContain("requestAnimationFrame(() => requestAnimationFrame(() => resolve()))");
    expect(backendSource).toContain(
      'if (command === "set_scene_expanded" && args.expanded === true) await waitForPaint();',
    );
    expect(backendSource).not.toContain('if (command === "set_scene_expanded") await waitForPaint();');
    expect(orbAppSource).toContain("if (next) {");
    expect(orbAppSource).toContain(
      "await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));",
    );
  });
});
