import { useEffect, useRef } from "react";
import { startBlackHole } from "../../shader/blackHoleRenderer";
import type { SceneTextureState, SceneTextureTask } from "../../shader/sceneTexture";
import type { RenderQuality } from "../../types/settings";

interface BlackHoleCanvasProps {
  hovered: boolean;
  expanded: boolean;
  pulse: number;
  quality: RenderQuality;
  lowPowerMode: boolean;
  tasks: SceneTextureTask[];
  editingTaskId: string | null;
  onError?(message: string): void;
}

export function BlackHoleCanvas({
  hovered,
  expanded,
  pulse,
  quality,
  lowPowerMode,
  tasks,
  editingTaskId,
  onError,
}: BlackHoleCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef(hovered ? 1 : 0);
  const expandedRef = useRef(expanded ? 1 : 0);
  const pulseRef = useRef(pulse);
  const sceneRef = useRef<SceneTextureState>({ expanded, editingTaskId, tasks });

  useEffect(() => {
    hoverRef.current = hovered ? 1 : 0;
    expandedRef.current = expanded ? 1 : 0;
    pulseRef.current = pulse;
    sceneRef.current = { expanded, editingTaskId, tasks };
  }, [editingTaskId, expanded, hovered, pulse, tasks]);

  useEffect(() => {
    if (!ref.current) return;
    return startBlackHole(
      ref.current,
      () => hoverRef.current,
      () => pulseRef.current,
      () => expandedRef.current,
      () => sceneRef.current,
      { quality, lowPowerMode, onError },
    );
  }, [lowPowerMode, onError, quality]);

  return <canvas ref={ref} className="black-hole-canvas" aria-label="黑洞任务悬浮窗" />;
}
