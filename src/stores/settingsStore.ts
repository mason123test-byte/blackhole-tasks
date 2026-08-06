import { create } from "zustand";
import { backend } from "../services/backend";
import { DEFAULT_SETTINGS, type AppSettings } from "../types/settings";

interface SettingsState { settings: AppSettings; loading: boolean; load(): Promise<void>; update(patch: Partial<AppSettings>): Promise<void> }
export const useSettingsStore = create<SettingsState>((set) => ({
  settings: DEFAULT_SETTINGS, loading: false,
  async load() { set({ loading: true }); try { set({ settings: await backend.getSettings() }); } finally { set({ loading: false }); } },
  async update(patch) { set({ settings: await backend.updateSettings(patch) }); },
}));

