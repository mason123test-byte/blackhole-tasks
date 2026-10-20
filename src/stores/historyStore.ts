import { create } from "zustand";

export interface HistoryAction { label: string; undo(): Promise<void>; redo(): Promise<void> }
interface HistoryState { undoStack: HistoryAction[]; redoStack: HistoryAction[]; push(action: HistoryAction): void; undo(): Promise<void>; redo(): Promise<void> }
export const useHistoryStore = create<HistoryState>((set, get) => ({
  undoStack: [], redoStack: [],
  push(action) { set((state) => ({ undoStack: [...state.undoStack.slice(-99), action], redoStack: [] })); },
  async undo() { const action = get().undoStack.at(-1); if (!action) return; await action.undo(); set((state) => ({ undoStack: state.undoStack.slice(0, -1), redoStack: [...state.redoStack, action] })); },
  async redo() { const action = get().redoStack.at(-1); if (!action) return; await action.redo(); set((state) => ({ redoStack: state.redoStack.slice(0, -1), undoStack: [...state.undoStack, action] })); },
}));

