import type { Tag } from "../../types/task";
import type { TaskFilters } from "../../utils/filter";

interface WorkspaceToolbarProps {
  filters: TaskFilters;
  tags: Tag[];
  onChange(patch: Partial<TaskFilters>): void;
  onAdd(): void;
  onUndo(): void;
  onRedo(): void;
  onFit(): void;
  onExport(): void;
  onClose(): void;
}

export function WorkspaceToolbar({ filters, onChange, tags, onAdd, onUndo, onRedo, onFit, onExport, onClose }: WorkspaceToolbarProps) {
  return <header className="toolbar" data-tauri-drag-region>
    <div className="brand" data-tauri-drag-region><span className="brand-orb" aria-hidden="true"/><span><strong>黑洞任务</strong><small>四象限空间</small></span></div>
    <label className="search-field"><span aria-hidden="true">⌕</span><input name="task-search" autoComplete="off" aria-label="搜索任务" placeholder="搜索标题、描述、标签…" value={filters.query} onChange={(event) => onChange({ query: event.target.value })}/></label>
    <div className="toolbar-filters">
      <select name="status-filter" aria-label="状态筛选" value={filters.status} onChange={(event) => onChange({ status: event.target.value })}><option value="all">全部状态</option><option value="todo">待办</option><option value="doing">进行中</option><option value="blocked">已阻塞</option><option value="done">已完成</option></select>
      <select name="tag-filter" aria-label="标签筛选" value={filters.tag} onChange={(event) => onChange({ tag: event.target.value })}><option value="all">全部标签</option>{tags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select>
      <label className="check"><input name="show-completed" type="checkbox" checked={filters.showCompleted} onChange={(event) => onChange({ showCompleted: event.target.checked })}/>已完成</label>
    </div>
    <div className="toolbar-actions">
      <div className="history-actions"><button aria-label="撤销" title="撤销 (Ctrl+Z)" onClick={onUndo}>↶</button><button aria-label="重做" title="重做 (Ctrl+Shift+Z)" onClick={onRedo}>↷</button><button aria-label="适应视图" title="适应视图" onClick={onFit}>⌗</button></div>
      <button className="export-button" aria-label="导出 JSON" onClick={onExport}>导出</button>
      <button className="primary" aria-label="新增任务" onClick={onAdd}>＋ 新增</button>
      <button className="close-button" aria-label="关闭工作区" title="关闭" onClick={onClose}>×</button>
    </div>
  </header>;
}
