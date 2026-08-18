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
      cameraReference: "DNGR Appendix A.1 fixed-event FIDO local sky",
      cameraVerticalFovDeg: 36,
    });
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("#define N_STEPS 176");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float KERR_A = 0.60;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float KERR_A2 = KERR_A * KERR_A;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float CAMERA_VERTICAL_FOV = 0.62831853;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("void kerrDerivatives(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("FRAME_DRAG_GAIN");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("frameDragScale");
  });

  it("matches the tuned Gargantua camera and thin-disk geometry", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float OBSERVER_R = 74.1;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float OBSERVER_THETA = 1.440;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_INNER = 5.60;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_OUTER = 22.40;");
  });

  it("launches every production ray from the same DNGR camera event and varies only local-sky direction", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("void initDngrCameraRay(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("r = OBSERVER_R;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("theta = OBSERVER_THETA;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("phi = 0.0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("vec3 localSky = normalize(vec3(1.0, cameraUp, -cameraRight));");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("float imageX =");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("float imageY =");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("float imageZ =");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("initOdysseyObserverRay");
  });

  it("uses an explicit pinhole field of view for production rays instead of the legacy shadow-radius scale", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float cameraHalfTan = tan(0.5 * CAMERA_VERTICAL_FOV);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("vec2 candidateCameraPlane = vec2(screen.x * 2.0, -screen.y * 2.0) * cameraHalfTan;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float baselineAlpha = screen.x * worldScale;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float baselineBeta = -screen.y * worldScale;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("vec2 baselineCameraPlane = vec2(baselineAlpha, baselineBeta) / OBSERVER_R;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("vec2 cameraPlane = mix(baselineCameraPlane, candidateCameraPlane, candidateWeight);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float cameraImpact = OBSERVER_R * length(cameraPlane);");
  });

  it("converts the fixed-event FIDO local-sky direction into Kerr canonical momenta", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float nFidoRadial = localSky.x;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float nFidoTheta = localSky.y;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float nFidoPhi = localSky.z;");
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

  it("keeps tracing through a translucent thin disk while fading physical higher-order crossings", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const int MAX_DISK_CROSSINGS = 4;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("int diskCrossingCount = 0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float crossingColorGain(int crossingIndex)");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("if (crossingIndex == 1) return 0.46;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float crossingAlphaGain(int crossingIndex)");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("if (crossingIndex == 1) return 0.50;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float colorGain = crossingColorGain(diskCrossingCount);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float alphaGain = crossingAlphaGain(diskCrossingCount);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float effectiveAlpha = clamp(diskAlpha * alphaGain, 0.0, 0.90);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("accumulatedDisk += transmittance * (diskColor * colorGain) * effectiveAlpha;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("transmittance *= 1.0 - effectiveAlpha;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("diskCrossingCount += 1;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("bool diskHit");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("GARGANTUA_ANNULUS_CENTER");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("GARGANTUA_ANNULUS_WIDTH");
  });

  it("keeps production candidate rays free of lower-half screen-space geometry hacks", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float baselineLowerWarp = (1.0 - candidateWeight)");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("baselineBeta *= mix(1.0, 1.20, baselineLowerWarp);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("lowerMajorAxisScale");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("lowerMinorAxisScale");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("screen.y <");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("1.0 - referenceUv.y");
  });

  it("keeps the film presentation warm while reducing direct-disk overexposure", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float GARGANTUA_DOPPLER_MIX = 0.0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float GARGANTUA_DISK_TEMP = 4500.0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float innerHeat = 1.0 - smoothstep(0.04, 0.72, radialProgress);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float localTemperature = mix(3000.0, 5050.0, clamp(0.74 * innerHeat + 0.26 * streakHeat, 0.0, 1.0));",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "brightness *= mix(1.15, 0.58, smoothstep(0.04, 0.90, radialProgress));",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("vec3 linearDisk = thermalColor * brightness * 1.58;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("diskAlpha = clamp(0.12 + brightness * 0.78, 0.0, 0.86);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("vec3 thermalColor = blackbody(localTemperature);");
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
