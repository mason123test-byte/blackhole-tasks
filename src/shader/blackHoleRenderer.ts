import { invoke } from "@tauri-apps/api/core";
import type { RenderQuality } from "../types/settings";

const vertex = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

// Adapted for a transparent desktop WebView from s0xDk/ghostty-blackhole's
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
uniform float u_expanded;
uniform sampler2D u_scene_texture;
uniform float u_has_scene;

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

void rayTracedReference() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 screen = (v_uv - 0.5) * vec2(aspect, 1.0);

  // On the 240x180 transparent stage this gives a ~54px shadow and lets the
  // r=8 disk nearly fill the height, matching the reference composition.
  float breathe = 1.0 + 0.012 * sin(u_time * 1.15) + 0.045 * u_hover;
  float shadowRadius = mix(0.150, 0.085, u_expanded) * breathe;
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
  float sceneAlpha = 0.0;
  if (!captured) {
    vec3 escapedDirection = normalize(velocity);
    sky = stars(escapedDirection) * 0.16 * u_detail;
    if (u_has_scene > 0.5 && escapedDirection.z < -0.05) {
      float projection = (-13.0 - position.z) / escapedDirection.z;
      vec3 scenePoint = position + escapedDirection * projection;
      vec2 unrolled = rotate2(scenePoint.xy, -DISK_ROLL) / worldScale;
      vec2 sceneUv = 0.5 + vec2(unrolled.x, -unrolled.y) / vec2(aspect, 1.0);
      if (all(greaterThanEqual(sceneUv, vec2(0.0))) && all(lessThanEqual(sceneUv, vec2(1.0)))) {
        vec4 taskLayer = texture(u_scene_texture, sceneUv);
        sky += taskLayer.rgb * taskLayer.a;
        sceneAlpha = taskLayer.a;
      }
    }
  }
  vec3 diskLight = vec3(1.0) - exp(-emission * mix(1.35, 1.60, u_hover));

  float pulseRadius = mix(shadowRadius * 1.18, shadowRadius * 3.0, 1.0 - u_pulse);
  float pulseDistance = abs(length(screen) - pulseRadius);
  vec3 pulseLight = vec3(1.0, 0.45, 0.12)
    * exp(-pulseDistance * pulseDistance * 1800.0) * u_pulse;
  // Keep disk emission in front of both escaped and captured rays. Captured
  // rays remove only the background; dropping their accumulated emission was
  // the reason earlier builds rendered a clipped bright wedge.
  vec3 color = sky * transmittance + diskLight;
  color += pulseLight;

  float lightAlpha = max(max(color.r, color.g), color.b);
  float diskOpacity = 1.0 - transmittance;
  float alpha = captured ? 0.997 : clamp(max(max(lightAlpha, diskOpacity), sceneAlpha * transmittance), 0.0, 0.97);
  alpha = max(alpha, max(max(pulseLight.r, pulseLight.g), pulseLight.b));
  outColor = vec4(clamp(color, 0.0, 1.0), alpha);
}

