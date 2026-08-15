import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getRenderProfile, getRenderSize } from "./blackHoleRenderer";
import {
  REFERENCE_BLACK_HOLE_FRAGMENT,
  REFERENCE_BLACK_HOLE_INFO,
} from "./referenceBlackHoleShader";

const rendererSource = readFileSync(
  resolve(process.cwd(), "src/shader/blackHoleRenderer.ts"),
  "utf8",
);

describe("Interstellar Gargantua Kerr WebGL black-hole port", () => {
  it("uses a real Kerr null-geodesic state instead of heuristic frame dragging", () => {
    expect(REFERENCE_BLACK_HOLE_INFO).toMatchObject({
      model: "interstellar-gargantua-kerr-geodesic",
      integrationSteps: 144,
      tracePadding: 3,
      starGain: 0,
      sceneInput: "svg-gpu-texture",
      alphaMode: "reference-webgl-straight-alpha",
      styleReference: "https://arxiv.org/abs/1502.03808",
      physicsReference: "https://github.com/hungyipu/Odyssey",
    });
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("#define N_STEPS 144");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float KERR_A = 0.60;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float KERR_A2 = KERR_A * KERR_A;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("void kerrDerivatives(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("FRAME_DRAG_GAIN");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("frameDragScale");
  });

  it("matches the published DNGR figure-15 camera geometry", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float OBSERVER_R = 74.1;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float OBSERVER_THETA = 1.511;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_INNER = 9.26;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_OUTER = 18.70;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float imageX = sqrt(OBSERVER_R * OBSERVER_R + KERR_A2) * sin(OBSERVER_THETA) - beta * cos(OBSERVER_THETA);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float imageY = alpha;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float imageZ = OBSERVER_R * cos(OBSERVER_THETA) + beta * sin(OBSERVER_THETA);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("kappa = ptheta * ptheta + KERR_A2 * sin2 + L * L / sin2;");
  });

  it("integrates Kerr radial and polar canonical momenta so turning points are not faked", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("dr = -pr * delta / sigma;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("dtheta = -ptheta / sigma;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("dphi = -(twoR * KERR_A + (sigma - twoR) * L / sin2) / sigmaDelta;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("dpr = -(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("dptheta = -safeSin * cosTheta * (L * L / (sin2 * sin2) - KERR_A2) / sigma;");
  });

  it("spends the integration budget near the critical region instead of the distant observer", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float nearHole = 1.0 - smoothstep(3.2, 14.0, r);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float h = mix(1.20, 0.055, nearHole);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("h = clamp(h, 0.028, 1.20);");
  });

  it("uses one opaque thin equatorial disk and lets Kerr geometry create the multiple images", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float side = theta - 0.5 * PI;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("if (!diskHit && side * previousSide < 0.0)");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("diskHit = true;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("break;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("diskCrossingIndex");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("crossingGain");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("GARGANTUA_ANNULUS_CENTER");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("GARGANTUA_ANNULUS_WIDTH");
  });

  it("keeps production candidate rays unwarped while allowing legacy lower A/B distortion only in baseline mode", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float alpha = screen.x * worldScale;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float beta = -screen.y * worldScale;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float baselineLowerWarp = (1.0 - candidateWeight)");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("beta *= mix(1.0, 1.20, baselineLowerWarp);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("lowerMajorAxisScale");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("lowerMinorAxisScale");
  });

  it("keeps the film presentation warm and suppresses strong Doppler asymmetry", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float GARGANTUA_DOPPLER_MIX = 0.0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float GARGANTUA_DISK_TEMP = 4500.0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("vec3 diskColor = blackbody(GARGANTUA_DISK_TEMP);");
  });

  it("preserves straight-alpha WebGL composition and renderer controls", () => {
    expect(rendererSource).toContain("premultipliedAlpha: false");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("uniform float u_visual_compare;");
    expect(rendererSource).toContain(
      "gl.uniform1f(uniforms.visualCompare, visualComparison.shaderMode);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("u_hover");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("u_pulse");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("u_detail");
  });

  it("keeps the existing Windows render profiles and HiDPI ceiling", () => {
    expect(getRenderProfile("low")).toEqual({ fps: 12, pixelRatioCap: 1 });
    expect(getRenderProfile("balanced")).toEqual({ fps: 15, pixelRatioCap: 1 });
    expect(getRenderProfile("high")).toEqual({ fps: 40, pixelRatioCap: 2 });
    expect(getRenderSize(920, 700, 2, 2)).toEqual({ width: 1840, height: 1400 });
  });
});