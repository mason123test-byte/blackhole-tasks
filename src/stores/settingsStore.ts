import { create } from "zustand";
import { backend } from "../services/backend";
import { DEFAULT_SETTINGS, type AppSettings } from "../types/settings";

interface SettingsState { settings: AppSettings; loading: boolean; load(): Promise<void>; update(patch: Partial<AppSettings>): Promise<void> }
export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS, loading: false,
  async load() {
    set({ loading: true });
    try { set({ settings: await backend.getSettings() }); }
    catch (error) { console.error("读取设置失败，继续使用默认设置：", error); }
    finally { set({ loading: false }); }
  },
  async update(patch) { set({ settings: await backend.updateSettings(patch) }); },
}));
