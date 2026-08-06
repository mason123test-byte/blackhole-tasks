import { create } from "zustand";
import { backend } from "../services/backend";
import type { CreateTaskInput, Task, TaskPositionUpdate, TaskRelation, TaskRelationType } from "../types/task";
import { wouldCreateCycle } from "../utils/graph";

interface TaskState {
  tasks: Task[]; relations: TaskRelation[]; selectedTaskIds: string[]; loading: boolean; error: string | null;
  loadAll(): Promise<void>; createTask(input: CreateTaskInput): Promise<Task>; updateTask(id: string, patch: Partial<Task>): Promise<void>;
  deleteTask(id: string): Promise<void>; completeTask(id: string): Promise<void>; moveTasks(updates: TaskPositionUpdate[]): Promise<void>;
  createRelation(source: string, target: string, type: TaskRelationType): Promise<void>; deleteRelation(id: string): Promise<void>;
  selectTask(id: string, append?: boolean): void; selectTasks(ids: string[]): void; clearSelection(): void;
}

const message = (error: unknown) => error instanceof Error ? error.message : String(error);

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [], relations: [], selectedTaskIds: [], loading: false, error: null,
  async loadAll() {
    set({ loading: true, error: null });
    try { const [tasks, relations] = await Promise.all([backend.listTasks(), backend.listRelations()]); set({ tasks, relations, loading: false }); }
    catch (error) { set({ error: message(error), loading: false }); }
  },
  async createTask(input) { const task = await backend.createTask(input); set((state) => ({ tasks: [...state.tasks, task] })); return task; },
  async updateTask(id, patch) {
    const previous = get().tasks.find((item) => item.id === id); if (!previous) return;
    set((state) => ({ tasks: state.tasks.map((task) => task.id === id ? { ...task, ...patch } : task) }));
    try { const saved = await backend.updateTask(id, patch); set((state) => ({ tasks: state.tasks.map((task) => task.id === id ? saved : task) })); }
    catch (error) { set((state) => ({ tasks: state.tasks.map((task) => task.id === id ? previous : task), error: message(error) })); }
  },
  async deleteTask(id) { await backend.deleteTask(id); set((state) => ({ tasks: state.tasks.filter((item) => item.id !== id), relations: state.relations.filter((item) => item.sourceTaskId !== id && item.targetTaskId !== id) })); },
  async completeTask(id) { const saved = await backend.completeTask(id); set((state) => ({ tasks: state.tasks.map((item) => item.id === id ? saved : item) })); },
  async moveTasks(updates) {
    const byId = new Map(updates.map((item) => [item.id, item]));
    set((state) => ({ tasks: state.tasks.map((task) => byId.has(task.id) ? { ...task, canvasX: byId.get(task.id)!.canvasX, canvasY: byId.get(task.id)!.canvasY, quadrant: byId.get(task.id)!.quadrant } : task) }));
    try { await backend.updatePositions(updates); } catch (error) { set({ error: message(error) }); await get().loadAll(); }
  },
  async createRelation(source, target, type) {
    if ((type === "parent_child" || type === "dependency") && wouldCreateCycle(get().relations, source, target, type)) throw new Error("该关系会形成循环");
    const relation = await backend.createRelation(source, target, type); set((state) => ({ relations: [...state.relations, relation] }));
  },
  async deleteRelation(id) { await backend.deleteRelation(id); set((state) => ({ relations: state.relations.filter((item) => item.id !== id) })); },
  selectTask(id, append = false) { set((state) => ({ selectedTaskIds: append ? [...new Set([...state.selectedTaskIds, id])] : [id] })); },
  selectTasks(ids) { set({ selectedTaskIds: ids }); }, clearSelection() { set({ selectedTaskIds: [] }); },
}));

