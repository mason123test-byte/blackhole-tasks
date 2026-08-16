import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  normalizeVisualComparisonMode,
  startBlackHole,
  type VisualComparisonMode,
} from "../../shader/blackHoleRenderer";
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
  const [visualComparisonMode, setVisualComparisonMode] = useState<VisualComparisonMode | null>(
    "__TAURI_INTERNALS__" in window ? null : "normal",
  );

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    let active = true;
    void invoke<string>("get_visual_comparison_mode")
      .then(async (rawMode) => {
        const mode = normalizeVisualComparisonMode(rawMode);
        if (mode !== "normal") {
          await invoke("set_scene_expanded", { expanded: true });
        }
        if (active) setVisualComparisonMode(mode);
      })
      .catch((error) => {
        console.error("无法读取视觉对比模式：", error);
        if (active) setVisualComparisonMode("normal");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    expandedRef.current = expanded ? 1 : 0;
    sceneRef.current = { expanded, editingTaskId, tasks };
  }, [editingTaskId, expanded, tasks]);

  useEffect(() => {
    if (!ref.current || visualComparisonMode === null) return;
    if (visualComparisonMode !== "normal" && !expanded) return;

    const stopRenderer = startBlackHole(
      ref.current,
      () => expandedRef.current,
      () => sceneRef.current,
      { quality, lowPowerMode, visualComparisonMode, onError },
    );
    return stopRenderer;
  }, [expanded, lowPowerMode, onError, quality, visualComparisonMode]);

  return <canvas ref={ref} className="black-hole-canvas" aria-label="黑洞任务悬浮窗" />;
}
