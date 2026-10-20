import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Task } from "../../types/task";

const priorityLabels = ["无", "低", "普通", "高", "最高"] as const;
const statusLabels = { todo: "待办", doing: "进行中", blocked: "已阻塞", done: "已完成", archived: "已归档" } as const;
const dateFormatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

const TaskNodeView = ({ data, selected }: NodeProps) => {
  const task = data.task as Task;
  const childCount = data.childCount as number;
  const complete = data.complete as (id: string) => void;
  const edit = data.edit as (id: string) => void;
  const collapse = data.collapse as (id: string, value: boolean) => void;

  return <article
    tabIndex={0}
    aria-label={`${task.title}，${statusLabels[task.status]}`}
    className={`task-card priority-${task.priority} status-${task.status} ${selected ? "selected" : ""}`}
    onDoubleClick={() => edit(task.id)}
    onKeyDown={(event) => { if (event.target === event.currentTarget && event.key === "Enter") edit(task.id); }}
  >
    <Handle type="target" position={Position.Left} aria-label="关系入口" />
    <header>
      <button className="task-check nodrag" aria-label={`完成 ${task.title}`} onClick={() => complete(task.id)}>{task.status === "done" ? "✓" : ""}</button>
      <strong>{task.title}</strong>
      {childCount > 0
        ? <button className="collapse nodrag" aria-label={task.collapsed ? `展开 ${childCount} 个子任务` : `折叠 ${childCount} 个子任务`} onClick={() => collapse(task.id, !task.collapsed)}>{task.collapsed ? `+${childCount}` : "−"}</button>
        : <span className="card-spacer"/>}
    </header>
    {task.description && <p>{task.description}</p>}
    <div className="card-meta">
      <span className={`status-chip ${task.status}`}>{statusLabels[task.status]}</span>
      {task.priority > 0 && <span>优先级 · {priorityLabels[task.priority]}</span>}
      {task.dueAt && <span>截止 {dateFormatter.format(new Date(task.dueAt))}</span>}
    </div>
    {task.tags.length > 0 && <div className="card-tags">{task.tags.slice(0, 2).map((tag) => <span key={tag.id}>#{tag.name}</span>)}{task.tags.length > 2 && <span>+{task.tags.length - 2}</span>}</div>}
    <footer><div className="progress-track" role="progressbar" aria-label="任务进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={task.progress}><i style={{ width: `${task.progress}%` }}/></div><span>{task.progress}%</span></footer>
    <Handle type="source" position={Position.Right} aria-label="关系出口" />
  </article>;
};

export const TaskNode = memo(TaskNodeView, (previous, next) =>
  previous.selected === next.selected
  && previous.data.task === next.data.task
  && previous.data.childCount === next.data.childCount
  && previous.data.complete === next.data.complete
  && previous.data.edit === next.data.edit
  && previous.data.collapse === next.data.collapse);
TaskNode.displayName = "TaskNode";
