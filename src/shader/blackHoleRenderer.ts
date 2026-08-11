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
uniform float u_visual_compare;
out vec4 outColor;

void main() {
  vec4 baseFrame = texture(u_frame_texture, v_uv);
  vec4 mirroredFrame = texture(u_frame_texture, vec2(v_uv.x, 1.0 - v_uv.y));
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 referenceUv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec2 screen = (referenceUv - 0.5) * vec2(aspect, 1.0);
  float lowerHalf = 1.0 - step(0.5, v_uv.y);
  float mirrorMask = lowerHalf * (1.0 - smoothstep(0.43, 0.47, length(screen)));
  float candidateWeight = u_visual_compare < 0.5
    ? 0.0
    : (u_visual_compare > 1.5 ? step(0.0, screen.x) : 1.0);
  outColor = mix(baseFrame, mirroredFrame, mirrorMask * candidateWeight);
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
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    // WebView2 can create this transparent surface while its native window is
    // still hidden. Preserve the submitted frame until the first visible
    // compositor/readback handshake has proved that real pixels exist.
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
    };
    gl.uniform1i(uniforms.sceneTexture, 0);
    const compositorUniforms = {
      resolution: gl.getUniformLocation(compositorProgram, "u_resolution"),
      frameTexture: gl.getUniformLocation(compositorProgram, "u_frame_texture"),
      visualCompare: gl.getUniformLocation(compositorProgram, "u_visual_compare"),
    };
    gl.useProgram(compositorProgram);
    gl.uniform1i(compositorUniforms.frameTexture, 1);
    gl.uniform1f(compositorUniforms.visualCompare, visualComparison.shaderMode);
    gl.useProgram(program);

    // Ghostty provides iChannel0. Here WebView2 decodes an SVG task-field
    // snapshot and uploads it directly to this texture; Canvas2D is never used.
    const sceneTexture = gl.createTexture();
    if (!sceneTexture) throw new Error("无法创建黑洞场景纹理");
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));

    // Render into an explicit texture-backed framebuffer first. WebView2's
    // transparent DirectComposition default framebuffer can return zeroes from
    // readPixels even when the submitted frame is visible. The explicit target
    // gives both the native smoke probe and the compositor the same shader
    // output: validate it here, then composite it to the window surface below.
    const outputTexture = gl.createTexture();
    const outputFramebuffer = gl.createFramebuffer();
    if (!outputTexture || !outputFramebuffer) throw new Error("无法创建黑洞输出帧缓冲");
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, outputTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
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
        const { width, height } = getRenderSize(
          canvas.clientWidth,
          canvas.clientHeight,
          window.devicePixelRatio,
          profile.pixelRatioCap,
        );
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
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

      // The orb WebView is created hidden. Some WebView2/CI combinations keep
      // requestAnimationFrame suspended until focus changes, so prove that a
      // real geodesic frame exists and expose the result through the native
      // window title used by the Windows smoke probe.
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
        const diagnostic = `a${alphaEnergy}-m${maxChannel}-am${maxAlpha}-e${glError}-f${framebufferStatus}`;
        canvas.dataset.energy = String(energy);
        canvas.dataset.diagnostic = diagnostic;
        reportOrbFrame("webgl2", energy, canvas.width, canvas.height, diagnostic);
        rendererReady = energy > 100;
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
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.activeTexture(gl.TEXTURE0);

      measuredFrames += 1;
      if (now - measuredAt >= 1000) {
        canvas.dataset.fps = String(Math.round(measuredFrames * 1000 / (now - measuredAt)));
        measuredFrames = 0;
        measuredAt = now;
      }
      schedule();
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
