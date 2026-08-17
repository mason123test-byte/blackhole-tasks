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

  it("keeps dragging through the root surface when WebView2 pointer capture is unavailable", () => {
    expect(orbAppSource).toContain("try {");
    expect(orbAppSource).toContain("event.currentTarget.setPointerCapture(event.pointerId);");
    expect(orbAppSource).toContain("} catch {");
    expect(orbAppSource).toContain("onPointerMove={(event) => {");
    expect(orbAppSource).toContain("if (taskDragRef.current) moveTaskDrag(event);");
    expect(orbAppSource).toContain("else void moveWindow(event);");
    expect(orbAppSource).toContain("onPointerUp={(event) => {");
    expect(orbAppSource).toContain("if (taskDragRef.current) endTaskDrag(event);");
  });

  it("falls back to MouseEvents when injected Win32 input does not produce a complete PointerEvent stream", () => {
    expect(orbAppSource).toContain("onMouseDown={(event) => onMouseDown(event, task)}");
    expect(orbAppSource).toContain("const startTaskMouseDrag = (event: React.MouseEvent<HTMLElement>, task: Task) => {");
    expect(orbAppSource).toContain("const moveTaskMouseDrag = (event: React.MouseEvent<HTMLElement>) => {");
    expect(orbAppSource).toContain("const endTaskMouseDrag = (event: React.MouseEvent<HTMLElement>) => {");
    expect(orbAppSource).toContain("onMouseMove={(event) => {");
    expect(orbAppSource).toContain("if (taskDragRef.current) moveTaskMouseDrag(event);");
    expect(orbAppSource).toContain("onMouseUp={(event) => {");
    expect(orbAppSource).toContain("if (taskDragRef.current) endTaskMouseDrag(event);");
  });
});
