import React from "react";
import ReactDOM from "react-dom/client";
import { OrbApp } from "./app/OrbApp";
import "./styles/global.css";
import "./styles/native-hit-target.css";

document.title = "黑洞任务";
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><OrbApp/></React.StrictMode>);
