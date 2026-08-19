import { invoke } from "@tauri-apps/api/core";
import {
  REFERENCE_BLACK_HOLE_FRAGMENT,
  REFERENCE_BLACK_HOLE_INFO,
  REFERENCE_BLACK_HOLE_VERTEX,
} from "./referenceBlackHoleShader";
import type { RenderQuality } from "../types/settings";
import {
  buildSceneTextureSignature,
  createSceneTextureBitmap,
  type SceneTextureState,
  type SceneTextureSnapshot,
} from "./sceneTexture";

export const BLACK_HOLE_RENDERER_INFO = REFERENCE_BLACK_HOLE_INFO;

export const MIRROR_COMPOSITOR_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_frame_texture;
uniform vec2 u_resolution;
out vec4 outColor;

vec4 flareSample(
  float lod,
  float whiteLow,
  float whiteHigh,
  float peakLow,
  float peakHigh
) {
  vec4 sampleColor = textureLod(u_frame_texture, v_uv, lod);
  float peak = max(sampleColor.r, max(sampleColor.g, sampleColor.b));
  float whiteFloor = min(sampleColor.r, min(sampleColor.g, sampleColor.b));
  float warmBalance = smoothstep(-0.015, 0.085, sampleColor.r - sampleColor.b);
  float mask = sampleColor.a
    * smoothstep(whiteLow, whiteHigh, whiteFloor)
    * smoothstep(peakLow, peakHigh, peak)
    * warmBalance;
  return vec4(sampleColor.rgb * mask, mask);
}

