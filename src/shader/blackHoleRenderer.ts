import type { RenderQuality } from "../types/settings";

const vertex = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

// Standalone approximation inspired by the visual structure of ghostty-blackhole:
// event horizon, photon ring, inclined accretion disk, lensed upper/lower arcs,
// Doppler brightness and sparse bent star streaks. It deliberately avoids the
// reference shader's per-pixel geodesic integration so a 96px always-on-top
// Windows WebView stays responsive.
const fragment = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_hover;
uniform float u_pulse;
uniform float u_detail;

#define PI 3.14159265359

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise21(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + 1.0), f.x), f.y);
}

vec2 rotate2(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

float gaussian(float value, float width) {
  return exp(-value * value * width);
}

void main() {
  vec2 p = v_uv * 2.0 - 1.0;
  p.x *= u_resolution.x / max(u_resolution.y, 1.0);

  float time = u_time * mix(0.34, 0.72, u_hover);
  float breathe = 1.0 + 0.014 * sin(u_time * 1.35) + u_hover * 0.028;
  p /= breathe;
  vec2 diskP = rotate2(p, -0.17);
  float radius = length(p);
  float horizonRadius = 0.235;

  float horizon = 1.0 - smoothstep(horizonRadius - 0.008, horizonRadius + 0.008, radius);
  float photonRing = gaussian(radius - horizonRadius * 1.075, 1250.0);
  float innerHalo = gaussian(radius - horizonRadius * 1.20, 150.0);
  float outerHalo = gaussian(radius - 0.49, 22.0);

  float diskRadius = length(vec2(diskP.x, diskP.y * 4.2));
  float diskBounds = smoothstep(0.28, 0.36, diskRadius) * (1.0 - smoothstep(0.83, 0.98, diskRadius));
  float sheetWidth = 0.030 + 0.095 * smoothstep(0.12, 0.82, abs(diskP.x));
  float sheet = gaussian(diskP.y + 0.018 * sin(diskP.x * 12.0 - time * 2.0), 1.0 / max(sheetWidth * sheetWidth, 0.0004));
  float frontDisk = diskBounds * sheet;

  // The far side of the disk is lensed over and under the shadow. This pair
  // of arcs is the feature that makes the object read as a black hole rather
  // than a glowing planet or a flat ring.
  float archHeight = 0.075 + 0.245 * exp(-diskP.x * diskP.x * 8.0);
  float archDistance = abs(abs(diskP.y) - archHeight);
  float archMask = (1.0 - smoothstep(0.58, 0.92, abs(diskP.x)))
                 * smoothstep(horizonRadius * 0.94, horizonRadius * 1.18, radius);
  float lensedArcs = gaussian(archDistance, 820.0) * archMask;

  float angle = atan(diskP.y * 4.2, diskP.x);
  float radialGrain = noise21(vec2(diskRadius * 18.0 - time * 0.7, angle * 8.0 + time * 1.6));
  float filaments = 0.44 + 0.56 * pow(radialGrain, 2.0);
  filaments *= 0.78 + 0.22 * sin(angle * 23.0 - diskRadius * 31.0 + time * 3.0);
  filaments = mix(0.78, filaments, u_detail);

  float doppler = mix(0.55, 1.48, smoothstep(-0.70, 0.70, -diskP.x));
  float diskLight = (frontDisk * 1.05 + lensedArcs * 1.20) * filaments * doppler * (1.0 - horizon);
  vec3 hot = mix(vec3(1.0, 0.31, 0.055), vec3(1.0, 0.91, 0.69), smoothstep(0.2, 1.35, doppler));
  vec3 diskColor = hot * diskLight * mix(1.25, 1.72, u_hover);

  float coolRim = photonRing * smoothstep(-0.2, 0.8, diskP.x);
  vec3 ringColor = vec3(1.0, 0.72, 0.34) * photonRing * 1.35
                 + vec3(0.32, 0.62, 0.92) * coolRim * 0.30;

  vec2 polarGrid = vec2(atan(p.y, p.x) / (2.0 * PI) * 42.0, radius * 62.0 - time * 0.28);
  float starCell = hash21(floor(polarGrid));
  float stars = smoothstep(0.965, 0.997, starCell)
              * gaussian(fract(polarGrid.y) - 0.5, 70.0)
              * smoothstep(0.30, 0.42, radius)
              * (1.0 - smoothstep(0.72, 0.98, radius))
              * u_detail;
  vec3 starColor = mix(vec3(1.0, 0.56, 0.22), vec3(0.38, 0.66, 1.0), hash21(floor(polarGrid) + 3.7));

  float pulseRing = gaussian(radius - mix(0.30, 0.73, 1.0 - u_pulse), 260.0) * u_pulse;
  vec3 emission = diskColor + ringColor
                + vec3(0.93, 0.46, 0.14) * innerHalo * 0.16
                + vec3(0.18, 0.43, 0.73) * outerHalo * 0.10
                + starColor * stars * 0.72
                + vec3(1.0, 0.55, 0.18) * pulseRing * 1.3;
  emission = vec3(1.0) - exp(-emission * 1.18);

  float lightAlpha = max(max(emission.r, emission.g), emission.b);
  float alpha = max(horizon * 0.995, clamp(lightAlpha * 1.12, 0.0, 0.94));
  alpha *= 1.0 - smoothstep(0.82, 1.02, radius);
  vec3 color = emission * (1.0 - horizon);
  outColor = vec4(color, alpha);
}`;

export interface RenderProfile {
  idleFps: number;
  activeFps: number;
  pixelRatioCap: number;
  detail: number;
}

export function getRenderProfile(quality: RenderQuality, lowPowerMode = false): RenderProfile {
  if (lowPowerMode || quality === "low") {
    return { idleFps: 15, activeFps: 30, pixelRatioCap: 1, detail: 0.28 };
  }
  if (quality === "high") {
    return { idleFps: 30, activeFps: 60, pixelRatioCap: 2, detail: 1 };
  }
  return { idleFps: 24, activeFps: 45, pixelRatioCap: 1.35, detail: 0.68 };
}

interface RendererOptions {
  quality?: RenderQuality;
  lowPowerMode?: boolean;
}

export function startBlackHole(
  canvas: HTMLCanvasElement,
  getHover: () => number,
  getPulse: () => number,
  options: RendererOptions = {},
) {
  const profile = getRenderProfile(options.quality ?? "balanced", options.lowPowerMode);
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: options.lowPowerMode ? "low-power" : "default",
  });
  if (!gl) return startCanvasFallback(canvas, getHover, getPulse, profile);

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
    const vertexShader = compile(gl.VERTEX_SHADER, vertex);
    const fragmentShader = compile(gl.FRAGMENT_SHADER, fragment);
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

    const buffer = gl.createBuffer();
    if (!buffer) throw new Error("无法创建黑洞顶点缓冲区");
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(program);

    const uniforms = {
      resolution: gl.getUniformLocation(program, "u_resolution"),
      time: gl.getUniformLocation(program, "u_time"),
      hover: gl.getUniformLocation(program, "u_hover"),
      pulse: gl.getUniformLocation(program, "u_pulse"),
      detail: gl.getUniformLocation(program, "u_detail"),
    };

    canvas.dataset.renderer = "webgl2";
    canvas.dataset.quality = options.lowPowerMode ? "low-power" : (options.quality ?? "balanced");
    let animationFrame = 0;
    let disposed = false;
    let lastFrameAt = 0;
    let nextFrameAt = 0;
    let startedAt = performance.now();
    let hoverValue = getHover();
    let measuredFrames = 0;
    let measuredAt = startedAt;
    let needsResize = true;

    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => { needsResize = true; });
    resizeObserver?.observe(canvas);

    const schedule = () => {
      if (!disposed && !document.hidden && animationFrame === 0) {
        animationFrame = requestAnimationFrame(render);
      }
    };
    const render = (now: number) => {
      animationFrame = 0;
      if (disposed || document.hidden) return;
      const targetHover = getHover();
      const fps = targetHover > 0.01 || getPulse() > 0.01 ? profile.activeFps : profile.idleFps;
      const frameInterval = 1000 / fps;
      if (nextFrameAt !== 0 && now + 0.5 < nextFrameAt) {
        schedule();
        return;
      }
      const delta = Math.min(1, (now - lastFrameAt) / 1000);
      lastFrameAt = now;
      nextFrameAt = nextFrameAt === 0 || now - nextFrameAt > frameInterval * 3
        ? now + frameInterval
        : nextFrameAt + frameInterval;
      hoverValue += (targetHover - hoverValue) * Math.min(1, delta * 9);

      if (needsResize) {
        const dpr = Math.min(window.devicePixelRatio || 1, profile.pixelRatioCap);
        const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
        const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        needsResize = false;
      }

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.time, (now - startedAt) / 1000);
      gl.uniform1f(uniforms.hover, hoverValue);
      gl.uniform1f(uniforms.pulse, getPulse());
      gl.uniform1f(uniforms.detail, profile.detail);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

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
      canvas.dataset.renderer = "context-lost";
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onVisibility);
    canvas.addEventListener("webglcontextlost", onContextLost);
    schedule();

    return () => {
      disposed = true;
      if (animationFrame) cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  } catch (error) {
    console.error("WebGL2 黑洞初始化失败，已切换 Canvas 2D：", error);
    return startCanvasFallback(canvas, getHover, getPulse, profile);
  }
}

function startCanvasFallback(
  canvas: HTMLCanvasElement,
  getHover: () => number,
  getPulse: () => number,
  profile: RenderProfile,
) {
  const context = canvas.getContext("2d");
  if (!context) return () => undefined;
  canvas.dataset.renderer = "canvas2d";
  let animationFrame = 0;
  let disposed = false;
  let lastFrameAt = 0;
  let startedAt = performance.now();

  const schedule = () => {
    if (!disposed && !document.hidden && animationFrame === 0) animationFrame = requestAnimationFrame(render);
  };
  const render = (now: number) => {
    animationFrame = 0;
    if (disposed || document.hidden) return;
    const active = getHover() > 0.01 || getPulse() > 0.01;
    const fps = Math.min(active ? profile.activeFps : profile.idleFps, 20);
    if (now - lastFrameAt < 1000 / fps) {
      schedule();
      return;
    }
    lastFrameAt = now;
    const dpr = Math.min(window.devicePixelRatio || 1, profile.pixelRatioCap);
    const width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    const scale = Math.min(width, height);
    const cx = width / 2;
    const cy = height / 2;
    const time = (now - startedAt) / 1000;
    context.clearRect(0, 0, width, height);
    context.save();
    context.translate(cx, cy);
    context.rotate(-0.17);
    context.globalCompositeOperation = "lighter";
    for (let layer = 0; layer < 5; layer += 1) {
      context.beginPath();
      context.ellipse(0, 0, scale * (0.23 + layer * 0.023), scale * (0.055 + layer * 0.008), 0, 0, Math.PI * 2);
      context.strokeStyle = `rgba(255,${130 + layer * 18},${45 + layer * 13},${0.35 - layer * 0.045})`;
      context.lineWidth = Math.max(1, scale * 0.018);
      context.setLineDash([scale * 0.035, scale * 0.012]);
      context.lineDashOffset = -time * scale * (0.04 + layer * 0.01);
      context.stroke();
    }
    context.setLineDash([]);
    context.globalCompositeOperation = "source-over";
    const horizon = context.createRadialGradient(0, 0, 0, 0, 0, scale * 0.16);
    horizon.addColorStop(0, "rgba(0,0,0,1)");
    horizon.addColorStop(0.72, "rgba(0,0,0,1)");
    horizon.addColorStop(0.82, "rgba(255,184,78,.95)");
    horizon.addColorStop(0.88, "rgba(55,104,157,.28)");
    horizon.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = horizon;
    context.beginPath();
    context.arc(0, 0, scale * 0.18, 0, Math.PI * 2);
    context.fill();
    context.restore();
    schedule();
  };
  const onVisibility = () => {
    if (document.hidden) {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    } else {
      startedAt += Math.max(0, performance.now() - lastFrameAt);
      lastFrameAt = 0;
      schedule();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  schedule();
  return () => {
    disposed = true;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
