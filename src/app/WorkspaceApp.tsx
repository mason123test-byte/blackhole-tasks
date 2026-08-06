import { useCallback, useEffect, useState } from "react";
import { backend } from "../services/backend";
import { useHistoryStore } from "../stores/historyStore";
import { useTaskStore } from "../stores/taskStore";
import type { Tag } from "../types/task";
import type { TaskFilters } from "../utils/filter";
import { TaskQuickAdd } from "../components/task/TaskQuickAdd";
import { TaskCanvas } from "../components/workspace/TaskCanvas";
import { TaskDetailPanel } from "../components/workspace/TaskDetailPanel";
import { WorkspaceToolbar } from "../components/workspace/WorkspaceToolbar";

export function WorkspaceApp() {
  const { loadAll, error, selectedTaskIds, deleteTask, completeTask } = useTaskStore();
  const [filters, setFilters] = useState<TaskFilters>({ query: "", status: "all", tag: "all", showCompleted: false });
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [fitRequest, setFitRequest] = useState(0);
  const [tags, setTags] = useState<Tag[]>([]);
  const undo = useHistoryStore((state) => state.undo);
  const redo = useHistoryStore((state) => state.redo);

  useEffect(() => {
    void loadAll();
    void backend.listTags().then(setTags);
    void backend.window("set_workspace_hovered", { hovered: true });
    return () => { void backend.window("set_workspace_hovered", { hovered: false }); };
  }, [loadAll]);
  const close = useCallback(() => void backend.window("hide_workspace"), []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editingText = target?.matches("input, textarea, select, [contenteditable='true']") ?? false;
      if (event.key === "Escape") {
        if (editing) setEditing(null);
        else close();
      }
      if (event.ctrlKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        setAdding(true);
      }
      if (!editingText && event.ctrlKey && event.key === "Enter" && selectedTaskIds[0]) void completeTask(selectedTaskIds[0]);
      if (!editingText && event.key === "Delete" && selectedTaskIds.length > 0 && window.confirm(`确定删除选中的 ${selectedTaskIds.length} 个任务吗？`)) {
        selectedTaskIds.forEach((id) => void deleteTask(id));
      }
      if (event.ctrlKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        void (event.shiftKey ? redo() : undo());
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [close, completeTask, deleteTask, editing, redo, selectedTaskIds, undo]);

  const exportJson = async () => {
    const json = await backend.exportData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `blackhole-tasks-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return <main className="workspace-app" onPointerEnter={() => void backend.window("set_workspace_hovered", { hovered: true })} onPointerLeave={() => void backend.window("set_workspace_hovered", { hovered: false })}>
    <WorkspaceToolbar filters={filters} onChange={(patch) => setFilters((value) => ({ ...value, ...patch }))} tags={tags} onAdd={() => setAdding(true)} onUndo={() => void undo()} onRedo={() => void redo()} onFit={() => setFitRequest((value) => value + 1)} onExport={() => void exportJson()} onClose={close}/>
    {adding && <div className="add-panel"><TaskQuickAdd onDone={() => setAdding(false)}/><button aria-label="关闭新增" onClick={() => setAdding(false)}>×</button></div>}
    {error && <div className="error-banner" role="alert">{error}</div>}
    <TaskCanvas filters={filters} fitRequest={fitRequest} onAdd={() => setAdding(true)} onEdit={setEditing}/>
    {editing && <TaskDetailPanel key={editing} taskId={editing} onClose={() => setEditing(null)}/>}
  </main>;
}
