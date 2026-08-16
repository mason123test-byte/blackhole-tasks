import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getRaySupersampleScale } from "./blackHoleRenderer";

const rendererSource = readFileSync(
  resolve(process.cwd(), "src/shader/blackHoleRenderer.ts"),
  "utf8",
);

describe("Kerr spatial supersampling", () => {
  it("oversamples 1x Windows rays without multiplying HiDPI or low-power cost", () => {
    expect(getRaySupersampleScale(1, false)).toBe(1.25);
    expect(getRaySupersampleScale(1.25, false)).toBe(1.25);
    expect(getRaySupersampleScale(1.5, false)).toBe(1);
    expect(getRaySupersampleScale(2, false)).toBe(1);
    expect(getRaySupersampleScale(1, true)).toBe(1);
  });

  it("keeps the client canvas native while linearly resolving an oversized Kerr framebuffer", () => {
    expect(rendererSource).toContain("const rayWidth = Math.max(1, Math.round(width * rayScale));");
    expect(rendererSource).toContain("const rayHeight = Math.max(1, Math.round(height * rayScale));");
    expect(rendererSource).toContain("if (outputWidth !== rayWidth || outputHeight !== rayHeight)");
    expect(rendererSource).toContain("gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, rayWidth, rayHeight");
    expect(rendererSource).toContain("gl.viewport(0, 0, outputWidth, outputHeight);");
    expect(rendererSource).toContain("gl.uniform2f(uniforms.resolution, outputWidth, outputHeight);");
    expect(rendererSource).toContain("new Uint8Array(outputWidth * outputHeight * 4)");
    expect(rendererSource).toContain("gl.readPixels(0, 0, outputWidth, outputHeight");
    expect(rendererSource).toContain("gl.viewport(0, 0, canvas.width, canvas.height);");
    expect(rendererSource).toContain("gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);");
  });
});
