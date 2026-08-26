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

    void invoke<string>("get_visual_comparison_mode")
      .then(async (rawMode) => {
        const mode = normalizeVisualComparisonMode(rawMode);
        if (mode !== "normal") {
          await invoke("set_scene_expanded", { expanded: true });
        }
        if (active) setVisualComparisonMode(mode);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("无法读取视觉比较配置：", error);
        onError?.(`视觉比较配置读取失败：${message}`);
        if (active) setVisualComparisonMode(null);
      });

    void invoke<string>("get_visual_experiment_config")
      .then((rawExperiment) => {
        const experiment = parseVisualExperimentConfig(rawExperiment);
        if (active) setVisualExperiment(experiment);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error("无法读取视觉实验配置：", error);
        onError?.(`视觉实验配置无效：${message}`);
        if (active) setVisualExperiment(null);
      });

    return () => { active = false; };
  }, [nativeRuntime, onError]);

  useEffect(() => {
    expandedRef.current = expanded ? 1 : 0;
    sceneRef.current = { expanded, editingTaskId, tasks };
  }, [editingTaskId, expanded, tasks]);

  useEffect(() => {
    if (!ref.current || visualComparisonMode === null || visualExperiment === null) return;
    if (visualComparisonMode !== "normal" && !expanded) return;

    const canvas = ref.current;
    const stopRenderer = startBlackHole(
      canvas,
      () => expandedRef.current,
      () => sceneRef.current,
      {
        quality,
        lowPowerMode,
        visualComparisonMode,
        visualExperiment,
        onError: (message) => {
          if ("__TAURI_INTERNALS__" in window && canvas.dataset.renderer === "shader-error") {
            const diagnostic = `shader-error:${message.replace(/\s+/g, " ").trim()}`;
            const width = canvas.width;
            const height = canvas.height;
            document.title = `黑洞任务|renderer=webgl2|frame=ready|energy=0|size=${width}x${height}|diag=${diagnostic}`;
            void invoke("report_orb_render", {
              renderer: "webgl2",
              energy: 0,
              width,
              height,
              diagnostic,
            }).catch((error) => {
              console.error("无法上报黑洞 Shader 错误：", error);
            });
          }
          onError?.(message);
        },
      },
    );

    return stopRenderer;
  }, [expanded, lowPowerMode, onError, quality, visualComparisonMode, visualExperiment]);

  return <canvas ref={ref} className="black-hole-canvas" aria-label="黑洞任务悬浮窗" />;
}
