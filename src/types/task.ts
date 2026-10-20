export type TaskStatus = "todo" | "doing" | "blocked" | "done" | "archived";
export type Quadrant = "q1" | "q2" | "q3" | "q4";
export type TaskPriority = 0 | 1 | 2 | 3 | 4;
export type TaskRelationType = "parent_child" | "dependency" | "reference";

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  important: boolean;
  urgent: boolean;
  quadrant: Quadrant;
  priority: TaskPriority;
  progress: number;
  canvasX: number;
  canvasY: number;
  width: number;
  height: number;
  parentId: string | null;
  collapsed: boolean;
  startAt: string | null;
  dueAt: string | null;
  completedAt: string | null;
  archivedAt: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  tags: Tag[];
}

export interface TaskRelation {
  id: string;
  sourceTaskId: string;
  targetTaskId: string;
  relationType: TaskRelationType;
  label: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Tag { id: string; name: string; createdAt: string; updatedAt: string }
export interface TaskTag { taskId: string; tagId: string }

export interface CreateTaskInput {
  title: string;
  description?: string;
  quadrant?: Quadrant;
  priority?: TaskPriority;
  canvasX?: number;
  canvasY?: number;
  dueAt?: string | null;
  parentId?: string | null;
}

export interface TaskPositionUpdate { id: string; canvasX: number; canvasY: number; quadrant: Quadrant }