void main() {
  vec4 base = textureLod(u_frame_texture, v_uv, 0.0);
  float basePeak = max(base.r, max(base.g, base.b));
  float baseFloor = min(base.r, min(base.g, base.b));
  float highlight = base.a
    * smoothstep(0.34, 0.82, basePeak)
    * smoothstep(0.14, 0.58, baseFloor);
  float hotCore = base.a * smoothstep(0.66, 0.94, basePeak);
  float softShoulder = base.a
    * smoothstep(0.10, 0.42, basePeak)
    * (1.0 - smoothstep(0.58, 0.82, basePeak));
  float shadowProtect = base.a * (1.0 - smoothstep(0.012, 0.075, basePeak));
  vec3 ivory = vec3(1.0, 0.945, 0.80);
  vec3 paleGold = vec3(1.0, 0.875, 0.68);
  vec3 highlightTint = mix(ivory, paleGold, 0.20);

  vec3 gradedBase = base.rgb * mix(1.0, 0.90, softShoulder);
  gradedBase = mix(gradedBase, max(gradedBase, highlightTint * basePeak), highlight * 0.24);
  gradedBase += highlightTint * hotCore * 0.055;

  float availableLod = floor(log2(max(min(u_resolution.x, u_resolution.y), 1.0)));
  vec4 nearGlow = flareSample(min(2.0, availableLod), 0.16, 0.42, 0.27, 0.66);
  vec4 midGlow = flareSample(min(4.0, availableLod), 0.065, 0.23, 0.11, 0.40);
  vec4 farGlow = flareSample(min(7.0, availableLod), 0.022, 0.10, 0.045, 0.20);
  float flareCoreReject = 1.0 - 0.82 * smoothstep(0.56, 0.82, basePeak);
  float veilingSupport = (1.0 - shadowProtect)
    * flareCoreReject
    * smoothstep(0.008, 0.135, nearGlow.a + midGlow.a * 0.76 + farGlow.a * 0.40);
  vec3 nearWarm = mix(nearGlow.rgb, ivory * nearGlow.a, 0.38);
  vec3 midWarm = mix(midGlow.rgb, highlightTint * midGlow.a, 0.48);
  vec3 farWarm = mix(farGlow.rgb, ivory * farGlow.a, 0.56);
  vec3 glow = (nearWarm * 0.23 + midWarm * 0.095 + farWarm * 0.030) * veilingSupport;
  float glowAlpha = (nearGlow.a * 0.080 + midGlow.a * 0.034 + farGlow.a * 0.012) * veilingSupport;
  vec3 composed = clamp(gradedBase + glow, 0.0, 1.0);
  composed = mix(composed, base.rgb, shadowProtect);
  outColor = vec4(composed, max(base.a, min(glowAlpha, 0.18)));
}`;

function reportOrbFrame(renderer: "webgl2", energy: number, width: number, height: number, diagnostic = "") {
  const diagnosticSuffix = diagnostic ? `|diag=${diagnostic}` : "";
  document.title = `黑洞任务|renderer=${renderer}|frame=ready|energy=${energy}|size=${width}x${height}${diagnosticSuffix}`;
  if ("__TAURI_INTERNALS__" in window) {
    void invoke("report_orb_render", { renderer, energy, width, height, diagnostic }).catch((error) => {
      console.error("无法上报黑洞首帧状态：", error);
    });
  }
}

export interface RenderProfile {
  fps: number;
  pixelRatioCap: number;
}

export type VisualComparisonMode = "normal" | "baseline" | "candidate" | "split";

export function normalizeVisualComparisonMode(value: unknown): VisualComparisonMode {
  return value === "baseline" || value === "candidate" || value === "split" ? value : "normal";
}

export function getVisualComparisonSettings(mode: VisualComparisonMode) {
  if (mode === "baseline") return { shaderMode: 0, fixedTime: 12 };
  if (mode === "split") return { shaderMode: 2, fixedTime: 12 };
  if (mode === "candidate") return { shaderMode: 1, fixedTime: 12 };
  return { shaderMode: 1, fixedTime: null };
}

export function getRenderProfile(quality: RenderQuality, lowPowerMode = false): RenderProfile {
  if (lowPowerMode || quality === "low") {
    return { fps: 12, pixelRatioCap: 1 };
  }
  if (quality === "high") {
    return { fps: 40, pixelRatioCap: 2 };
  }
  return { fps: 15, pixelRatioCap: 1 };
}

export function getRenderSize(
  clientWidth: number,
  clientHeight: number,
  devicePixelRatio: number,
  pixelRatioCap: number,
) {
  const dpr = Math.min(Math.max(devicePixelRatio || 1, 1), pixelRatioCap);
  return {
    width: Math.max(1, Math.round(clientWidth * dpr)),
    height: Math.max(1, Math.round(clientHeight * dpr)),
  };
}

export function getRaySupersampleScale(devicePixelRatio: number, lowCostMode = false) {
  if (lowCostMode || (devicePixelRatio || 1) > 1.25) return 1;
  return 1.25;
}

interface RendererOptions {
  quality?: RenderQuality;
  lowPowerMode?: boolean;
  visualComparisonMode?: VisualComparisonMode;
  onError?(message: string): void;
}

interface RendererSessionOptions extends RendererOptions {
  onContextLost?(): void;
}

function startBlackHoleSession(
  canvas: HTMLCanvasElement,
  getExpanded: () => number,
  getScene: () => SceneTextureState,
  options: RendererSessionOptions = {},
) {
  const profile = getRenderProfile(options.quality ?? "balanced", options.lowPowerMode);
  const visualComparison = getVisualComparisonSettings(options.visualComparisonMode ?? "normal");
  const freezeAfterValidatedFrame = visualComparison.fixedTime !== null;
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true,
    powerPreference: options.lowPowerMode ? "low-power" : "default",
  });
  if (!gl) {
    const message = "当前 WebView 不支持 WebGL2，请启用硬件加速或更新 WebView2。";
    canvas.dataset.renderer = "unavailable";
    options.onError?.(message);
    return () => undefined;
  }

  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("无法创建黑洞 Shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader) ?? "Shader 编译失败";
      gl.deleteShader(shader);
      throw new Error(message);
    }
    return shader;
  };

  try {
    const vertexShader = compile(gl.VERTEX_SHADER, REFERENCE_BLACK_HOLE_VERTEX);
    const fragmentShader = compile(gl.FRAGMENT_SHADER, REFERENCE_BLACK_HOLE_FRAGMENT);
    const program = gl.createProgram();
    if (!program) throw new Error("无法创建黑洞渲染程序");
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "Shader 链接失败");
    }

    const compositorVertexShader = compile(gl.VERTEX_SHADER, REFERENCE_BLACK_HOLE_VERTEX);
    const compositorFragmentShader = compile(gl.FRAGMENT_SHADER, MIRROR_COMPOSITOR_FRAGMENT);
    const compositorProgram = gl.createProgram();
    if (!compositorProgram) throw new Error("无法创建黑洞镜像合成程序");
    gl.attachShader(compositorProgram, compositorVertexShader);
    gl.attachShader(compositorProgram, compositorFragmentShader);
    gl.linkProgram(compositorProgram);
    gl.deleteShader(compositorVertexShader);
    gl.deleteShader(compositorFragmentShader);
    if (!gl.getProgramParameter(compositorProgram, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(compositorProgram) ?? "镜像合成 Shader 链接失败");
    }

    const buffer = gl.createBuffer();
    if (!buffer) throw new Error("无法创建黑洞顶点缓冲区");
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    const compositorPosition = gl.getAttribLocation(compositorProgram, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(program);

    const uniforms = {
      resolution: gl.getUniformLocation(program, "u_resolution"),
      time: gl.getUniformLocation(program, "u_time"),
      expanded: gl.getUniformLocation(program, "u_expanded"),
      sceneTexture: gl.getUniformLocation(program, "u_scene_texture"),
      sceneReady: gl.getUniformLocation(program, "u_scene_ready"),
      visualCompare: gl.getUniformLocation(program, "u_visual_compare"),
    };
    gl.uniform1i(uniforms.sceneTexture, 0);
    gl.uniform1f(uniforms.visualCompare, visualComparison.shaderMode);
    const compositorUniforms = {
      resolution: gl.getUniformLocation(compositorProgram, "u_resolution"),
      frameTexture: gl.getUniformLocation(compositorProgram, "u_frame_texture"),
      visualCompare: gl.getUniformLocation(compositorProgram, "u_visual_compare"),
    };
    gl.useProgram(compositorProgram);
    gl.uniform1i(compositorUniforms.frameTexture, 1);
    gl.uniform1f(compositorUniforms.visualCompare, visualComparison.shaderMode);
    gl.useProgram(program);

    const sceneTexture = gl.createTexture();
    if (!sceneTexture) throw new Error("无法创建黑洞场景纹理");
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));

    const outputTexture = gl.createTexture();
    const outputFramebuffer = gl.createFramebuffer();
    if (!outputTexture || !outputFramebuffer) throw new Error("无法创建黑洞输出帧缓冲");
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, outputTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, outputFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outputTexture, 0);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error("黑洞输出帧缓冲不完整");
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE0);
    let outputWidth = 1;
    let outputHeight = 1;

    canvas.dataset.renderer = "webgl2";
    canvas.dataset.model = BLACK_HOLE_RENDERER_INFO.model;
    canvas.dataset.quality = options.lowPowerMode ? "low-power" : (options.quality ?? "balanced");
    let animationFrame = 0;
    let disposed = false;
    let lastFrameAt = 0;
    let nextFrameAt = 0;
    let startedAt = performance.now();
    let measuredFrames = 0;
    let measuredAt = startedAt;
    let needsResize = true;
    let readbackAttempts = 0;
    let rendererReady = false;
    let contextLost = false;
    let failed = false;
    let sceneSignature = "";
    let sceneReady = false;
    let sceneRevision = 0;

    const refreshSceneTexture = () => {
      const state = getScene();
      const snapshot: SceneTextureSnapshot = {
        ...state,
        width: Math.max(1, Math.round(canvas.clientWidth)),
        height: Math.max(1, Math.round(canvas.clientHeight)),
      };
      const signature = buildSceneTextureSignature(snapshot);
      if (signature === sceneSignature) return;
      sceneSignature = signature;
      const revision = ++sceneRevision;
      if (!snapshot.expanded) {
        sceneReady = false;
        return;
      }
      void createSceneTextureBitmap(snapshot).then((bitmap) => {
        if (disposed || contextLost || failed || revision !== sceneRevision) {
          bitmap.close();
          return;
        }
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        bitmap.close();
        sceneReady = true;
        schedule();
      }).catch((error) => {
        if (disposed || contextLost || failed || revision !== sceneRevision) return;
        failed = true;
        sceneReady = false;
        if (animationFrame) cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        const message = error instanceof Error ? error.message : String(error);
        console.error("无法生成黑洞场景纹理：", error);
        options.onError?.(`无法生成黑洞场景纹理：${message}`);
      });
    };

    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => { needsResize = true; });
    resizeObserver?.observe(canvas);

    const schedule = () => {
      if (freezeAfterValidatedFrame && rendererReady) return;
      if (!disposed && !failed && !document.hidden && animationFrame === 0) {
        animationFrame = requestAnimationFrame(render);
      }
    };
    const render = (now: number, force = false) => {
      animationFrame = 0;
      if (disposed || contextLost || failed || (!force && document.hidden)) return;
      const frameInterval = 1000 / profile.fps;
      if (!force && nextFrameAt !== 0 && now + 0.5 < nextFrameAt) {
        schedule();
        return;
      }
      lastFrameAt = now;
      nextFrameAt = nextFrameAt === 0 || now - nextFrameAt > frameInterval * 3
        ? now + frameInterval
        : nextFrameAt + frameInterval;

      if (needsResize) {
        const baseSize = getRenderSize(
          canvas.clientWidth,
          canvas.clientHeight,
          window.devicePixelRatio,
          profile.pixelRatioCap,
        );
        const lowCostMode = Boolean(options.lowPowerMode || options.quality === "low");
        const rayScale = getRaySupersampleScale(window.devicePixelRatio, lowCostMode);
        const width = Math.max(1, Math.round(baseSize.width * rayScale));
        const height = Math.max(1, Math.round(baseSize.height * rayScale));
        let resizedFrame = false;
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
          resizedFrame = true;
        }
        if (outputWidth !== width || outputHeight !== height) {
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, outputTexture);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
          gl.bindFramebuffer(gl.FRAMEBUFFER, outputFramebuffer);
          gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outputTexture, 0);
          const resizedFramebufferStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.activeTexture(gl.TEXTURE0);
          if (resizedFramebufferStatus !== gl.FRAMEBUFFER_COMPLETE) {
            const diagnostic = `resize-f${resizedFramebufferStatus}-e${gl.getError()}`;
            canvas.dataset.diagnostic = diagnostic;
            reportOrbFrame("webgl2", 0, canvas.width, canvas.height, diagnostic);
            needsResize = true;
            schedule();
            return;
          }
          outputWidth = width;
          outputHeight = height;
          resizedFrame = true;
        }
        if (resizedFrame) {
          rendererReady = false;
          readbackAttempts = 0;
        }
        needsResize = false;
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, outputFramebuffer);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.time, visualComparison.fixedTime ?? (now - startedAt) / 1000);
      refreshSceneTexture();
      gl.uniform1f(uniforms.expanded, getExpanded());
      gl.uniform1f(uniforms.sceneReady, sceneReady ? 1 : 0);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      let validatedEnergy: number | null = null;
      let validatedDiagnostic = "";
      if (!rendererReady && readbackAttempts < 120) {
        readbackAttempts += 1;
        gl.finish();
        const pixels = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let energy = 0;
        let alphaEnergy = 0;
        let maxChannel = 0;
        let maxAlpha = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          const channel = Math.max(pixels[index], pixels[index + 1], pixels[index + 2]);
          const alpha = pixels[index + 3];
          if (alpha > 8) alphaEnergy += 1;
          if (alpha > 8 && channel > 48) energy += 1;
          maxChannel = Math.max(maxChannel, channel);
          maxAlpha = Math.max(maxAlpha, alpha);
        }
        const glError = gl.getError();
        const framebufferStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        const expandedSceneReady = getExpanded() < 0.5 || sceneReady;
        validatedEnergy = expandedSceneReady ? energy : 0;
        validatedDiagnostic = `a${alphaEnergy}-m${maxChannel}-am${maxAlpha}-sr${expandedSceneReady ? 1 : 0}-e${glError}-f${framebufferStatus}`;
        canvas.dataset.energy = String(validatedEnergy);
        canvas.dataset.diagnostic = validatedDiagnostic;
        rendererReady = validatedEnergy > 100;
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(compositorProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(compositorPosition);
      gl.vertexAttribPointer(compositorPosition, 2, gl.FLOAT, false, 0, 0);
      gl.uniform2f(compositorUniforms.resolution, canvas.width, canvas.height);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, outputTexture);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.activeTexture(gl.TEXTURE0);

      if (validatedEnergy !== null) {
        gl.finish();
        reportOrbFrame("webgl2", validatedEnergy, canvas.width, canvas.height, validatedDiagnostic);
      }

      measuredFrames += 1;
      if (now - measuredAt >= 1000) {
        canvas.dataset.fps = String(Math.round(measuredFrames * 1000 / (now - measuredAt)));
        measuredFrames = 0;
        measuredAt = now;
      }
      if (!freezeAfterValidatedFrame || !rendererReady) {
        schedule();
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        if (animationFrame) cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      } else {
        startedAt += Math.max(0, performance.now() - lastFrameAt);
        lastFrameAt = 0;
        nextFrameAt = 0;
        schedule();
      }
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      failed = true;
      canvas.dataset.renderer = "context-lost";
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      options.onContextLost?.();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onVisibility);
    canvas.addEventListener("webglcontextlost", onContextLost);
    const forceRender = () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      render(performance.now(), true);
    };
    forceRender();

    return () => {
      disposed = true;
      if (animationFrame) cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      sceneRevision += 1;
      gl.deleteBuffer(buffer);
      gl.deleteFramebuffer(outputFramebuffer);
      gl.deleteTexture(outputTexture);
      gl.deleteTexture(sceneTexture);
      gl.deleteProgram(compositorProgram);
      gl.deleteProgram(program);
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    canvas.dataset.renderer = "shader-error";
    console.error("WebGL2 黑洞初始化失败：", error);
    options.onError?.(message);
    return () => undefined;
  }
}

export function startBlackHole(
  canvas: HTMLCanvasElement,
  getExpanded: () => number,
  getScene: () => SceneTextureState,
  options: RendererOptions = {},
) {
  let disposed = false;
  let restoreTimeout = 0;
  let stopSession: () => void = () => undefined;

  function startSession() {
    stopSession = startBlackHoleSession(canvas, getExpanded, getScene, {
      ...options,
      onContextLost: waitForContextRestore,
    });
  }

  function restoreSession() {
    window.clearTimeout(restoreTimeout);
    restoreTimeout = 0;
    if (disposed) return;
    stopSession();
    startSession();
  }

  function waitForContextRestore() {
    if (disposed) return;
    canvas.addEventListener("webglcontextrestored", restoreSession, { once: true });
    window.clearTimeout(restoreTimeout);
    restoreTimeout = window.setTimeout(() => {
      canvas.removeEventListener("webglcontextrestored", restoreSession);
      options.onError?.("WebGL2 上下文丢失且未能恢复，请检查显卡驱动或 WebView2。");
    }, 5000);
  }

  startSession();
  return () => {
    disposed = true;
    window.clearTimeout(restoreTimeout);
    canvas.removeEventListener("webglcontextrestored", restoreSession);
    stopSession();
  };
}