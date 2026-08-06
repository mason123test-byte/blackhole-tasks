import { useEffect, useState } from "react";
import { useTaskStore } from "../../stores/taskStore";
import type { Quadrant, TaskPriority, TaskStatus } from "../../types/task";

export function TaskDetailPanel({ taskId, onClose }: { taskId: string; onClose(): void }) {
  const task=useTaskStore((s)=>s.tasks.find((item)=>item.id===taskId)); const update=useTaskStore((s)=>s.updateTask); const remove=useTaskStore((s)=>s.deleteTask);
  const [title,setTitle]=useState(task?.title??""); const [description,setDescription]=useState(task?.description??"");
  useEffect(()=>{if(!task||title===task.title)return;const timer=setTimeout(()=>update(task.id,{title}),500);return()=>clearTimeout(timer);},[title,task,update]);
  useEffect(()=>{if(!task||description===task.description)return;const timer=setTimeout(()=>update(task.id,{description}),500);return()=>clearTimeout(timer);},[description,task,update]);
  if(!task)return null;
  const deleteTask=async()=>{if(confirm(`确定删除“${task.title}”吗？此操作会删除相关连线。`)){await remove(task.id);onClose();}};
  return <aside className="detail-panel" aria-label="任务详情"><header><h2>任务详情</h2><button aria-label="关闭详情" onClick={onClose}>×</button></header>
    <label>标题<input value={title} onChange={(e)=>setTitle(e.target.value)}/></label><label>描述<textarea rows={7} value={description} onChange={(e)=>setDescription(e.target.value)} placeholder="支持 Markdown 文本"/></label>
    <div className="field-grid"><label>状态<select value={task.status} onChange={(e)=>update(task.id,{status:e.target.value as TaskStatus})}><option value="todo">待办</option><option value="doing">进行中</option><option value="blocked">已阻塞</option><option value="done">已完成</option><option value="archived">已归档</option></select></label>
    <label>象限<select value={task.quadrant} onChange={(e)=>update(task.id,{quadrant:e.target.value as Quadrant})}><option value="q1">Q1 重要且紧急</option><option value="q2">Q2 重要不紧急</option><option value="q3">Q3 紧急不重要</option><option value="q4">Q4 不重要不紧急</option></select></label>
    <label>优先级<select value={task.priority} onChange={(e)=>update(task.id,{priority:Number(e.target.value) as TaskPriority})}>{[0,1,2,3,4].map((value)=><option key={value} value={value}>{value}</option>)}</select></label>
    <label>进度<input type="number" min="0" max="100" value={task.progress} onChange={(e)=>update(task.id,{progress:Math.min(100,Math.max(0,Number(e.target.value)))})}/></label>
    <label>截止时间<input type="datetime-local" value={task.dueAt?.slice(0,16)??""} onChange={(e)=>update(task.id,{dueAt:e.target.value?new Date(e.target.value).toISOString():null})}/></label></div>
    <p className="save-note">字段停止输入 500ms 后自动保存</p><button className="danger" onClick={deleteTask}>删除任务</button>
  </aside>;
}
