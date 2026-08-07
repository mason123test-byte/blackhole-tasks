import { forwardRef, useEffect, useRef } from "react";
import type { Task } from "../../types/task";

interface GravitySceneTextureProps {
  tasks: Task[];
  expanded: boolean;
}

export const GravitySceneTexture = forwardRef<HTMLCanvasElement, GravitySceneTextureProps>(function GravitySceneTexture({ tasks, expanded }, forwardedRef) {
  const localRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = localRef.current;
    if (!canvas) return;
    const draw = () => {
      const width = Math.max(240, Math.round(canvas.clientWidth || 240));
      const height = Math.max(180, Math.round(canvas.clientHeight || 180));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      const context = canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, width, height);
      if (!expanded) { canvas.dataset.version = String(Number(canvas.dataset.version ?? 0) + 1); return; }

      const left = 32;
      const top = 72;
      const right = width - 32;
      const bottom = height - 30;
      const columnGap = width < 760 ? 170 : 220;
      const rowGap = height < 560 ? 142 : 184;
      const columnWidth = (right - left - columnGap) / 2;
      const rowHeight = (bottom - top - rowGap) / 2;
      const zones = {
        q1: { x: left, y: top },
        q2: { x: left + columnWidth + columnGap, y: top },
        q3: { x: left, y: top + rowHeight + rowGap },
        q4: { x: left + columnWidth + columnGap, y: top + rowHeight + rowGap },
      } as const;

      context.save();
      context.font = '600 11px "Segoe UI", sans-serif';
      context.textBaseline = "middle";
      for (const quadrant of ["q1", "q2", "q3", "q4"] as const) {
        const zone = zones[quadrant];
        context.strokeStyle = "rgba(221,151,92,.18)";
        context.lineWidth = 1;
        context.strokeRect(zone.x, zone.y, columnWidth, rowHeight);
        context.fillStyle = "rgba(255,178,111,.34)";
        context.fillText(quadrant.toUpperCase(), zone.x + 12, zone.y + 20);
        const zoneTasks = tasks.filter((task) => task.quadrant === quadrant).slice(0, 5);
        zoneTasks.forEach((task, index) => {
          const cardX = zone.x + 9;
          const cardY = zone.y + 47 + index * 56;
          const cardWidth = Math.max(80, columnWidth - 18);
          const cardHeight = 47;
          if (cardY + cardHeight > zone.y + rowHeight) return;
          const glow = context.createLinearGradient(cardX, cardY, cardX + cardWidth, cardY);
          glow.addColorStop(0, "rgba(209,125,67,.30)");
          glow.addColorStop(0.08, "rgba(26,37,51,.48)");
          glow.addColorStop(1, "rgba(10,16,24,.18)");
          context.fillStyle = glow;
          context.fillRect(cardX, cardY, cardWidth, cardHeight);
          context.fillStyle = "rgba(242,232,222,.46)";
          const title = task.title.length > 22 ? `${task.title.slice(0, 22)}…` : task.title;
          context.fillText(title, cardX + 12, cardY + cardHeight / 2);
        });
      }
      context.restore();
      canvas.dataset.version = String(Number(canvas.dataset.version ?? 0) + 1);
    };
    draw();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(draw);
    observer?.observe(canvas);
    return () => observer?.disconnect();
  }, [expanded, tasks]);

  return <canvas ref={(node) => {
    localRef.current = node;
    if (typeof forwardedRef === "function") forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }} className="gravity-scene-texture" aria-hidden="true"/>;
});
