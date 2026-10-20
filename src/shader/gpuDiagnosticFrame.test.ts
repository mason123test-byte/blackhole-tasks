import { describe, expect, it } from "vitest";
import { gpuDiagnosticFrameReceipt } from "./blackHoleRenderer";
describe("raw GPU framebuffer diagnostics", () => {
  it("does not treat alpha-only or window UI as crossing emission", () => {
    expect(gpuDiagnosticFrameReceipt(new Uint8Array([0,0,0,255,1,0,0,255,9,3,0,0]), false))
      .toBe("2,1,13,2,0,0,0,0,0,0,0,0");
  });
  it("classifies all eight raw termination colors", () => {
    const colors = [[128,128,128],[128,0,0],[0,128,0],[0,0,128],[128,128,0],[128,0,128],[0,128,128],[128,64,128]];
    expect(gpuDiagnosticFrameReceipt(new Uint8Array(colors.flatMap(rgb => [...rgb,255])), true))
      .toBe("8,8,1856,8,1,1,1,1,1,1,1,1");
  });
  it("rejects incomplete RGBA8 pixel streams", () => {
    expect(() => gpuDiagnosticFrameReceipt(new Uint8Array(3), true)).toThrow(/RGBA8/);
  });
});
