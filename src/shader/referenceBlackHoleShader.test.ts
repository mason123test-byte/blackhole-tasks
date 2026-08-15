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
      integrationSteps: 112,
      tracePadding: 3,
      starGain: 0,
      sceneInput: "svg-gpu-texture",
      alphaMode: "reference-webgl-straight-alpha",
      styleReference: "https://arxiv.org/abs/1502.03808",
      physicsReference: "https://github.com/hungyipu/Odyssey",
      cameraReference: "DNGR Appendix A.1 local-sky/FIDO camera",
    });
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("#define N_STEPS 112");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float KERR_A = 0.60;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float KERR_A2 = KERR_A * KERR_A;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("void kerrDerivatives(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("FRAME_DRAG_GAIN");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("frameDragScale");
  });

  it("matches the published DNGR figure-15 camera and disk geometry", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float OBSERVER_R = 74.1;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float OBSERVER_THETA = 1.511;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_INNER = 9.26;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_OUTER = 18.70;");
  });

  it("starts every candidate ray at one DNGR camera event and varies only its local-sky direction", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("void initDngrCameraRay(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("r = OBSERVER_R;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("theta = OBSERVER_THETA;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("phi = 0.0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("vec3 cameraSkyDirection = normalize(vec3(-OBSERVER_R, alpha, beta));");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("vec3 incomingCameraDirection = -cameraSkyDirection;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("float imageX =");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("float imageY =");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("float imageZ =");
  });

  it("converts the local camera ray through the FIDO tetrad into Kerr canonical momenta", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float nFidoRadial = incomingCameraDirection.x;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float nFidoTheta = -incomingCameraDirection.z;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float nFidoPhi = incomingCameraDirection.y;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float lapse = rho * sqrtDelta / sigmaMetric;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float omega = 2.0 * KERR_A * r / (sigmaMetric * sigmaMetric);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float varpi = sigmaMetric * safeSin / rho;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float cameraEnergy = 1.0 / (lapse + omega * varpi * nFidoPhi);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("pr = cameraEnergy * (rho / sqrtDelta) * nFidoRadial;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("ptheta = cameraEnergy * rho * nFidoTheta;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("L = cameraEnergy * varpi * nFidoPhi;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("kappa = ptheta * ptheta + KERR_A2 * sin2 + L * L / sin2;");
  });

  it("integrates Kerr radial and polar canonical momenta so turning points are not faked", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("dr = -pr * delta / sigma;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("dtheta = -ptheta / sigma;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("dphi = -(twoR * KERR_A + (sigma - twoR) * L / sin2) / sigmaDelta;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("dpr = -(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("dptheta = -safeSin * cosTheta * (L * L / (sin2 * sin2) - KERR_A2) / sigma;");
  });

  it("uses fourth-order Kerr stepping to suppress critical-curve integration artifacts", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("void rk4KerrStep(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("rk4KerrStep(r, theta, phi, pr, ptheta, L, kappa, h);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float h = mix(1.35, 0.065, nearHole);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("h = clamp(h, 0.032, 1.35);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("float midR =");
  });

  it("keeps tracing through a translucent thin disk so Kerr geometry can contribute multiple image orders", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const int MAX_DISK_CROSSINGS = 4;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("int diskCrossingCount = 0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("if (side * previousSide < 0.0 && diskCrossingCount < MAX_DISK_CROSSINGS)");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("accumulatedDisk += transmittance * diskColor * diskAlpha;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("transmittance *= 1.0 - diskAlpha;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("diskCrossingCount += 1;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("bool diskHit");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("diskHit = true;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("GARGANTUA_ANNULUS_CENTER");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("GARGANTUA_ANNULUS_WIDTH");
  });

  it("keeps production candidate rays free of lower-half screen-space geometry hacks", () => {
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