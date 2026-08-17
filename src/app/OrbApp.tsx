import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { BlackHoleCanvas } from "../components/orb/BlackHoleCanvas";
import { useSettingsStore } from "../stores/settingsStore";
import { useTaskStore } from "../stores/taskStore";
import { backend } from "../services/backend";
import type { Quadrant, Task, TaskStatus } from "../types/task";
import { quadrantLabels } from "../utils/quadrant";

const QUADRANTS: Quadrant[] = ["q1", "q2", "q3", "q4"];
const statusLabels: Record<TaskStatus, string> = {
  todo: "待办",
  doing: "进行中",
  blocked: "阻塞",
  done: "完成",
  archived: "归档",
};

interface TaskDragSession {
  task: Task;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
  target: Quadrant | null;
}

const isQuadrant = (value: string | undefined): value is Quadrant =>
  value !== undefined && QUADRANTS.includes(value as Quadrant);

function InlineAdd({ quadrant, onDone }: { quadrant: Quadrant; onDone(): void }) {
  const createTask = useTaskStore((state) => state.createTask);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      await createTask({ title: title.trim(), quadrant });
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="gravity-add" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <input
        autoFocus
        aria-label={`${quadrantLabels[quadrant]}新增任务`}
        placeholder="输入任务，Enter 保存"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Escape") onDone(); }}
      />
      <button type="submit" disabled={saving || !title.trim()}>{saving ? "…" : "↵"}</button>
    </form>
  );
}

function InlineTaskEditor({ task, onClose }: { task: Task; onClose(): void }) {
  const updateTask = useTaskStore((state) => state.updateTask);
  const deleteTask = useTaskStore((state) => state.deleteTask);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);

  const saveText = () => {
    const cleanTitle = title.trim();
    if (cleanTitle && (cleanTitle !== task.title || description !== task.description)) {
      void updateTask(task.id, { title: cleanTitle, description });
    }
  };

  return (
    <article className="gravity-card gravity-card-editing" aria-label={`编辑 ${task.title}`}>
      <input
        autoFocus
        className="gravity-title-input"
        aria-label="任务标题"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={saveText}
        onKeyDown={(event) => {
          if (event.key === "Enter") { saveText(); onClose(); }
          if (event.key === "Escape") onClose();
        }}
      />
      <textarea
        aria-label="任务描述"
        placeholder="备注（可选）"
        rows={2}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        onBlur={saveText}
      />
      <div className="gravity-editor-actions">
        <button type="button" onClick={() => { saveText(); onClose(); }}>保存</button>
        <button
          type="button"
          className="gravity-delete"
          onClick={() => {
            if (window.confirm(`确定删除“${task.title}”吗？`)) void deleteTask(task.id).then(onClose);
          }}
        >删除</button>
      </div>
    </article>
  );
}

function GravityTaskCard({
  task,
  dragging,
  onEdit,
  onPointerDown,
  onPointerMove,
  onPointerEnd,
}: {
  task: Task;
  dragging: boolean;
  onEdit(): void;
  onPointerDown(event: React.PointerEvent<HTMLElement>, task: Task): void;
  onPointerMove(event: React.PointerEvent<HTMLElement>): void;
  onPointerEnd(event: React.PointerEvent<HTMLElement>): void;
}) {
  const completeTask = useTaskStore((state) => state.completeTask);
  return (
    <article
      className={`gravity-card status-${task.status}${dragging ? " is-dragging" : ""}`}
      tabIndex={0}
      aria-grabbed={dragging}
      aria-label={`${task.title}，${statusLabels[task.status]}`}
      onPointerDown={(event) => onPointerDown(event, task)}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClick={(event) => { if (!(event.target as HTMLElement).closest("button")) onEdit(); }}
      onKeyDown={(event) => { if (event.key === "Enter") onEdit(); }}
    >
      <button
        type="button"
        className="gravity-check"
        aria-label={`完成 ${task.title}`}
        onClick={(event) => { event.stopPropagation(); void completeTask(task.id); }}
      >{task.status === "done" ? "✓" : ""}</button>
      <div className="gravity-card-body">
        <strong>{task.title}</strong>
        <span>{task.status === "todo" ? "拖动到其他象限" : statusLabels[task.status]}</span>
      </div>
    </article>
  );
}

