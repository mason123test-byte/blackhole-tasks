import { useEffect, useRef, type RefObject } from "react";
import { startBlackHole } from "../../shader/blackHoleRenderer";
import type { RenderQuality } from "../../types/settings";

export function BlackHoleCanvas({ hovered, expanded, pulse, quality, lowPowerMode, sceneTextureRef, onError }: { hovered: boolean; expanded: boolean; pulse: number; quality: RenderQuality; lowPowerMode: boolean; sceneTextureRef?: RefObject<HTMLCanvasElement | null>; onError?(message: string): void }) {
  const ref = useRef<HTMLCanvasElement>(null); const hoverRef=useRef(0); const expandedRef=useRef(0); const pulseRef=useRef(0);
  useEffect(() => { hoverRef.current = hovered ? 1 : 0; expandedRef.current = expanded ? 1 : 0; pulseRef.current = pulse; }, [expanded, hovered, pulse]);
  useEffect(() => { if (!ref.current) return; return startBlackHole(ref.current, () => hoverRef.current, () => pulseRef.current, () => expandedRef.current, () => sceneTextureRef?.current ?? null, { quality, lowPowerMode, onError }); }, [lowPowerMode, onError, quality, sceneTextureRef]);
  return <canvas ref={ref} className="black-hole-canvas" aria-label="黑洞任务悬浮窗" />;
}
