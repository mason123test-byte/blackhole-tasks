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

function reportVisualBootStage(stage: string) {
  document.title = `黑洞任务|renderer=diagnostic|frame=boot|energy=0|size=0x0|diag=${stage}`;
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
    reportVisualBootStage("visual-config-start");
    const comparisonRequest = invoke<string>("get_visual_comparison_mode").then((rawMode) => {
      reportVisualBootStage("comparison-config-ok");
      return rawMode;
    });
    const experimentRequest = invoke<string>("get_visual_experiment_config").then((rawExperiment) => {
      reportVisualBootStage("experiment-config-ok");
      return rawExperiment;
    });
    void Promise.all([comparisonRequest, experimentRequest])
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
        reportVisualBootStage("visual-config-error");
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

    let stopRenderer: () => void = () => undefined;
    let cancelled = false;
    if ("__TAURI_INTERNALS__" in window) reportVisualBootStage("renderer-start-yield");
    const startTimer = window.setTimeout(() => {
      if (cancelled || !ref.current) return;
      stopRenderer = startBlackHole(
        ref.current,
        () => expandedRef.current,
        () => sceneRef.current,
        { quality, lowPowerMode, visualComparisonMode, visualExperiment, onError },
      );
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(startTimer);
      stopRenderer();
    };
  }, [expanded, lowPowerMode, onError, quality, visualComparisonMode, visualExperiment]);

  return <canvas ref={ref} className="black-hole-canvas" aria-label="黑洞任务悬浮窗" />;
}
