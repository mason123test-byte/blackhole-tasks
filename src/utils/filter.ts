import type { Task } from "../types/task";

export interface TaskFilters { query: string; status: string; tag: string; showCompleted: boolean }

export function taskMatches(task: Task, filters: TaskFilters) {
  if (!filters.showCompleted && (task.status === "done" || task.status === "archived")) return false;
  if (filters.status !== "all" && task.status !== filters.status) return false;
  if (filters.tag !== "all" && !task.tags.some((tag) => tag.id === filters.tag)) return false;
  const query = filters.query.trim().toLocaleLowerCase();
  if (!query) return true;
  return [task.title, task.description, ...task.tags.map((tag) => tag.name)]
    .some((value) => value.toLocaleLowerCase().includes(query));
}

