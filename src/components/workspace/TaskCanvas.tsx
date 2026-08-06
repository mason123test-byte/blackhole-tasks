import { useCallback, useDeferredValue, useEffect, useMemo, useRef } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ViewportPortal,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTaskStore } from "../../stores/taskStore";
import { taskMatches, type TaskFilters } from "../../utils/filter";
import { hiddenByCollapsedParents } from "../../utils/graph";
import { pointToQuadrant, quadrantLabels } from "../../utils/quadrant";
import { QuadrantBackground } from "./QuadrantBackground";
import { TaskNode } from "./TaskNode";

const nodeTypes = { task: TaskNode };
const edgeLabel = { parent_child: "父子", dependency: "依赖", reference: "关联" } as const;

interface TaskCanvasProps {
  filters: TaskFilters;
  fitRequest: number;
  onAdd(): void;
  onEdit(id: string): void;
}

export function TaskCanvas({ filters, fitRequest, onAdd, onEdit }: TaskCanvasProps) {
  const { tasks, relations, selectedTaskIds, moveTasks, completeTask, updateTask, createRelation, deleteRelation, selectTasks } = useTaskStore();
  const deferredFilters = useDeferredValue(filters);
  const collapseTask = useCallback((id: string, value: boolean) => { void updateTask(id, { collapsed: value }); }, [updateTask]);
  const hidden = useMemo(() => hiddenByCollapsedParents(tasks, relations), [tasks, relations]);
  const visibleTasks = useMemo(() => tasks.filter((task) => !hidden.has(task.id) && taskMatches(task, deferredFilters)), [tasks, hidden, deferredFilters]);
  const visibleIds = useMemo(() => new Set(visibleTasks.map((task) => task.id)), [visibleTasks]);
  const visibleIdSignature = useMemo(() => visibleTasks.map((task) => task.id).join("\u0000"), [visibleTasks]);
  const flowRef = useRef<ReactFlowInstance<Node> | null>(null);
  const selectedIds = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds]);
  const childCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const relation of relations) {
      if (relation.relationType === "parent_child") counts.set(relation.sourceTaskId, (counts.get(relation.sourceTaskId) ?? 0) + 1);
    }
    return counts;
  }, [relations]);
  const derivedNodes: Node[] = useMemo(() => visibleTasks.map((task) => ({
    id: task.id,
    type: "task",
    position: { x: task.canvasX, y: task.canvasY },
    selected: selectedIds.has(task.id),
    style: { width: task.width },
    data: { task, childCount: childCounts.get(task.id) ?? 0, complete: completeTask, edit: onEdit, collapse: collapseTask },
  })), [visibleTasks, selectedIds, childCounts, completeTask, onEdit, collapseTask]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(derivedNodes);
  useEffect(() => setNodes(derivedNodes), [derivedNodes, setNodes]);
  useEffect(() => {
    const visibleTaskIds = visibleIdSignature ? visibleIdSignature.split("\u0000") : [];
    const frame = requestAnimationFrame(() => {
      const instance = flowRef.current;
      if (!instance) return;
      if (visibleTaskIds.length === 0) void instance.setCenter(0, 0, { zoom: 1, duration: 120 });
      else void instance.fitView({ nodes: visibleTaskIds.map((id) => ({ id })), padding: 0.22, maxZoom: 1.2, duration: 140 });
    });
    return () => cancelAnimationFrame(frame);
  }, [visibleIdSignature]);
  useEffect(() => {
    if (fitRequest === 0) return;
    const instance = flowRef.current;
    if (!instance) return;
    if (visibleTasks.length === 0) void instance.setCenter(0, 0, { zoom: 1, duration: 180 });
    else void instance.fitView({ padding: 0.22, maxZoom: 1.2, duration: 220 });
  }, [fitRequest, visibleTasks.length]);

  const visibleRelations = useMemo(() => relations.filter((relation) => visibleIds.has(relation.sourceTaskId) && visibleIds.has(relation.targetTaskId)), [relations, visibleIds]);
  const denseGraph = tasks.length > 120 || relations.length > 200;
  const renderedRelations = useMemo(() => {
    if (!denseGraph || visibleRelations.length <= 160) return visibleRelations;
    const connected = visibleRelations.filter((relation) => selectedIds.has(relation.sourceTaskId) || selectedIds.has(relation.targetTaskId));
    const connectedIds = new Set(connected.map((relation) => relation.id));
    return [...connected, ...visibleRelations.filter((relation) => !connectedIds.has(relation.id))].slice(0, 160);
  }, [denseGraph, selectedIds, visibleRelations]);
  const edges: Edge[] = useMemo(() => renderedRelations.map((relation) => ({
    id: relation.id,
    source: relation.sourceTaskId,
    target: relation.targetTaskId,
    label: relation.label ?? edgeLabel[relation.relationType],
    type: "smoothstep",
    animated: !denseGraph && relation.relationType === "dependency",
    markerEnd: relation.relationType === "dependency" ? { type: MarkerType.ArrowClosed } : undefined,
    style: { strokeDasharray: relation.relationType === "reference" ? "7 5" : undefined, strokeWidth: 2 },
  })), [renderedRelations, denseGraph]);
  const connect = async (connection: Connection) => {
    if (connection.source && connection.target) await createRelation(connection.source, connection.target, "dependency");
  };

  return <div className={`canvas-shell ${denseGraph ? "dense" : ""}`}>
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      snapToGrid
      snapGrid={[10, 10]}
      minZoom={0.18}
      maxZoom={2.2}
      onlyRenderVisibleElements={denseGraph}
      selectionOnDrag
      multiSelectionKeyCode="Control"
      deleteKeyCode={null}
      onConnect={connect}
      onNodesChange={onNodesChange}
      onSelectionChange={({ nodes: selected }) => selectTasks(selected.map((node) => node.id))}
      onInit={(instance) => { flowRef.current = instance; if (visibleTasks.length === 0) void instance.setCenter(0, 0, { zoom: 1, duration: 0 }); }}
      onNodeDragStop={(_, node) => moveTasks([{ id: node.id, canvasX: node.position.x, canvasY: node.position.y, quadrant: pointToQuadrant(node.position.x + 120, node.position.y + 48) }])}
      onEdgesDelete={(deleted) => Promise.all(deleted.map((edge) => deleteRelation(edge.id)))}
    >
      <ViewportPortal><QuadrantBackground/></ViewportPortal>
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(143,178,207,.11)"/>
      <Controls/>
      {!denseGraph && <MiniMap pannable zoomable nodeColor="#d87835"/>}
    </ReactFlow>
    <div className="quadrant-overlay" aria-hidden="true">
      <span className="overlay-q1"><b>Q1</b>{quadrantLabels.q1}</span>
      <span className="overlay-q2"><b>Q2</b>{quadrantLabels.q2}</span>
      <span className="overlay-q3"><b>Q3</b>{quadrantLabels.q3}</span>
      <span className="overlay-q4"><b>Q4</b>{quadrantLabels.q4}</span>
    </div>
    {visibleTasks.length === 0 && <section className="canvas-empty">
      <div className="empty-orbit" aria-hidden="true"/>
      <p>{tasks.length === 0 ? "把第一件事放进四象限" : "没有符合当前筛选的任务"}</p>
      {tasks.length === 0 && <button className="primary" onClick={onAdd}>＋ 新增任务</button>}
    </section>}
    {denseGraph && <div className="performance-badge">性能模式 · 已隐藏小地图与边动画</div>}
  </div>;
}
