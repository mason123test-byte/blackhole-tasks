import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const smokeSource = readFileSync(resolve(process.cwd(), "scripts/windows-interaction-smoke.ps1"), "utf8");

describe("native compact renderer readiness", () => {
  it("does not click a newly collapsed scene until its compact WebGL2 frame is ready", () => {
    const start = smokeSource.indexOf("function Wait-SceneCompact");
    const end = smokeSource.indexOf("\nfunction Ensure-WindowOnVirtualScreen", start);
    const helper = smokeSource.slice(start, end);

    expect(helper).toContain("renderer=webgl2\\|frame=ready");
    expect(helper).toContain("$renderWidth");
    expect(helper).toContain("$renderHeight");
    expect(helper).toContain("$MaximumWidth * 1.5");
    expect(helper).toContain("$MaximumHeight * 1.5");
    expect(helper).toContain("renderer=canvas2d");
  });

  it("starts a separate render-ready grace window after the native scene is compact", () => {
    const start = smokeSource.indexOf("function Wait-SceneCompact");
    const end = smokeSource.indexOf("\nfunction Ensure-WindowOnVirtualScreen", start);
    const helper = smokeSource.slice(start, end);

    expect(helper).toContain("$sizeDeadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)");
    expect(helper).toContain("$renderDeadline = $null");
    expect(helper).toContain("$compactBounds = $width -le $MaximumWidth -and $height -le $MaximumHeight");
    expect(helper).toContain("$renderDeadline = [DateTime]::UtcNow.AddMilliseconds(15000)");
    expect(helper).toContain("if ($compactBounds -and $null -eq $renderDeadline)");
  });
});
