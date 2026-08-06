import { useCallback, useEffect, useMemo, useRef } from "react";
import { Background, BackgroundVariant, Controls, MarkerType, MiniMap, ReactFlow, ViewportPortal, useNodesState, type Connection, type Edge, type Node, type ReactFlowInstance } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTaskStore } from "../../stores/taskStore";
import { taskMatches, type TaskFilters } from "../../utils/filter";
import { hiddenByCollapsedParents } from "../../utils/graph";
import { pointToQuadrant } from "../../utils/quadrant";
import { QuadrantBackground } from "./QuadrantBackground";
import { TaskNode } from "./TaskNode";

const nodeTypes = { task: TaskNode };
const edgeLabel = { parent_child: "父子", dependency: "依赖", reference: "关联" } as const;

export function TaskCanvas({ filters, onEdit }: { filters: TaskFilters; onEdit(id: string): void }) {
  const { tasks, relations, selectedTaskIds, moveTasks, completeTask, updateTask, createRelation, deleteRelation, selectTasks } = useTaskStore();
  const collapseTask = useCallback((id: string, value: boolean) => { void updateTask(id, { collapsed: value }); }, [updateTask]);
  const hidden = useMemo(() => hiddenByCollapsedParents(tasks, relations), [tasks, relations]);
  const visibleTasks = useMemo(() => tasks.filter((task) => !hidden.has(task.id) && taskMatches(task, filters)), [tasks, hidden, filters]);
  const visibleIds = useMemo(() => new Set(visibleTasks.map((task) => task.id)), [visibleTasks]);
  const visibleIdSignature = useMemo(() => visibleTasks.map((task) => task.id).join("\u0000"), [visibleTasks]);
  const flowRef = useRef<ReactFlowInstance<Node> | null>(null);
  const selectedIds = useMemo(() => new Set(selectedTaskIds), [selectedTaskIds]);
  const derivedNodes: Node[] = useMemo(() => visibleTasks.map((task) => ({
    id: task.id, type: "task", position: { x: task.canvasX, y: task.canvasY }, selected: selectedIds.has(task.id),
    style: { width: task.width }, data: { task, complete: completeTask, edit: onEdit, collapse: collapseTask },
  })), [visibleTasks, selectedIds, completeTask, onEdit, collapseTask]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(derivedNodes);
  useEffect(() => setNodes(derivedNodes), [derivedNodes, setNodes]);
  useEffect(() => {
    const visibleTaskIds = visibleIdSignature ? visibleIdSignature.split("\u0000") : [];
    const frame = requestAnimationFrame(() => {
      const instance = flowRef.current;
      if (!instance) return;
      if (visibleTaskIds.length === 0) {
        void instance.setCenter(0, 0, { zoom: 1, duration: 120 });
      } else {
        void instance.fitView({ nodes: visibleTaskIds.map((id) => ({ id })), padding: 0.22, maxZoom: 1.2, duration: 140 });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [visibleIdSignature]);
  const visibleRelations = useMemo(() => relations.filter((relation) => visibleIds.has(relation.sourceTaskId) && visibleIds.has(relation.targetTaskId)), [relations, visibleIds]);
  const denseGraph = tasks.length > 120 || relations.length > 200;
  const renderedRelations = useMemo(() => {
    if (!denseGraph || visibleRelations.length <= 160) return visibleRelations;
    const connected = visibleRelations.filter((relation) => selectedIds.has(relation.sourceTaskId) || selectedIds.has(relation.targetTaskId));
    const connectedIds = new Set(connected.map((relation) => relation.id));
    return [...connected, ...visibleRelations.filter((relation) => !connectedIds.has(relation.id))].slice(0, 160);
  }, [denseGraph, selectedIds, visibleRelations]);
  const edges: Edge[] = useMemo(() => renderedRelations.map((relation) => ({
    id: relation.id, source: relation.sourceTaskId, target: relation.targetTaskId, label: relation.label ?? edgeLabel[relation.relationType],
    type: "smoothstep", animated: !denseGraph && relation.relationType === "dependency", markerEnd: relation.relationType === "dependency" ? { type: MarkerType.ArrowClosed } : undefined,
    style: { strokeDasharray: relation.relationType === "reference" ? "7 5" : undefined, strokeWidth: 2 },
  })), [renderedRelations, denseGraph]);
  const connect = async (connection: Connection) => { if (connection.source && connection.target) await createRelation(connection.source, connection.target, "dependency"); };
  return <div className="canvas-shell"><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView snapToGrid snapGrid={[10,10]} minZoom={.18} maxZoom={2.2} onlyRenderVisibleElements={denseGraph}
    selectionOnDrag multiSelectionKeyCode="Control" deleteKeyCode={null} onConnect={connect}
    onNodesChange={onNodesChange}
    onSelectionChange={({nodes: selected}) => selectTasks(selected.map((node) => node.id))}
    onInit={(instance) => { flowRef.current = instance; if (visibleTasks.length === 0) void instance.setCenter(0, 0, { zoom: 1, duration: 0 }); }}
    onNodeDragStop={(_, node) => moveTasks([{ id: node.id, canvasX: node.position.x, canvasY: node.position.y, quadrant: pointToQuadrant(node.position.x+120,node.position.y+48) }])}
    onEdgesDelete={(deleted) => Promise.all(deleted.map((edge) => deleteRelation(edge.id)))}>
      <ViewportPortal><QuadrantBackground/></ViewportPortal><Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(143,178,207,.13)"/><Controls/><MiniMap pannable zoomable nodeColor="#d87835"/></ReactFlow></div>;
}
