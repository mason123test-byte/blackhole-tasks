import { useEffect, useRef } from "react";
import { startBlackHole } from "../../shader/blackHoleRenderer";
import type { SceneTextureState, SceneTextureTask } from "../../shader/sceneTexture";
import type { RenderQuality } from "../../types/settings";

interface BlackHoleCanvasProps {
  expanded: boolean;
  quality: RenderQuality;
  lowPowerMode: boolean;
  tasks: SceneTextureTask[];
  editingTaskId: string | null;
  onError?(message: string): void;
}

export function BlackHoleCanvas({
  expanded,
  quality,
  lowPowerMode,
  tasks,
  editingTaskId,
  onError,
}: BlackHoleCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const expandedRef = useRef(expanded ? 1 : 0);
  const sceneRef = useRef<SceneTextureState>({ expanded, editingTaskId, tasks });

  useEffect(() => {
    expandedRef.current = expanded ? 1 : 0;
    sceneRef.current = { expanded, editingTaskId, tasks };
  }, [editingTaskId, expanded, tasks]);

  useEffect(() => {
    if (!ref.current) return;
    return startBlackHole(
      ref.current,
      () => expandedRef.current,
      () => sceneRef.current,
      { quality, lowPowerMode, onError },
    );
  }, [lowPowerMode, onError, quality]);

  return <canvas ref={ref} className="black-hole-canvas" aria-label="黑洞任务悬浮窗" />;
}
