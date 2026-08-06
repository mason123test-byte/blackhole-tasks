import { TaskQuickAdd } from "../components/task/TaskQuickAdd";
import { backend } from "../services/backend";
export function QuickAddApp(){return <main className="quick-add-window"><h1>捕获一个任务</h1><TaskQuickAdd onDone={()=>void backend.window("hide_quick_add")}/><button onClick={()=>void backend.window("hide_quick_add")}>取消</button></main>}

