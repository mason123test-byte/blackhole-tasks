import type { Quadrant, TaskStatus } from "../types/task";

export interface SceneTextureTask {
  id: string;
  title: string;
  quadrant: Quadrant;
  status: TaskStatus;
}

export interface SceneTextureSnapshot {
  width: number;
  height: number;
  expanded: boolean;
  editingTaskId: string | null;
  tasks: SceneTextureTask[];
}

export type SceneTextureState = Omit<SceneTextureSnapshot, "width" | "height">;

const QUADRANTS: Quadrant[] = ["q1", "q2", "q3", "q4"];
const QUADRANT_LABELS: Record<Quadrant, string> = {
  q1: "重要且紧急",
  q2: "重要但不紧急",
  q3: "紧急但不重要",
  q4: "不重要且不紧急",
};
const QUADRANT_COLORS: Record<Quadrant, string> = {
  q1: "#f07178",
  q2: "#c3e88d",
  q3: "#ffcb6b",
  q4: "#82aaff",
};
const STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "#89aeb8",
  doing: "#82aaff",
  blocked: "#f07178",
  done: "#c3e88d",
  archived: "#546e7a",
};

const escapeXml = (value: string) =>
  value.replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const finiteSize = (value: number) => Math.max(1, Math.round(Number.isFinite(value) ? value : 1));

export function buildSceneTextureSignature(snapshot: SceneTextureSnapshot) {
  return JSON.stringify([
    finiteSize(snapshot.width),
    finiteSize(snapshot.height),
    snapshot.expanded,
    snapshot.editingTaskId,
    snapshot.tasks.map(({ id, title, quadrant, status }) => [id, title, quadrant, status]),
  ]);
}

export function buildSceneTextureSvg(snapshot: SceneTextureSnapshot) {
  const width = finiteSize(snapshot.width);
  const height = finiteSize(snapshot.height);
  const compactLayout = width <= 760 || height <= 560;
  const marginX = compactLayout ? 14 : 26;
  const top = compactLayout ? 54 : 56;
  const bottom = compactLayout ? 16 : 24;
  const centerX = width / 2;
  const centerY = height / 2;
  const centerPadX = compactLayout ? 105 : 150;
  const centerPadY = compactLayout ? 70 : 96;
  const tasks = snapshot.tasks.filter((task) => task.id !== snapshot.editingTaskId && task.status !== "archived");

  const quadrantBounds: Record<Quadrant, { left: number; right: number; headerY: number; rowsY: number }> = {
    q1: { left: marginX + 14, right: centerX - centerPadX, headerY: top + 20, rowsY: top + 43 },
    q2: { left: centerX + centerPadX, right: width - marginX - 14, headerY: top + 20, rowsY: top + 43 },
    q3: { left: marginX + 14, right: centerX - centerPadX, headerY: centerY + centerPadY + 20, rowsY: centerY + centerPadY + 43 },
    q4: { left: centerX + centerPadX, right: width - marginX - 14, headerY: centerY + centerPadY + 20, rowsY: centerY + centerPadY + 43 },
  };

  const quadrantMarkup = QUADRANTS.map((quadrant) => {
    const bounds = quadrantBounds[quadrant];
    const rowWidth = Math.max(44, bounds.right - bounds.left);
    const rows = tasks.filter((task) => task.quadrant === quadrant).slice(0, 10).map((task, index) => {
      const y = bounds.rowsY + index * 34;
      const title = escapeXml(task.title.slice(0, 72));
      return `<g data-task-id="${escapeXml(task.id)}">
        <line x1="${bounds.left}" y1="${y + 20}" x2="${bounds.left + rowWidth}" y2="${y + 20}" stroke="#708d97" stroke-opacity=".12"/>
        <text x="${bounds.left + 2}" y="${y + 13}" fill="${QUADRANT_COLORS[quadrant]}" fill-opacity=".72">&gt;</text>
        <rect x="${bounds.left + 12}" y="${y + 4}" width="10" height="10" fill="none" stroke="${STATUS_COLORS[task.status]}" stroke-opacity=".55"/>
        <text x="${bounds.left + 29}" y="${y + 13}" fill="#b8c6ca">${title}</text>
      </g>`;
    }).join("");

    return `<g data-quadrant="${quadrant}">
      <text x="${bounds.left}" y="${bounds.headerY}" fill="${QUADRANT_COLORS[quadrant]}" font-weight="600">${quadrant}</text>
      <text x="${bounds.left + 22}" y="${bounds.headerY}" fill="#6e8087">${QUADRANT_LABELS[quadrant]}</text>
      <line x1="${bounds.left}" y1="${bounds.headerY + 9}" x2="${bounds.left + rowWidth}" y2="${bounds.headerY + 9}" stroke="#7897a1" stroke-opacity=".2" stroke-dasharray="3 3"/>
      ${rows}
    </g>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#020508"/>
    <g fill="none" stroke="#738f9c" stroke-opacity=".22">
      <line x1="${marginX}" y1="${centerY}" x2="${width - marginX}" y2="${centerY}"/>
      <line x1="${centerX}" y1="${top}" x2="${centerX}" y2="${height - bottom}"/>
    </g>
    <g font-family="Cascadia Mono,Consolas,Microsoft YaHei,monospace" font-size="11">
      <text x="${Math.max(32, centerX - 280)}" y="34" fill="#80cbc4">$</text>
      <text x="${Math.max(48, centerX - 262)}" y="34" fill="#52646c">filter tasks</text>
      ${snapshot.expanded ? quadrantMarkup : ""}
    </g>
  </svg>`;
}

export async function createSceneTextureBitmap(snapshot: SceneTextureSnapshot) {
  const blob = new Blob([buildSceneTextureSvg(snapshot)], { type: "image/svg+xml;charset=utf-8" });
  return createImageBitmap(blob);
}
