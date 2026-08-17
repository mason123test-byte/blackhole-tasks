import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "../types/settings";
import { DEFAULT_SETTINGS } from "../types/settings";
import type { CreateTaskInput, Tag, Task, TaskPositionUpdate, TaskRelation, TaskRelationType } from "../types/task";
import { quadrantOrigin, quadrantToFlags } from "../utils/quadrant";

const STORAGE_KEY = "blackhole-tasks-browser-data";
const isTauri = () => "__TAURI_INTERNALS__" in window;

interface BrowserData { tasks: Task[]; relations: TaskRelation[]; tags: Tag[]; settings: AppSettings }

const emptyData = (): BrowserData => ({ tasks: [], relations: [], tags: [], settings: DEFAULT_SETTINGS });
const read = (): BrowserData => {
  try { return { ...emptyData(), ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") }; }
  catch { return emptyData(); }
};
const write = (data: BrowserData) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

type CommandInvoker = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

const startupStateMissing = (error: unknown) =>
  String(error).includes("state not managed") || String(error).includes(".manage() before using this command");

const wait = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
const waitForPaint = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

/**
 * Static Tauri WebViews can finish loading a few milliseconds before setup has
 * registered Rust managed state. Retry only that transient startup condition;
 * real command and database errors still surface immediately.
 */
export async function invokeWhenReady<T>(
  command: string,
  args?: Record<string, unknown>,
  invoker: CommandInvoker = invoke,
): Promise<T> {
  const delays = [30, 50, 80, 120, 180, 250, 350];
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await invoker<T>(command, args);
    } catch (error) {
      if (!startupStateMissing(error) || attempt >= delays.length) throw error;
      await wait(delays[attempt]);
    }
  }
}

function browserTask(input: CreateTaskInput): Task {
  const now = new Date().toISOString();
  const quadrant = input.quadrant ?? "q1";
  const origin = quadrantOrigin(quadrant);
  return {
    id: crypto.randomUUID(), title: input.title.trim(), description: input.description ?? "", status: "todo",
    ...quadrantToFlags(quadrant), quadrant, priority: input.priority ?? 2, progress: 0,
    canvasX: input.canvasX ?? origin.x, canvasY: input.canvasY ?? origin.y, width: 240, height: 96,
    parentId: input.parentId ?? null, collapsed: false, startAt: null, dueAt: input.dueAt ?? null,
    completedAt: null, archivedAt: null, estimatedMinutes: null, actualMinutes: null,
    createdAt: now, updatedAt: now, version: 1, tags: [],
  };
}

export const backend = {
  async listTasks(): Promise<Task[]> { return isTauri() ? invokeWhenReady("list_tasks") : read().tasks; },
  async listRelations(): Promise<TaskRelation[]> { return isTauri() ? invokeWhenReady("list_relations") : read().relations; },
  async listTags(): Promise<Tag[]> { return isTauri() ? invokeWhenReady("list_tags") : read().tags; },
  async createTask(input: CreateTaskInput): Promise<Task> {
    if (isTauri()) return invokeWhenReady("create_task", { input });
    if (!input.title.trim()) throw new Error("任务标题不能为空");
    const data = read(); const task = browserTask(input); data.tasks.push(task); write(data); return task;
  },
  async updateTask(id: string, patch: Partial<Task>): Promise<Task> {
    if (isTauri()) return invokeWhenReady("update_task", { id, patch });
    const data = read(); const index = data.tasks.findIndex((item) => item.id === id);
    if (index < 0) throw new Error("任务不存在");
    const quadrant = patch.quadrant ?? data.tasks[index].quadrant;
    data.tasks[index] = { ...data.tasks[index], ...patch, ...quadrantToFlags(quadrant), updatedAt: new Date().toISOString(), version: data.tasks[index].version + 1 };
    write(data); return data.tasks[index];
  },
  async deleteTask(id: string) {
    if (isTauri()) return invokeWhenReady<void>("delete_task", { id });
    const data = read(); data.tasks = data.tasks.filter((item) => item.id !== id); data.relations = data.relations.filter((item) => item.sourceTaskId !== id && item.targetTaskId !== id); write(data);
  },
  async completeTask(id: string): Promise<Task> {
    if (isTauri()) return invokeWhenReady("complete_task", { id });
    return this.updateTask(id, { status: "done", progress: 100, completedAt: new Date().toISOString() });
  },
  async updatePositions(updates: TaskPositionUpdate[]) {
    if (isTauri()) return invokeWhenReady<void>("update_tasks_positions", { updates });
    for (const update of updates) await this.updateTask(update.id, { canvasX: update.canvasX, canvasY: update.canvasY, quadrant: update.quadrant });
  },
  async createRelation(sourceTaskId: string, targetTaskId: string, relationType: TaskRelationType): Promise<TaskRelation> {
    if (isTauri()) return invokeWhenReady("create_relation", { input: { sourceTaskId, targetTaskId, relationType, label: null } });
    const data = read();
    if (sourceTaskId === targetTaskId) throw new Error("任务不能关联自身");
    const now = new Date().toISOString();
    const relation = { id: crypto.randomUUID(), sourceTaskId, targetTaskId, relationType, label: null, createdAt: now, updatedAt: now } satisfies TaskRelation;
    data.relations.push(relation); write(data); return relation;
  },
  async deleteRelation(id: string) {
    if (isTauri()) return invokeWhenReady<void>("delete_relation", { id });
    const data = read(); data.relations = data.relations.filter((item) => item.id !== id); write(data);
  },
  async getSettings(): Promise<AppSettings> { return isTauri() ? invokeWhenReady("get_settings") : read().settings; },
  async updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    if (isTauri()) return invokeWhenReady("update_settings", { patch });
    const data = read(); data.settings = { ...data.settings, ...patch }; write(data); return data.settings;
  },
  async window(command: string, args: Record<string, unknown> = {}) {
    if (!isTauri()) return;
    if (command === "set_scene_expanded") await waitForPaint();
    await invokeWhenReady(command, args);
  },
  async exportData(): Promise<string> {
    if (isTauri()) return invokeWhenReady("export_data");
    return JSON.stringify({ format: "blackhole-tasks", formatVersion: 1, exportedAt: new Date().toISOString(), appVersion: "0.1.0", ...read() }, null, 2);
  },
};