function QuadrantZone({
  quadrant,
  tasks,
  adding,
  editingId,
  onAdd,
  onAddDone,
  onEdit,
  dropTarget,
  draggingId,
  onTaskPointerDown,
  onTaskPointerMove,
  onTaskPointerEnd,
}: {
  quadrant: Quadrant;
  tasks: Task[];
  adding: boolean;
  editingId: string | null;
  onAdd(): void;
  onAddDone(): void;
  onEdit(id: string | null): void;
  dropTarget: boolean;
  draggingId: string | null;
  onTaskPointerDown(event: React.PointerEvent<HTMLElement>, task: Task): void;
  onTaskPointerMove(event: React.PointerEvent<HTMLElement>): void;
  onTaskPointerEnd(event: React.PointerEvent<HTMLElement>): void;
}) {
  return (
    <section
      className={`gravity-quadrant gravity-${quadrant}${dropTarget ? " is-drop-target" : ""}`}
      data-quadrant={quadrant}
      aria-label={`${quadrant.toUpperCase()} ${quadrantLabels[quadrant]}`}
    >
      <header>
        <span><b>{quadrant}</b><em>{quadrantLabels[quadrant]}</em></span>
        <button type="button" aria-label={`在 ${quadrant.toUpperCase()} 新增任务`} onClick={onAdd}>+ task</button>
      </header>
      <div className="gravity-task-list">
        {adding && <InlineAdd quadrant={quadrant} onDone={onAddDone}/>}
        {tasks.map((task) => editingId === task.id
          ? <InlineTaskEditor key={task.id} task={task} onClose={() => onEdit(null)}/>
          : <GravityTaskCard
              key={task.id}
              task={task}
              dragging={draggingId === task.id}
              onEdit={() => onEdit(task.id)}
              onPointerDown={onTaskPointerDown}
              onPointerMove={onTaskPointerMove}
              onPointerEnd={onTaskPointerEnd}
            />) }
      </div>
    </section>
  );
}

