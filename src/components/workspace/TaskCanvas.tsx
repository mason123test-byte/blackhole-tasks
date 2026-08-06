import { useMemo } from "react";
import { Background, BackgroundVariant, Controls, MarkerType, MiniMap, ReactFlow, type Connection, type Edge, type Node } from "@xyflow/react";
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
  const hidden = useMemo(() => hiddenByCollapsedParents(tasks, relations), [tasks, relations]);
  const visibleTasks = useMemo(() => tasks.filter((task) => !hidden.has(task.id) && taskMatches(task, filters)), [tasks, hidden, filters]);
  const visibleIds = useMemo(() => new Set(visibleTasks.map((task) => task.id)), [visibleTasks]);
  const nodes: Node[] = useMemo(() => visibleTasks.map((task) => ({
    id: task.id, type: "task", position: { x: task.canvasX, y: task.canvasY }, selected: selectedTaskIds.includes(task.id),
    style: { width: task.width }, data: { task, complete: completeTask, edit: onEdit, collapse: (id:string,value:boolean)=>updateTask(id,{collapsed:value}) },
  })), [visibleTasks, selectedTaskIds, completeTask, onEdit, updateTask]);
  const edges: Edge[] = useMemo(() => relations.filter((r) => visibleIds.has(r.sourceTaskId) && visibleIds.has(r.targetTaskId)).map((relation) => ({
    id: relation.id, source: relation.sourceTaskId, target: relation.targetTaskId, label: relation.label ?? edgeLabel[relation.relationType],
    type: "smoothstep", animated: relation.relationType === "dependency", markerEnd: relation.relationType === "dependency" ? { type: MarkerType.ArrowClosed } : undefined,
    style: { strokeDasharray: relation.relationType === "reference" ? "7 5" : undefined, strokeWidth: 2 },
  })), [relations, visibleIds]);
  const connect = async (connection: Connection) => { if (connection.source && connection.target) await createRelation(connection.source, connection.target, "dependency"); };
  return <div className="canvas-shell"><QuadrantBackground/><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView snapToGrid snapGrid={[10,10]} minZoom={.18} maxZoom={2.2}
    selectionOnDrag multiSelectionKeyCode="Control" deleteKeyCode={null} onConnect={connect}
    onNodesChange={(changes) => selectTasks(changes.flatMap((item) => item.type === "select" && item.selected ? [item.id] : []))}
    onNodeDragStop={(_, node) => moveTasks([{ id: node.id, canvasX: node.position.x, canvasY: node.position.y, quadrant: pointToQuadrant(node.position.x+120,node.position.y+48) }])}
    onEdgesDelete={(deleted) => Promise.all(deleted.map((edge) => deleteRelation(edge.id)))}>
      <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="rgba(143,178,207,.13)"/><Controls/><MiniMap pannable zoomable nodeColor="#d87835"/></ReactFlow></div>;
}
