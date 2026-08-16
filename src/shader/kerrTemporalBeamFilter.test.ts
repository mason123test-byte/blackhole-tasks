import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

const rendererSource = readFileSync(
  resolve(process.cwd(), "src/shader/blackHoleRenderer.ts"),
  "utf8",
);

describe("Kerr temporal pixel-beam filtering", () => {
  it("samples a deterministic four-point pixel footprint before freezing diagnostics", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("uniform vec2 u_ray_jitter;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("referenceUv += u_ray_jitter / u_resolution;");
    expect(rendererSource).toContain("const rayJitterSequence = [");
    expect(rendererSource).toContain("[-0.25, -0.25]");
    expect(rendererSource).toContain("[0.25, -0.25]");
    expect(rendererSource).toContain("[-0.25, 0.25]");
    expect(rendererSource).toContain("[0.25, 0.25]");
    expect(rendererSource).toContain("let accumulatedRaySamples = 0;");
    expect(rendererSource).toContain("accumulatedRaySamples >= rayJitterSequence.length");
    expect(rendererSource).toContain("gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);");
  });
});
