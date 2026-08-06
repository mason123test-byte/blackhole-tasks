import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { BlackHoleCanvas } from "../components/orb/BlackHoleCanvas";
import { backend } from "../services/backend";
import { AppEvents } from "../types/events";
import { useSettingsStore } from "../stores/settingsStore";

export function OrbApp() {
 const settings=useSettingsStore((s)=>s.settings); const loadSettings=useSettingsStore((s)=>s.load); const [hovered,setHovered]=useState(false); const [pulse,setPulse]=useState(0); const down=useRef<{x:number;y:number}|null>(null); const hoverTimer=useRef<number|undefined>(undefined);
 useEffect(()=>{void loadSettings();if(!("__TAURI_INTERNALS__" in window))return;let pulseTimer:number|undefined;const cleanup=listen(AppEvents.RENDER_PULSE,()=>{setPulse(1);window.clearTimeout(pulseTimer);pulseTimer=window.setTimeout(()=>setPulse(0),420)});return()=>{window.clearTimeout(pulseTimer);void cleanup.then((fn)=>fn())}},[loadSettings]);
 useEffect(()=>()=>window.clearTimeout(hoverTimer.current),[]);
 const enter=()=>{setHovered(true);window.clearTimeout(hoverTimer.current);hoverTimer.current=window.setTimeout(()=>void backend.window("set_orb_hovered",{hovered:true}),settings.hoverOpenDelayMs)};
 const leave=()=>{setHovered(false);window.clearTimeout(hoverTimer.current);void backend.window("set_orb_hovered",{hovered:false})};
 const pointerDown=(e:React.PointerEvent)=>{if(e.button!==0)return;down.current={x:e.screenX,y:e.screenY}};
 const pointerMove=async(e:React.PointerEvent)=>{if(!down.current)return;if(Math.hypot(e.screenX-down.current.x,e.screenY-down.current.y)>5){down.current=null;if("__TAURI_INTERNALS__" in window)await getCurrentWindow().startDragging();}};
 const click=()=>{if(down.current){down.current=null;void backend.window("toggle_workspace")}};
 return <main className="orb-app" title="黑洞任务：单击打开任务空间，双击快速新增" onPointerEnter={enter} onPointerLeave={leave} onPointerDown={pointerDown} onPointerMove={(e)=>void pointerMove(e)} onPointerUp={click} onPointerCancel={()=>{down.current=null}} onDoubleClick={()=>void backend.window("open_quick_add")} onContextMenu={(e)=>{e.preventDefault();void backend.window("show_orb_menu")}}><BlackHoleCanvas hovered={hovered} pulse={pulse} quality={settings.renderQuality} lowPowerMode={settings.lowPowerMode}/></main>;
}