export function OrbApp() {
  const settings = useSettingsStore((state) => state.settings);
  const loadSettings = useSettingsStore((state) => state.load);
  const { tasks, error, loadAll, updateTask } = useTaskStore();
  const [expanded, setExpanded] = useState(() => {
    const persisted = sessionStorage.getItem("blackhole-scene-expanded");
    if (persisted !== null) return persisted === "1";
    if (!("__TAURI_INTERNALS__" in window)) return new URLSearchParams(location.search).get("compact") !== "1";
    return false;
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingQuadrant, setAddingQuadrant] = useState<Quadrant | null>(null);
  const [query, setQuery] = useState("");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [taskDrag, setTaskDrag] = useState<TaskDragSession | null>(null);
  const down = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const taskDragRef = useRef<TaskDragSession | null>(null);
  const suppressEditUntil = useRef(0);

  useEffect(() => { void loadSettings(); void loadAll(); }, [loadAll, loadSettings]);
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const cleanups = [
      listen("scene:expanded-changed", (event) => {
        const next = Boolean(event.payload);
        sessionStorage.setItem("blackhole-scene-expanded", next ? "1" : "0");
        setExpanded(next);
      }),
      listen("scene:quick-add", () => {
        sessionStorage.setItem("blackhole-scene-expanded", "1");
        setExpanded(true);
        setAddingQuadrant("q1");
      }),
    ];
    return () => { cleanups.forEach((cleanup) => void cleanup.then((fn) => fn())); };
  }, []);

  const setSceneExpanded = async (next: boolean) => {
    sessionStorage.setItem("blackhole-scene-expanded", next ? "1" : "0");
    setExpanded(next);
    if (!next) { setEditingId(null); setAddingQuadrant(null); }
    // Let React commit the matching controls before the transparent native
    // window changes size; otherwise a fast Win32 probe (and real users on a
    // busy GPU) can briefly interact with the previous compact layout.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await backend.window("set_scene_expanded", { expanded: next });
  };

  const visibleTasks = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return tasks.filter((task) => task.status !== "archived" && (!normalized || `${task.title} ${task.description}`.toLocaleLowerCase().includes(normalized)));
  }, [query, tasks]);

  const startTaskDrag = (event: React.PointerEvent<HTMLElement>, task: Task) => {
    if (event.button !== 0 || (event.target as HTMLElement).closest("button,input,textarea")) return;
    const session: TaskDragSession = {
      task,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      active: false,
      target: null,
    };
    taskDragRef.current = session;
    setTaskDrag(session);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveTaskDrag = (event: React.PointerEvent<HTMLElement>) => {
    const session = taskDragRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);
    if (!session.active && distance < 6) return;
    event.preventDefault();
    const zone = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-quadrant]");
    const value = zone?.dataset.quadrant;
    const next: TaskDragSession = {
      ...session,
      x: event.clientX,
      y: event.clientY,
      active: true,
      target: isQuadrant(value) ? value : null,
    };
    taskDragRef.current = next;
    setTaskDrag(next);
  };

  const endTaskDrag = (event: React.PointerEvent<HTMLElement>) => {
    const session = taskDragRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const releaseDistance = Math.hypot(event.clientX - session.startX, event.clientY - session.startY);
    const releaseZone = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-quadrant]");
    const releaseValue = releaseZone?.dataset.quadrant;
    const releaseTarget = isQuadrant(releaseValue) ? releaseValue : null;
    const active = session.active || releaseDistance >= 6;
    const target = session.target ?? releaseTarget;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    taskDragRef.current = null;
    setTaskDrag(null);
    if (!active) return;
    suppressEditUntil.current = performance.now() + 300;
    if (target && target !== session.task.quadrant) {
      void updateTask(session.task.id, { quadrant: target });
    }
  };

  const editTask = (id: string | null) => {
    if (performance.now() < suppressEditUntil.current) return;
    setAddingQuadrant(null);
    setEditingId(id);
  };

  const startMove = (event: React.PointerEvent) => {
    const target = event.target as HTMLElement;
    const blockedControl = target.closest("input,textarea,select,.gravity-quadrant")
      || (target.closest("button") && !target.closest(".gravity-core-button"));
    if (event.button !== 0 || blockedControl) return;
    down.current = { x: event.screenX, y: event.screenY };
    dragged.current = false;
  };
  const moveWindow = async (event: React.PointerEvent) => {
    if (!down.current || Math.hypot(event.screenX - down.current.x, event.screenY - down.current.y) <= 5) return;
    down.current = null;
    dragged.current = true;
    if ("__TAURI_INTERNALS__" in window) {
      const current = getCurrentWindow();
      await current.startDragging();
      const position = await current.outerPosition();
      await backend.window("save_orb_position", { x: position.x, y: position.y });
    }
  };

  return (
    <main
      className={`gravity-app ${expanded ? "is-expanded" : "is-collapsed"}`}
      aria-label="黑洞四象限任务空间"
      onPointerDown={startMove}
      onPointerMove={(event) => void moveWindow(event)}
      onPointerUp={() => { down.current = null; }}
      onPointerCancel={() => { down.current = null; }}
    >
      <BlackHoleCanvas
        expanded={expanded}
        quality={settings.renderQuality}
        lowPowerMode={settings.lowPowerMode}
        tasks={visibleTasks.map(({ id, title, quadrant, status }) => ({ id, title, quadrant, status }))}
        editingTaskId={editingId}
        onError={setRenderError}
      />

      {renderError && <div className="gravity-render-error" role="alert"><strong>无法启动 WebGL2 黑洞</strong><span>{renderError}</span></div>}

      {!expanded && !renderError && (
        <button
          type="button"
          className="gravity-core-button"
          aria-label="展开黑洞四象限任务空间"
          onClick={() => { if (!dragged.current) void setSceneExpanded(true); dragged.current = false; }}
        ><span>进入任务引力场</span></button>
      )}

      {expanded && !renderError && (
        <>
          <div className="gravity-axis gravity-axis-x" aria-hidden="true"/>
          <div className="gravity-axis gravity-axis-y" aria-hidden="true"/>
          <header className="gravity-toolbar">
            <label><span aria-hidden="true">$</span><input aria-label="搜索任务" placeholder="filter tasks" value={query} onChange={(event) => setQuery(event.target.value)}/></label>
            <span className="gravity-count">{String(visibleTasks.length).padStart(2, "0")}</span>
            <button type="button" onClick={() => void setSceneExpanded(false)}>close</button>
          </header>
          <div className="gravity-quadrants">
            {QUADRANTS.map((quadrant) => (
              <QuadrantZone
                key={quadrant}
                quadrant={quadrant}
                tasks={visibleTasks.filter((task) => task.quadrant === quadrant)}
                adding={addingQuadrant === quadrant}
                editingId={editingId}
                onAdd={() => { setEditingId(null); setAddingQuadrant(quadrant); }}
                onAddDone={() => setAddingQuadrant(null)}
                onEdit={editTask}
                dropTarget={Boolean(taskDrag?.active && taskDrag.target === quadrant)}
                draggingId={taskDrag?.active ? taskDrag.task.id : null}
                onTaskPointerDown={startTaskDrag}
                onTaskPointerMove={moveTaskDrag}
                onTaskPointerEnd={endTaskDrag}
              />
            ))}
          </div>
          {taskDrag?.active && (
            <div
              className="gravity-drag-ghost"
              data-testid="task-drag-preview"
              style={{ left: taskDrag.x, top: taskDrag.y }}
            ><span>›</span>{taskDrag.task.title}</div>
          )}
          <div className="gravity-center-control" aria-hidden="true">
            <span>BLACKHOLE</span><small>drag task → quadrant</small>
          </div>
          {error && <div className="gravity-data-error" role="alert">{error}</div>}
        </>
      )}
    </main>
  );
}
