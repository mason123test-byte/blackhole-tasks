import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { Task } from "../../types/task";

const TaskNodeView = ({ data, selected }: NodeProps) => {
  const task = data.task as Task; const complete = data.complete as (id: string) => void; const edit = data.edit as (id: string) => void; const collapse=data.collapse as (id:string,value:boolean)=>void;
  return <article className={`task-card priority-${task.priority} ${selected ? "selected" : ""} ${task.status === "blocked" ? "blocked" : ""}`} onDoubleClick={() => edit(task.id)}>
    <Handle type="target" position={Position.Left} aria-label="关系入口" />
    <header><button className="task-check nodrag" aria-label={`完成 ${task.title}`} onClick={() => complete(task.id)}>{task.status === "done" ? "✓" : ""}</button><strong>{task.title}</strong><button className="collapse nodrag" aria-label={task.collapsed ? "展开分支" : "折叠分支"} onClick={()=>collapse(task.id,!task.collapsed)}>{task.collapsed ? "+" : "−"}</button></header>
    {task.description && <p>{task.description}</p>}
    <footer><span>优先级 {task.priority}</span><span>{task.dueAt ? new Date(task.dueAt).toLocaleDateString() : "无截止时间"}</span><span>{task.progress}%</span></footer>
    <Handle type="source" position={Position.Right} aria-label="关系出口" />
  </article>;
};

export const TaskNode = memo(TaskNodeView, (previous, next) =>
  previous.selected === next.selected
  && previous.data.task === next.data.task
  && previous.data.complete === next.data.complete
  && previous.data.edit === next.data.edit
  && previous.data.collapse === next.data.collapse);
TaskNode.displayName = "TaskNode";
