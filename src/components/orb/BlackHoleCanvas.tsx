import { useEffect, useRef } from "react";
import { startBlackHole } from "../../shader/blackHoleRenderer";

export function BlackHoleCanvas({ hovered, pulse }: { hovered: boolean; pulse: number }) {
  const ref = useRef<HTMLCanvasElement>(null); const hoverRef=useRef(0); const pulseRef=useRef(0);
  useEffect(() => { hoverRef.current = hovered ? 1 : 0; pulseRef.current = pulse; }, [hovered, pulse]);
  useEffect(() => { if (!ref.current) return; return startBlackHole(ref.current, () => hoverRef.current, () => pulseRef.current); }, []);
  return <canvas ref={ref} className="black-hole-canvas" aria-label="黑洞任务悬浮球" />;
}