void main() {
  rayTracedReference();
}`;

export const BLACK_HOLE_RENDERER_INFO = Object.freeze({
  model: "schwarzschild-geodesic",
  integrationSteps: 48,
  reference: "https://github.com/s0xDk/ghostty-blackhole",
});
const BLACK_HOLE_STAGE_WIDTH = 240;
const BLACK_HOLE_STAGE_HEIGHT = 180;
const MAX_RENDER_WIDTH = 480;
const MAX_RENDER_HEIGHT = 360;

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
  idleFps: number;
  activeFps: number;
  pixelRatioCap: number;
  detail: number;
}

export function getRenderProfile(quality: RenderQuality, lowPowerMode = false): RenderProfile {
  if (lowPowerMode || quality === "low") {
    return { idleFps: 12, activeFps: 24, pixelRatioCap: 1, detail: 0.22 };
  }
  if (quality === "high") {
    return { idleFps: 24, activeFps: 40, pixelRatioCap: 1.5, detail: 1 };
  }
  return { idleFps: 18, activeFps: 30, pixelRatioCap: 1.25, detail: 0.60 };
}

interface RendererOptions {
  quality?: RenderQuality;
  lowPowerMode?: boolean;
  onError?(message: string): void;
}

export function startBlackHole(
  canvas: HTMLCanvasElement,
  getHover: () => number,
  getPulse: () => number,
  getExpanded: () => number,
  getSceneTexture: () => HTMLCanvasElement | null,
  options: RendererOptions = {},
) {
  const profile = getRenderProfile(options.quality ?? "balanced", options.lowPowerMode);
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
      expanded: gl.getUniformLocation(program, "u_expanded"),
      sceneTexture: gl.getUniformLocation(program, "u_scene_texture"),
      hasScene: gl.getUniformLocation(program, "u_has_scene"),
    };
    const sceneTexture = gl.createTexture();
    if (!sceneTexture) throw new Error("无法创建四象限场景纹理");
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    gl.uniform1i(uniforms.sceneTexture, 0);

    // Render into an explicit texture-backed framebuffer first. WebView2's
    // transparent DirectComposition default framebuffer can return zeroes from
    // readPixels even when the submitted frame is visible. The explicit target
    // gives both the native smoke probe and the compositor the same shader
    // output: validate it here, then blit it to the window surface below.
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
    let hoverValue = getHover();
    let measuredFrames = 0;
    let measuredAt = startedAt;
    let needsResize = true;
    let readbackAttempts = 0;
    let rendererReady = false;
    let uploadedSceneVersion = "";
    let contextLost = false;
    let bootstrapTimers: number[] = [];

    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => { needsResize = true; });
    resizeObserver?.observe(canvas);

    const schedule = () => {
      if (!disposed && !document.hidden && animationFrame === 0) {
        animationFrame = requestAnimationFrame(render);
      }
    };
    const render = (now: number, force = false) => {
      animationFrame = 0;
      if (disposed || contextLost || (!force && document.hidden)) return;
      const targetHover = getHover();
      const fps = targetHover > 0.01 || getPulse() > 0.01 ? profile.activeFps : profile.idleFps;
      const frameInterval = 1000 / fps;
      if (!force && nextFrameAt !== 0 && now + 0.5 < nextFrameAt) {
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
        const desiredWidth = Math.max(BLACK_HOLE_STAGE_WIDTH, canvas.clientWidth) * dpr;
        const desiredHeight = Math.max(BLACK_HOLE_STAGE_HEIGHT, canvas.clientHeight) * dpr;
        // The editable DOM remains at native window resolution. Only cap the
        // ray-traced backing buffer so a 920x700 scene cannot multiply the
        // geodesic workload enough to reset WebView2's GPU process.
        const renderScale = Math.min(1, MAX_RENDER_WIDTH / desiredWidth, MAX_RENDER_HEIGHT / desiredHeight);
        const width = Math.round(desiredWidth * renderScale);
        const height = Math.round(desiredHeight * renderScale);
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
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.time, (now - startedAt) / 1000);
      gl.uniform1f(uniforms.hover, hoverValue);
      gl.uniform1f(uniforms.pulse, getPulse());
      gl.uniform1f(uniforms.detail, profile.detail);
      gl.uniform1f(uniforms.expanded, getExpanded());
      const sceneSource = getSceneTexture();
      if (sceneSource && sceneSource.width > 0 && sceneSource.height > 0) {
        const sceneVersion = `${sceneSource.width}x${sceneSource.height}:${sceneSource.dataset.version ?? "0"}`;
        if (sceneVersion !== uploadedSceneVersion) {
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sceneSource);
          uploadedSceneVersion = sceneVersion;
        }
        gl.uniform1f(uniforms.hasScene, getExpanded());
      } else {
        gl.uniform1f(uniforms.hasScene, 0);
      }
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
        if (rendererReady) sessionStorage.removeItem("blackhole-webgl-context-retries");
      }

      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, outputFramebuffer);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
      gl.blitFramebuffer(
        0, 0, canvas.width, canvas.height,
        0, 0, canvas.width, canvas.height,
        gl.COLOR_BUFFER_BIT,
        gl.NEAREST,
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

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
      canvas.dataset.renderer = "context-lost";
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      bootstrapTimers.forEach((timer) => window.clearTimeout(timer));
      bootstrapTimers = [];
    };
    const onContextRestored = () => {
      const retryKey = "blackhole-webgl-context-retries";
      const retries = Number(sessionStorage.getItem(retryKey) ?? "0");
      if (retries >= 2) {
        options.onError?.("WebGL2 上下文反复丢失，请更新显卡驱动或 WebView2 后重启。");
        return;
      }
      sessionStorage.setItem(retryKey, String(retries + 1));
      window.location.reload();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onVisibility);
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);
    // Draw even while the native window is still hidden, then repeat around
    // the setup/show boundary. Continuous animation remains visibility-gated.
    bootstrapTimers = [0, 300, 1200, 2500, 5000, 10000].map((delay) => window.setTimeout(() => render(performance.now(), true), delay));

    return () => {
      disposed = true;
      if (animationFrame) cancelAnimationFrame(animationFrame);
      bootstrapTimers.forEach((timer) => window.clearTimeout(timer));
      resizeObserver?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onVisibility);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      gl.deleteBuffer(buffer);
      gl.deleteTexture(sceneTexture);
      gl.deleteFramebuffer(outputFramebuffer);
      gl.deleteTexture(outputTexture);
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
