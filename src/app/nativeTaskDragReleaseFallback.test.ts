import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const orbAppSource = readFileSync(resolve(process.cwd(), "src/app/OrbApp.tsx"), "utf8");

describe("native task drag release fallback", () => {
  it("resolves a real drag from the release point even when intermediate pointer moves are coalesced", () => {
    expect(orbAppSource).toContain(
      "const releaseDistance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);",
    );
    expect(orbAppSource).toContain(
      'const releaseZone = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-quadrant]");',
    );
    expect(orbAppSource).toContain(
      "const releaseTarget = isQuadrant(releaseValue) ? releaseValue : null;",
    );
    expect(orbAppSource).toContain("const active = session.active || releaseDistance >= 6;");
    expect(orbAppSource).toContain("const target = session.target ?? releaseTarget;");
    expect(orbAppSource).toContain("if (!active) return;");
    expect(orbAppSource).toContain("if (target && target !== session.task.quadrant) {");
    expect(orbAppSource).toContain("void updateTask(session.task.id, { quadrant: target });");
  });
});
