import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const tauriSource = readFileSync(resolve(process.cwd(), "src-tauri/src/lib.rs"), "utf8");

describe("compact scene focus retention", () => {
  it("keeps the orb focused after UI-driven collapse so the first reopen click is actionable", () => {
    expect(tauriSource).toContain("if (focus) {");
    expect(tauriSource).toContain("window.set_focus().map_err(map_window)?;");
    expect(tauriSource).toContain("set_scene_expanded_inner(&app, expanded, true)");
    expect(tauriSource).not.toContain("if expanded && focus {");
    expect(tauriSource).not.toContain("set_scene_expanded_inner(&app, expanded, expanded)");
  });
});
