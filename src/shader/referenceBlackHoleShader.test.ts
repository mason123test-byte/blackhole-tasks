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
      integrationSteps: 176,
      tracePadding: 3,
      starGain: 0,
      sceneInput: "svg-gpu-texture",
      alphaMode: "reference-webgl-straight-alpha",
      styleReference: "https://arxiv.org/abs/1502.03808",
      physicsReference: "https://github.com/hungyipu/Odyssey",
      cameraReference: "Odyssey finite-observer image-plane initial conditions",
    });
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("#define N_STEPS 176");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float KERR_A = 0.60;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float KERR_A2 = KERR_A * KERR_A;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("void kerrDerivatives(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("FRAME_DRAG_GAIN");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("frameDragScale");
  });

  it("matches the published Gargantua camera and disk geometry", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float OBSERVER_R = 74.1;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float OBSERVER_THETA = 1.511;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_INNER = 9.26;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_OUTER = 18.70;");
  });

  it("uses Odyssey finite-observer image-plane coordinates instead of mixing image lengths with a local-sky direction", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("void initOdysseyObserverRay(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float imageX = sqrt(OBSERVER_R * OBSERVER_R + KERR_A2) * sinObserver - beta * cosObserver;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float imageY = alpha;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float imageZ = OBSERVER_R * cosObserver + beta * sinObserver;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("r = sqrt(0.5 * (imageU + sqrt(imageU * imageU + spinZ * spinZ)));");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("theta = acos(clamp(imageZ / r, -1.0, 1.0));");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("phi = atan(imageY, imageX);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("cameraSkyDirection");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("incomingCameraDirection");
  });

  it("derives canonical Kerr momenta from the finite observer screen normal exactly once", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float rayRDot = -(-imageRadius * imageRadius * cosObserver * cosTheta + r * imageRadius * projected * sinTheta) / sigma;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float rayThetaDot = -(cosObserver * r * sinTheta + imageRadius * projected * cosTheta) / sigma;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float rayPhiDot = -sinObserver * sin(phi) / (imageRadius * safeSin);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float energy2 = sigmaMinusTwoR * (rayRDot * rayRDot / delta + rayThetaDot * rayThetaDot)");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("pr = rayRDot * sigma / delta / energy;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("ptheta = rayThetaDot * sigma / energy;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("L = ((sigma * delta * rayPhiDot - 2.0 * KERR_A * r * energy) * sin2 / sigmaMinusTwoR) / energy;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("kappa = ptheta * ptheta + KERR_A2 * sin2 + L * L / sin2;");
  });

  it("integrates Kerr radial and polar canonical momenta so turning points are not faked", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("dr = -pr * delta / sigma;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("dtheta = -ptheta / sigma;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("dphi = -(twoR * KERR_A + (sigma - twoR) * L / sin2) / sigmaDelta;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("dpr = -(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("dptheta = -safeSin * cosTheta * (L * L / (sin2 * sin2) - KERR_A2) / sigma;");
  });

  it("uses error-controlled Kerr stepping around critical and almost-trapped rays", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float KERR_MIN_STEP = 0.006;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float KERR_MAX_STEP = 1.55;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float KERR_ERROR_TOL = 0.00035;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const int KERR_MAX_RETRIES = 5;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("void rkckKerrTrial(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float errorRatio = kerrErrorRatio(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("pow(errorRatio, -0.25)");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("pow(max(acceptedErrorRatio, 1e-6), -0.20)");
  });

  it("retries rejected Cash-Karp trials without spending a completed geodesic step", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("bool acceptedStep = false;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("for (int retry = 0; retry < KERR_MAX_RETRIES; retry++) {");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("if (errorRatio <= 1.0 || h <= KERR_MIN_STEP * 1.01) {");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("acceptedStep = true;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("if (!acceptedStep) {");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("break;");
  });

  it("prevents finite-precision steps from jumping through the Kerr polar barrier", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float axisDistance = min(theta, PI - theta);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float axisStepLimit = 0.20 * axisDistance / max(abs(dtheta0), 1e-4);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("h = min(h, max(KERR_MIN_STEP, axisStepLimit));");
  });

  it("keeps tracing through a translucent thin disk so Kerr geometry can contribute multiple image orders", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const int MAX_DISK_CROSSINGS = 4;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("int diskCrossingCount = 0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("if (side * previousSide < 0.0 && diskCrossingCount < MAX_DISK_CROSSINGS)");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("accumulatedDisk += transmittance * diskColor * diskAlpha;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("transmittance *= 1.0 - diskAlpha;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("diskCrossingCount += 1;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("bool diskHit");
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
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("vec3 thermalColor = blackbody(GARGANTUA_DISK_TEMP);");
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