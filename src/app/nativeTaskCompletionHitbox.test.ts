import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync(resolve(process.cwd(), "src/main.tsx"), "utf8");
const hitTargetCss = readFileSync(resolve(process.cwd(), "src/styles/native-hit-target.css"), "utf8");

describe("native task completion hit target", () => {
  it("keeps the compact visual checkbox while extending its pointer hit area", () => {
    expect(mainSource).toContain('import "./styles/native-hit-target.css";');
    expect(hitTargetCss).toContain(".gravity-app.is-expanded .gravity-check {");
    expect(hitTargetCss).toContain("position: relative;");
    expect(hitTargetCss).toContain(".gravity-app.is-expanded .gravity-check::before {");
    expect(hitTargetCss).toContain('content: "";');
    expect(hitTargetCss).toContain("position: absolute;");
    expect(hitTargetCss).toContain("inset: -6px;");
  });
});
