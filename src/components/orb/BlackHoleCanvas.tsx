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
        const message = error instanceof Error ? error.message : String(error);
        console.error("无法读取视觉诊断配置：", error);
        onError?.(`视觉实验配置无效：${message}`);
        if (active) {
          setVisualComparisonMode(null);
          setVisualExperiment(null);
        }
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

    let receiptFrame = 0;
    const reportEffectiveExperiment = () => {
      const energy = Number(canvas.dataset.energy ?? "0");
      if (canvas.dataset.renderer !== "webgl2" || !Number.isFinite(energy) || energy <= 100) {
        receiptFrame = window.requestAnimationFrame(reportEffectiveExperiment);
        return;
      }
      const receipt = [
        `effectiveExperimentId=${encodeURIComponent(visualExperiment.experimentId)}`,
        `effectiveEnabled=${visualExperiment.enabled ? 1 : 0}`,
        `effectiveFilmDiskExposure=${visualExperiment.filmDiskExposure.toFixed(6)}`,
        `effectiveDiskOuter=${visualExperiment.diskOuter.toFixed(6)}`,
      ].join(";");
      const diagnostic = `${canvas.dataset.diagnostic ?? ""};${receipt}`.replace(/^;/, "");
      void invoke("report_orb_render", {
        renderer: "webgl2",
        energy: Math.round(energy),
        width: canvas.width,
        height: canvas.height,
        diagnostic,
      }).catch((error) => {
        console.error("无法上报视觉实验实际生效值：", error);
      });
    };
    receiptFrame = window.requestAnimationFrame(reportEffectiveExperiment);

    return () => {
      window.cancelAnimationFrame(receiptFrame);
      stopRenderer();
    };
  }, [expanded, lowPowerMode, onError, quality, visualComparisonMode, visualExperiment]);

  return <canvas ref={ref} className="black-hole-canvas" aria-label="黑洞任务悬浮窗" />;
}
