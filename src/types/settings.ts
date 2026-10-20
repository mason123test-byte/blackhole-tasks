export type RenderQuality = "low" | "balanced" | "high";

export interface AppSettings {
  orbAlwaysOnTop: boolean;
  orbClickThrough: boolean;
  orbPositionX: number;
  orbPositionY: number;
  orbMonitorId: string | null;
  renderQuality: RenderQuality;
  lowPowerMode: boolean;
  launchAtStartup: boolean;
  closeDelayMs: number;
  hoverOpenDelayMs: number;
  workspaceWidth: number;
  workspaceHeight: number;
  hideCompletedTasks: boolean;
  completeAnimationEnabled: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  orbAlwaysOnTop: true,
  orbClickThrough: false,
  orbPositionX: 0,
  orbPositionY: 0,
  orbMonitorId: null,
  renderQuality: "balanced",
  lowPowerMode: false,
  launchAtStartup: false,
  closeDelayMs: 350,
  hoverOpenDelayMs: 120,
  workspaceWidth: 1100,
  workspaceHeight: 760,
  hideCompletedTasks: true,
  completeAnimationEnabled: true,
};

