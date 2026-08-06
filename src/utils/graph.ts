import type { Task, TaskRelation } from "../types/task";

export function wouldCreateCycle(relations: TaskRelation[], source: string, target: string, type: "parent_child" | "dependency") {
  if (source === target) return true;
  const adjacency = new Map<string, string[]>();
  for (const relation of relations.filter((item) => item.relationType === type)) {
    const next = adjacency.get(relation.sourceTaskId) ?? [];
    next.push(relation.targetTaskId);
    adjacency.set(relation.sourceTaskId, next);
  }
  const stack = [target];
  const visited = new Set<string>();
  while (stack.length) {
    const current = stack.pop()!;
    if (current === source) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    stack.push(...(adjacency.get(current) ?? []));
  }
  return false;
}

export function hiddenByCollapsedParents(tasks: Task[], relations: TaskRelation[]) {
  const hidden = new Set<string>();
  const children = new Map<string, string[]>();
  for (const relation of relations.filter((item) => item.relationType === "parent_child")) {
    children.set(relation.sourceTaskId, [...(children.get(relation.sourceTaskId) ?? []), relation.targetTaskId]);
  }
  const visit = (id: string) => {
    for (const child of children.get(id) ?? []) {
      if (!hidden.has(child)) { hidden.add(child); visit(child); }
    }
  };
  for (const task of tasks) if (task.collapsed) visit(task.id);
  return hidden;
}

