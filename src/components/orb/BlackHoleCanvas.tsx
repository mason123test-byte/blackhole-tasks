import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  normalizeVisualComparisonMode,
  startBlackHole,
  type VisualComparisonMode,
} from "../../shader/blackHoleRenderer";
import {
  DEFAULT_VISUAL_EXPERIMENT,
  parseVisualExperimentConfig,
  type NormalizedVisualExperiment,
} from "../../shader/visualExperiment";
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
  const nativeRuntime = "__TAURI_INTERNALS__" in window;
  const [visualComparisonMode, setVisualComparisonMode] = useState<VisualComparisonMode | null>(
    nativeRuntime ? null : "normal",
  );
  const [visualExperiment, setVisualExperiment] = useState<NormalizedVisualExperiment | null>(
    nativeRuntime ? null : DEFAULT_VISUAL_EXPERIMENT,
  );

  useEffect(() => {
    if (!nativeRuntime) return;
    let active = true;
    void Promise.all([
      invoke<string>("get_visual_comparison_mode"),
      invoke<string>("get_visual_experiment_config"),
    ])
      .then(async ([rawMode, rawExperiment]) => {
        const mode = normalizeVisualComparisonMode(rawMode);
        const experiment = parseVisualExperimentConfig(rawExperiment);
        if (mode !== "normal") {
          await invoke("set_scene_expanded", { expanded: true });
        }
        if (active) {
          setVisualComparisonMode(mode);
          setVisualExperiment(experiment);
        }
      })
      .catch((error) => {
        console.error("无法读取视觉诊断配置：", error);
        if (active) {
          setVisualComparisonMode("normal");
          setVisualExperiment(DEFAULT_VISUAL_EXPERIMENT);
        }
      });
    return () => { active = false; };
  }, [nativeRuntime]);

  useEffect(() => {
    expandedRef.current = expanded ? 1 : 0;
    sceneRef.current = { expanded, editingTaskId, tasks };
  }, [editingTaskId, expanded, tasks]);

  useEffect(() => {
    if (!ref.current || visualComparisonMode === null || visualExperiment === null) return;
    if (visualComparisonMode !== "normal" && !expanded) return;

    const stopRenderer = startBlackHole(
      ref.current,
      () => expandedRef.current,
      () => sceneRef.current,
      { quality, lowPowerMode, visualComparisonMode, visualExperiment, onError },
    );
    return stopRenderer;
  }, [expanded, lowPowerMode, onError, quality, visualComparisonMode, visualExperiment]);

  return <canvas ref={ref} className="black-hole-canvas" aria-label="黑洞任务悬浮窗" />;
}
