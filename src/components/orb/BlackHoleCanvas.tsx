import { useEffect, useRef } from "react";
import { startBlackHole } from "../../shader/blackHoleRenderer";
import type { RenderQuality } from "../../types/settings";

export function BlackHoleCanvas({ hovered, pulse, quality, lowPowerMode }: { hovered: boolean; pulse: number; quality: RenderQuality; lowPowerMode: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null); const hoverRef=useRef(0); const pulseRef=useRef(0);
  useEffect(() => { hoverRef.current = hovered ? 1 : 0; pulseRef.current = pulse; }, [hovered, pulse]);
  useEffect(() => { if (!ref.current) return; return startBlackHole(ref.current, () => hoverRef.current, () => pulseRef.current, { quality, lowPowerMode }); }, [lowPowerMode, quality]);
  return <canvas ref={ref} className="black-hole-canvas" aria-label="黑洞任务悬浮球" />;
}
