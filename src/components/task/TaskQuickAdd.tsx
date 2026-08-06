import { useState } from "react";
import { useTaskStore } from "../../stores/taskStore";
import type { Quadrant } from "../../types/task";

export function TaskQuickAdd({ onDone }: { onDone?(): void }) {
 const create=useTaskStore((s)=>s.createTask); const [title,setTitle]=useState(""); const [quadrant,setQuadrant]=useState<Quadrant>("q1"); const [dueAt,setDueAt]=useState(""); const [saving,setSaving]=useState(false);
 const save=async()=>{if(!title.trim())return;setSaving(true);try{await create({title,quadrant,dueAt:dueAt?new Date(dueAt).toISOString():null});setTitle("");onDone?.();}finally{setSaving(false)}};
 return <form className="quick-add" onSubmit={(e)=>{e.preventDefault();void save();}}><input autoFocus aria-label="任务标题" placeholder="输入任务，按 Enter 保存" value={title} onChange={(e)=>setTitle(e.target.value)}/><select aria-label="象限" value={quadrant} onChange={(e)=>setQuadrant(e.target.value as Quadrant)}><option value="q1">Q1 重要且紧急</option><option value="q2">Q2 重要不紧急</option><option value="q3">Q3 紧急不重要</option><option value="q4">Q4 不重要不紧急</option></select><input aria-label="截止时间" type="datetime-local" value={dueAt} onChange={(e)=>setDueAt(e.target.value)}/><button disabled={saving||!title.trim()}>{saving?"保存中":"新增"}</button></form>;
}

