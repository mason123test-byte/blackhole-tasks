import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { BlackHoleCanvas } from "../components/orb/BlackHoleCanvas";
import { GravitySceneTexture } from "../components/orb/GravitySceneTexture";
import { useSettingsStore } from "../stores/settingsStore";
import { useTaskStore } from "../stores/taskStore";
import { backend } from "../services/backend";
import type { Quadrant, Task, TaskPriority, TaskStatus } from "../types/task";
import { quadrantLabels } from "../utils/quadrant";

const QUADRANTS: Quadrant[] = ["q1", "q2", "q3", "q4"];
const statusLabels: Record<TaskStatus, string> = {
  todo: "待办",
  doing: "进行中",
  blocked: "阻塞",
  done: "完成",
  archived: "归档",
};

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
        placeholder="补充描述…"
        rows={2}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        onBlur={saveText}
      />
      <div className="gravity-fields">
        <select aria-label="任务状态" value={task.status} onChange={(event) => void updateTask(task.id, { status: event.target.value as TaskStatus })}>
          {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select aria-label="任务象限" value={task.quadrant} onChange={(event) => void updateTask(task.id, { quadrant: event.target.value as Quadrant })}>
          {QUADRANTS.map((quadrant) => <option key={quadrant} value={quadrant}>{quadrant.toUpperCase()}</option>)}
        </select>
        <select aria-label="任务优先级" value={task.priority} onChange={(event) => void updateTask(task.id, { priority: Number(event.target.value) as TaskPriority })}>
          {[0, 1, 2, 3, 4].map((priority) => <option key={priority} value={priority}>P{priority}</option>)}
        </select>
      </div>
      <div className="gravity-editor-actions">
        <button type="button" onClick={onClose}>完成编辑</button>
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

function GravityTaskCard({ task, onEdit, onDragStart }: { task: Task; onEdit(): void; onDragStart(): void }) {
  const completeTask = useTaskStore((state) => state.completeTask);
  return (
    <article
      className={`gravity-card status-${task.status}`}
      draggable
      tabIndex={0}
      aria-label={`${task.title}，${statusLabels[task.status]}`}
      onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/task-id", task.id); onDragStart(); }}
      onDoubleClick={onEdit}
      onKeyDown={(event) => { if (event.key === "Enter") onEdit(); }}
    >
      <button
        type="button"
        className="gravity-check"
        aria-label={`完成 ${task.title}`}
        onClick={(event) => { event.stopPropagation(); void completeTask(task.id); }}
      >{task.status === "done" ? "✓" : ""}</button>
      <button type="button" className="gravity-card-body" onClick={onEdit}>
        <strong>{task.title}</strong>
        <span>{statusLabels[task.status]} · P{task.priority}{task.dueAt ? ` · ${task.dueAt.slice(5, 10)}` : ""}</span>
      </button>
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
  onDropTask,
}: {
  quadrant: Quadrant;
  tasks: Task[];
  adding: boolean;
  editingId: string | null;
  onAdd(): void;
  onAddDone(): void;
  onEdit(id: string | null): void;
  onDropTask(id: string): void;
}) {
  return (
    <section
      className={`gravity-quadrant gravity-${quadrant}`}
      aria-label={`${quadrant.toUpperCase()} ${quadrantLabels[quadrant]}`}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }}
      onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData("text/task-id"); if (id) onDropTask(id); }}
    >
      <header>
        <span><b>{quadrant.toUpperCase()}</b>{quadrantLabels[quadrant]}</span>
        <button type="button" aria-label={`在 ${quadrant.toUpperCase()} 新增任务`} onClick={onAdd}>＋</button>
      </header>
      <div className="gravity-task-list">
        {adding && <InlineAdd quadrant={quadrant} onDone={onAddDone}/>}
        {tasks.map((task) => editingId === task.id
          ? <InlineTaskEditor key={task.id} task={task} onClose={() => onEdit(null)}/>
          : <GravityTaskCard key={task.id} task={task} onEdit={() => onEdit(task.id)} onDragStart={() => undefined}/>) }
        {!adding && tasks.length === 0 && <button type="button" className="gravity-empty" onClick={onAdd}>在引力场中创建任务</button>}
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
  const [pulse, setPulse] = useState(0);
  const [renderError, setRenderError] = useState<string | null>(null);
  const down = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const sceneTextureRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { void loadSettings(); void loadAll(); }, [loadAll, loadSettings]);
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let pulseTimer: number | undefined;
    const cleanups = [
      listen("orb:render-pulse", () => { setPulse(1); window.clearTimeout(pulseTimer); pulseTimer = window.setTimeout(() => setPulse(0), 420); }),
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
    return () => { window.clearTimeout(pulseTimer); cleanups.forEach((cleanup) => void cleanup.then((fn) => fn())); };
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
        hovered={false}
        expanded={expanded}
        pulse={pulse}
        quality={settings.renderQuality}
        lowPowerMode={settings.lowPowerMode}
        sceneTextureRef={sceneTextureRef}
        onError={setRenderError}
      />
      <GravitySceneTexture ref={sceneTextureRef} expanded={expanded} tasks={visibleTasks.filter((task) => task.id !== editingId)}/>

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
            <label><span aria-hidden="true">⌕</span><input aria-label="搜索任务" placeholder="搜索引力场…" value={query} onChange={(event) => setQuery(event.target.value)}/></label>
            <span className="gravity-count">{visibleTasks.length} 个任务</span>
            <button type="button" onClick={() => void setSceneExpanded(false)}>收起</button>
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
                onEdit={(id) => { setAddingQuadrant(null); setEditingId(id); }}
                onDropTask={(id) => { const task = tasks.find((item) => item.id === id); if (task && task.quadrant !== quadrant) void updateTask(id, { quadrant }); }}
              />
            ))}
          </div>
          <button type="button" className="gravity-center-control" aria-label="黑洞中心，点击产生引力脉冲" onClick={() => { setPulse(1); window.setTimeout(() => setPulse(0), 420); }}>
            <span>BLACKHOLE</span><small>直接编辑 · 拖动换象限</small>
          </button>
          {error && <div className="gravity-data-error" role="alert">{error}</div>}
        </>
      )}
    </main>
  );
}
