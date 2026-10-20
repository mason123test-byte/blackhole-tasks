import { describe, expect, it, vi } from "vitest";
import { invokeWhenReady } from "./backend";

describe("invokeWhenReady", () => {
  it("retries the transient Tauri managed-state startup race", async () => {
    const invoker = vi.fn()
      .mockRejectedValueOnce("state not managed for field `db`; call .manage() before using this command")
      .mockRejectedValueOnce("state not managed for field `db`; call .manage() before using this command")
      .mockResolvedValueOnce(["ready"]);

    await expect(invokeWhenReady("list_tasks", undefined, invoker)).resolves.toEqual(["ready"]);
    expect(invoker).toHaveBeenCalledTimes(3);
  });

  it("does not hide a real backend failure behind retries", async () => {
    const invoker = vi.fn().mockRejectedValue(new Error("database is locked"));

    await expect(invokeWhenReady("list_tasks", undefined, invoker)).rejects.toThrow("database is locked");
    expect(invoker).toHaveBeenCalledTimes(1);
  });
});
