import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { OrbApp } from "./app/OrbApp";
import { QuickAddApp } from "./app/QuickAddApp";
import { WorkspaceApp } from "./app/WorkspaceApp";
import "./styles/global.css";

function Root(){let label="workspace";try{if("__TAURI_INTERNALS__" in window)label=getCurrentWindow().label;else label=new URLSearchParams(location.search).get("window")??"workspace";}catch{label="workspace"}if(label==="orb")return <OrbApp/>;if(label==="quick-add")return <QuickAddApp/>;return <WorkspaceApp/>}
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><Root/></React.StrictMode>);

