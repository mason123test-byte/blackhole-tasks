import type { RenderQuality } from "../types/settings";

const vertex = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

// Adapted for a transparent 96px WebView from s0xDk/ghostty-blackhole's
// Schwarzschild geodesic tracer (MIT). Unlike the previous painted-ring
// approximation, the shadow, photon ring and upper/lower disk images all come
// from integrating the ray path. The Ghostty terminal texture is intentionally
// omitted because a transparent WebView cannot sample the desktop behind it.
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
#define B_CRIT 2.5980762
#define N_STEPS 48

const float DISK_INNER = 1.8;
const float DISK_OUTER = 8.0;
const float DISK_INCL = 1.50;
const float DISK_ROLL = 0.35;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float vnoiseWrapY(vec2 p, float periodY) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float y0 = mod(i.y, periodY);
  float y1 = mod(i.y + 1.0, periodY);
  return mix(mix(hash21(vec2(i.x, y0)), hash21(vec2(i.x + 1.0, y0)), f.x),
             mix(hash21(vec2(i.x, y1)), hash21(vec2(i.x + 1.0, y1)), f.x), f.y);
}

vec2 rotate2(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

vec3 blackbody(float temperature) {
  float t = clamp(temperature, 1500.0, 40000.0) / 100.0;
  float r = t <= 66.0 ? 1.0 : clamp(1.292936 * pow(t - 60.0, -0.1332047), 0.0, 1.0);
  float g = t <= 66.0
    ? clamp(0.3900816 * log(t) - 0.6318414, 0.0, 1.0)
    : clamp(1.1298909 * pow(t - 60.0, -0.0755148), 0.0, 1.0);
  float b = t >= 66.0
    ? 1.0
    : (t <= 19.0 ? 0.0 : clamp(0.5432068 * log(t - 10.0) - 1.1962540, 0.0, 1.0));
  return vec3(r, g, b);
}

vec3 stars(vec3 direction) {
  vec2 spherical = vec2(atan(direction.x, -direction.z), asin(clamp(direction.y, -1.0, 1.0)));
  vec2 grid = spherical * 34.0;
  vec2 cell = floor(grid);
  float seed = hash21(cell);
  if (seed < 0.955) return vec3(0.0);
  vec2 local = fract(grid) - 0.5;
  vec2 offset = (vec2(hash21(cell + 17.3), hash21(cell + 31.7)) - 0.5) * 0.66;
  float spark = smoothstep(0.11, 0.0, length(local - offset));
  float twinkle = 0.78 + 0.22 * sin(u_time * (0.45 + 1.6 * hash21(cell + 5.1)) + 40.0 * seed);
  vec3 tint = mix(vec3(1.0, 0.78, 0.54), vec3(0.65, 0.78, 1.0), hash21(cell + 2.9));
  return tint * spark * twinkle * ((seed - 0.955) / 0.045);
}

void main() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 screen = (v_uv - 0.5) * vec2(aspect, 1.0);

  // At 96px this gives a ~29px shadow and lets the r=8 disk nearly fill the
  // window, matching the large Inferno/default reference frame.
  float breathe = 1.0 + 0.012 * sin(u_time * 1.15) + 0.045 * u_hover;
  float shadowRadius = 0.150 * breathe;
  float worldScale = B_CRIT / shadowRadius;
  vec2 rayPlane = rotate2(vec2(screen.x, -screen.y), DISK_ROLL) * worldScale;
  float impact = length(rayPlane);

  // Pixels beyond the physical disk stay transparent. A tiny procedural sky
  // remains inside the traced region so gravitational bending is still visible
  // without pretending that we can sample the Windows desktop.
  if (impact > DISK_OUTER + 2.0) {
    outColor = vec4(0.0);
    return;
  }

  float cameraZ = 14.0;
  vec3 position = vec3(rayPlane, cameraZ);
  vec3 velocity = vec3(0.0, 0.0, -1.0);
  float angularMomentum2 = dot(rayPlane, rayPlane);

  float ci = cos(DISK_INCL), si = sin(DISK_INCL);
  vec3 diskNormal = vec3(0.0, si, ci);
  vec3 diskAxis = vec3(0.0, ci, -si);
  vec3 emission = vec3(0.0);
  float transmittance = 1.0;
  bool captured = false;
  float previousSide = dot(position, diskNormal);
  vec3 previousPosition = position;
  int maxSteps = int(mix(24.0, 48.0, u_detail));
  float patternTime = u_time * mix(0.48, 0.82, u_hover);

  for (int i = 0; i < N_STEPS; i++) {
    if (i >= maxSteps) break;
    float radius2 = dot(position, position);
    if (radius2 < 1.0) {
      captured = true;
      break;
    }
    if (position.z < -cameraZ && velocity.z < 0.0) break;
    if (radius2 > 4.0 * cameraZ * cameraZ) break;

    float radius = sqrt(radius2);
    float dt = clamp(0.16 * radius, 0.03, 1.5);
    vec3 acceleration = -1.5 * angularMomentum2 * position / (radius2 * radius2 * radius);
    velocity += acceleration * (0.5 * dt);
    position += velocity * dt;
    radius2 = max(dot(position, position), 0.0001);
    radius = sqrt(radius2);
    acceleration = -1.5 * angularMomentum2 * position / (radius2 * radius2 * radius);
    velocity += acceleration * (0.5 * dt);

    float side = dot(position, diskNormal);
    if (side * previousSide < 0.0 && transmittance > 0.02) {
      float crossing = previousSide / (previousSide - side);
      vec3 diskPoint = mix(previousPosition, position, crossing);
      float diskRadius = length(diskPoint);
      if (diskRadius > DISK_INNER && diskRadius < DISK_OUTER) {
        float band = smoothstep(DISK_INNER, DISK_INNER * 1.25, diskRadius)
          * (1.0 - smoothstep(DISK_OUTER * 0.70, DISK_OUTER, diskRadius));
        float phi = atan(dot(diskPoint, diskAxis), diskPoint.x);
        float turns = phi / (2.0 * PI);
        float kepler = pow(DISK_INNER / diskRadius, 1.5);
        float localTime = sqrt(max(1.0 - 1.5 / diskRadius, 0.02));
        float swirl = diskRadius * 7.0 * 0.12 - patternTime * kepler * 5.0 * localTime;
        float streaks = vnoiseWrapY(vec2(diskRadius * 2.8, turns * 19.0 + swirl * 3.0), 19.0) * 0.65
          + vnoiseWrapY(vec2(diskRadius, turns * 9.0 + swirl * 1.5 + 7.0), 9.0) * 0.35;
        streaks = mix(0.72, 0.35 + 1.6 * streaks * streaks, u_detail);

        vec3 gasDirection = normalize(cross(diskNormal, diskPoint));
        float beta = clamp(inversesqrt(max(2.0 * (diskRadius - 1.0), 0.2)), 0.0, 0.99);
        float shift = localTime / max(1.0 + beta * dot(gasDirection, normalize(velocity)), 0.05);
        shift = mix(1.0, shift, 0.60);
        float profileBase = max(1.0 - sqrt(DISK_INNER / diskRadius), 0.0);
        float temperatureProfile = pow(DISK_INNER / diskRadius, 0.75) * pow(profileBase, 0.25) / 0.488;
        vec3 diskColor = blackbody(5500.0 * temperatureProfile * shift);
        float boost = pow(shift, 2.5);
        float density = band * streaks;
        emission += transmittance * diskColor
          * (4.84 * density * temperatureProfile * temperatureProfile * boost);
        transmittance *= 1.0 - clamp(0.90 * density, 0.0, 1.0);
      }
    }
    previousSide = side;
    previousPosition = position;
  }

  if (!captured && dot(position, position) < 4.0) captured = true;

  vec3 sky = vec3(0.0);
  if (!captured) sky = stars(normalize(velocity)) * 0.16 * u_detail;
  vec3 diskLight = vec3(1.0) - exp(-emission * mix(1.35, 1.60, u_hover));

  float pulseRadius = mix(shadowRadius * 1.18, shadowRadius * 3.0, 1.0 - u_pulse);
  float pulseDistance = abs(length(screen) - pulseRadius);
  vec3 pulseLight = vec3(1.0, 0.45, 0.12)
    * exp(-pulseDistance * pulseDistance * 1800.0) * u_pulse;
  vec3 color = captured ? vec3(0.0) : diskLight + sky;
  color += pulseLight;

  float lightAlpha = max(max(color.r, color.g), color.b);
  float diskOpacity = 1.0 - transmittance;
  float alpha = captured ? 0.997 : clamp(max(lightAlpha, diskOpacity), 0.0, 0.97);
  alpha = max(alpha, max(max(pulseLight.r, pulseLight.g), pulseLight.b));
  outColor = vec4(clamp(color, 0.0, 1.0), alpha);
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
