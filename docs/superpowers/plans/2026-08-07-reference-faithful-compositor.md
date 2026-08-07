# Reference-Faithful Black-Hole Compositor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the visually divergent adapted black-hole shader with a reference-faithful Inferno core and premultiplied transparent WebView2 composition.

**Architecture:** Move shader source and invariant metadata into a focused module. Keep SVG-to-ImageBitmap scene input and the existing explicit framebuffer, but output premultiplied color directly and let the WebView2 compositor consume it once; the renderer remains responsible for WebGL lifecycle and DOM-independent scheduling.

**Tech Stack:** TypeScript 6, Vitest 4, WebGL2/GLSL ES 3.00, React 19, Tauri 2, PowerShell Windows UI smoke, GitHub Actions `windows-latest`.

---

## File map

- Create `src/shader/referenceBlackHoleShader.ts`: reference-faithful vertex/fragment sources and immutable renderer metadata.
- Create `src/shader/referenceBlackHoleShader.test.ts`: shader architecture and visual-invariant regression tests.
- Modify `src/shader/blackHoleRenderer.ts`: import shader module, remove physical-pass application effects, use premultiplied canvas composition, and keep renderer lifecycle.
- Modify `src/shader/blackHoleRenderer.test.ts`: import shared metadata through the public renderer export and preserve render-profile checks.
- Modify `src/shader/renderBoundary.test.ts`: include the extracted shader module in the no-Canvas2D boundary.
- Modify `scripts/windows-interaction-smoke.ps1`: log deterministic center-crop color evidence from compact and expanded screenshots without adding a flaky hard-coded artistic threshold.
- Modify `.github/workflows/windows-build.yml`: upload the visual-evidence log with existing smoke artifacts if the script creates it.

### Task 1: Establish the failing reference-invariant tests

**Files:**
- Create: `src/shader/referenceBlackHoleShader.test.ts`
- Modify: `src/shader/renderBoundary.test.ts`

- [ ] **Step 1: Add the shader invariant test before production code**

Create `src/shader/referenceBlackHoleShader.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  REFERENCE_BLACK_HOLE_FRAGMENT,
  REFERENCE_BLACK_HOLE_INFO,
} from "./referenceBlackHoleShader";

describe("reference-faithful black-hole shader", () => {
  it("keeps the Ghostty Inferno integration and trace boundary", () => {
    expect(REFERENCE_BLACK_HOLE_INFO).toEqual({
      model: "schwarzschild-geodesic",
      integrationSteps: 48,
      tracePadding: 3,
      starGain: 0,
      sceneInput: "svg-gpu-texture",
      alphaMode: "premultiplied-coverage",
      reference: "https://github.com/s0xDk/ghostty-blackhole",
    });
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("#define N_STEPS 48");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float bmax = DISK_OUTER + 3.0;");
  });

  it("keeps application animation out of the physical light calculation", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("u_hover");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("u_pulse");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("u_detail");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("pulseLight");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("stars(escapedDirection)");
  });

  it("outputs premultiplied coverage without straight-alpha division", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "outColor = vec4(min(premultiplied, vec3(coverage)), coverage);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toMatch(/\/\s*coverage/);
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("straightColor");
  });
});
```

Add `"./referenceBlackHoleShader.ts"` to `sourceFiles` in `src/shader/renderBoundary.test.ts`.

- [ ] **Step 2: Commit the RED tests**

```powershell
git add src/shader/referenceBlackHoleShader.test.ts src/shader/renderBoundary.test.ts
git commit -m "test: define reference shader invariants"
git push origin HEAD:agent/initial-blackhole-tasks
```

- [ ] **Step 3: Verify RED on GitHub Windows**

Run on `windows-latest`:

```powershell
npm ci
npm run test -- src/shader/referenceBlackHoleShader.test.ts
```

Expected: FAIL because `./referenceBlackHoleShader` does not exist. Record the failing run URL before adding production code.

### Task 2: Extract the faithful shader and integrate premultiplied composition

**Files:**
- Create: `src/shader/referenceBlackHoleShader.ts`
- Modify: `src/shader/blackHoleRenderer.ts`
- Modify: `src/shader/blackHoleRenderer.test.ts`

- [ ] **Step 1: Create the shader module with stable public metadata**

Start `src/shader/referenceBlackHoleShader.ts` with:

```ts
export const REFERENCE_BLACK_HOLE_VERTEX = `#version 300 es
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

export const REFERENCE_BLACK_HOLE_INFO = Object.freeze({
  model: "schwarzschild-geodesic",
  integrationSteps: 48,
  tracePadding: 3,
  starGain: 0,
  sceneInput: "svg-gpu-texture",
  alphaMode: "premultiplied-coverage",
  reference: "https://github.com/s0xDk/ghostty-blackhole",
});

export const REFERENCE_BLACK_HOLE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_expanded;
uniform sampler2D u_scene_texture;
uniform float u_scene_ready;

#define PI 3.14159265359
#define B_CRIT 2.5980762
#define N_STEPS 48

const float DISK_INNER = 1.8;
const float DISK_OUTER = 8.0;
const float DISK_INCL = 1.50;
const float DISK_ROLL = 0.35;
const float DISK_GAIN = 2.2;
const float DISK_OPACITY = 0.9;
const float DISK_TEMP = 5500.0;
const float DOPPLER_MIX = 0.6;
const float DISK_BEAM = 2.5;
const float DISK_SPEED = 5.0;
const float DISK_WIND = 7.0;
const float DISK_CONTRAST = 1.6;
const float EXPOSURE = 1.4;
`;
```

Complete the fragment with the reference `hash21`, wrapped value noise, rotation, mirrored UV, and blackbody helpers. Port the reference near-field loop exactly with:

```glsl
float bmax = DISK_OUTER + 3.0;
float cameraZ = max(14.0, DISK_OUTER + 5.0);
for (int i = 0; i < N_STEPS; i++) {
  float radius2 = dot(position, position);
  if (radius2 < 1.0) { captured = true; break; }
  if (position.z < -cameraZ && velocity.z < 0.0) break;
  if (radius2 > 4.0 * cameraZ * cameraZ) break;
  float radius = sqrt(radius2);
  float dt = clamp(0.16 * radius, 0.03, 1.5);
  vec3 acceleration = -1.5 * angularMomentum2 * position
    / (radius2 * radius2 * radius);
  velocity += acceleration * (0.5 * dt);
  position += velocity * dt;
  radius2 = dot(position, position);
  radius = sqrt(radius2);
  acceleration = -1.5 * angularMomentum2 * position
    / (radius2 * radius2 * radius);
  velocity += acceleration * (0.5 * dt);
  // Keep the reference thin-disk crossing, temperature, Doppler,
  // beaming, opacity, and multiple-crossing accumulation equations here.
}
```

Use reference constants directly for disk pattern time and emission:

```glsl
float swirl = diskRadius * DISK_WIND * 0.12
  - u_time * kepler * DISK_SPEED * localTime;
streaks = 0.35 + DISK_CONTRAST * streaks * streaks;
shift = mix(1.0, shift, DOPPLER_MIX);
emission += transmittance * diskColor
  * (DISK_GAIN * 2.2 * density
    * temperatureProfile * temperatureProfile * boost);
transmittance *= 1.0 - clamp(DISK_OPACITY * density, 0.0, 1.0);
vec3 diskLight = vec3(1.0) - exp(-emission * EXPOSURE);
```

Replace straight-alpha reconstruction with direct premultiplied composition:

```glsl
float sceneCoverage = sceneReady
  * smoothstep(0.02, 0.22, lensWindow)
  * towardScene;
float diskCoverage = max(
  max(max(diskLight.r, diskLight.g), diskLight.b),
  1.0 - transmittance
);
float shadowCoverage = captured ? 1.0 : 0.0;
float coverage = clamp(
  max(shadowCoverage, max(sceneCoverage, diskCoverage)),
  0.0,
  1.0
);
vec3 premultiplied = sceneColor * sceneCoverage * transmittance
  + diskLight;
outColor = vec4(min(premultiplied, vec3(coverage)), coverage);
```

For the weak-field branch, sample the scene with the reference finite-camera displacement, set coverage from the lens window, premultiply once, and return. Do not add star or pulse light.

- [ ] **Step 2: Reduce `blackHoleRenderer.ts` to lifecycle responsibilities**

Import and re-export the shader metadata:

```ts
import {
  REFERENCE_BLACK_HOLE_FRAGMENT,
  REFERENCE_BLACK_HOLE_INFO,
  REFERENCE_BLACK_HOLE_VERTEX,
} from "./referenceBlackHoleShader";

export const BLACK_HOLE_RENDERER_INFO = REFERENCE_BLACK_HOLE_INFO;
```

Compile `REFERENCE_BLACK_HOLE_VERTEX` and `REFERENCE_BLACK_HOLE_FRAGMENT`. Change the WebGL2 context attribute to:

```ts
premultipliedAlpha: true,
```

The uniform map must contain only:

```ts
const uniforms = {
  resolution: gl.getUniformLocation(program, "u_resolution"),
  time: gl.getUniformLocation(program, "u_time"),
  expanded: gl.getUniformLocation(program, "u_expanded"),
  sceneTexture: gl.getUniformLocation(program, "u_scene_texture"),
  sceneReady: gl.getUniformLocation(program, "u_scene_ready"),
};
```

Keep `getHover` and `getPulse` only for frame-rate scheduling and existing component API compatibility. Do not upload them to the physical shader. Keep `RGBA8` for this first faithful baseline because the shader tone-maps before output and the design forbids depending on float-render-target support.

- [ ] **Step 3: Preserve renderer tests**

Update `src/shader/blackHoleRenderer.test.ts` so the metadata assertion includes:

```ts
expect(BLACK_HOLE_RENDERER_INFO).toMatchObject({
  model: "schwarzschild-geodesic",
  integrationSteps: 48,
  tracePadding: 3,
  starGain: 0,
  sceneInput: "svg-gpu-texture",
  alphaMode: "premultiplied-coverage",
});
```

- [ ] **Step 4: Commit the GREEN implementation**

```powershell
git add src/shader/referenceBlackHoleShader.ts src/shader/blackHoleRenderer.ts src/shader/blackHoleRenderer.test.ts
git commit -m "feat: render reference-faithful black hole"
git push origin HEAD:agent/initial-blackhole-tasks
```

- [ ] **Step 5: Verify focused GREEN on GitHub Windows**

```powershell
npm ci
npm run test -- src/shader/referenceBlackHoleShader.test.ts src/shader/blackHoleRenderer.test.ts src/shader/renderBoundary.test.ts
npm run typecheck
npm run lint
```

Expected: all focused tests pass, type-check exits 0, and lint exits 0.

### Task 3: Add native Windows visual evidence without brittle artistic gates

**Files:**
- Modify: `scripts/windows-interaction-smoke.ps1`

- [ ] **Step 1: Add a center-crop evidence function**

Add a PowerShell function that loads an already captured PNG, samples the scene-center `240x180` region, and writes deterministic counts:

```powershell
function Write-BlackHoleColorEvidence(
  [string]$ScreenshotPath,
  $Window,
  [string]$Label,
  [string]$EvidencePath
) {
  $bitmap = [System.Drawing.Bitmap]::FromFile($ScreenshotPath)
  try {
    $centerX = [int](($Window.ClientBounds.Left + $Window.ClientBounds.Right) / 2)
    $centerY = [int](($Window.ClientBounds.Top + $Window.ClientBounds.Bottom) / 2)
    $left = [Math]::Max(0, $centerX - 120)
    $top = [Math]::Max(0, $centerY - 90)
    $right = [Math]::Min($bitmap.Width - 1, $centerX + 119)
    $bottom = [Math]::Min($bitmap.Height - 1, $centerY + 89)
    $warm = 0
    $neutralBright = 0
    $dark = 0
    $luminous = 0
    for ($y = $top; $y -le $bottom; $y += 2) {
      for ($x = $left; $x -le $right; $x += 2) {
        $pixel = $bitmap.GetPixel($x, $y)
        if ($pixel.R -gt 96 -or $pixel.G -gt 96 -or $pixel.B -gt 96) {
          $luminous++
        }
        if ($pixel.R -ge 120 -and
            $pixel.R -gt $pixel.G + 15 -and
            $pixel.G -gt $pixel.B + 15) {
          $warm++
        }
        if ($pixel.R -ge 210 -and $pixel.G -ge 210 -and $pixel.B -ge 210 -and
            ([Math]::Max($pixel.R, [Math]::Max($pixel.G, $pixel.B)) -
             [Math]::Min($pixel.R, [Math]::Min($pixel.G, $pixel.B))) -lt 18) {
          $neutralBright++
        }
        if ($pixel.R -lt 35 -and $pixel.G -lt 35 -and $pixel.B -lt 35) {
          $dark++
        }
      }
    }
    "label=$Label luminous=$luminous warm=$warm neutralBright=$neutralBright dark=$dark crop=$left,$top,$right,$bottom" |
      Add-Content -Path $EvidencePath
  } finally {
    $bitmap.Dispose()
  }
}
```

Call it immediately after compact and expanded screenshots are saved. Treat the output as review evidence, not a pass/fail threshold, until accepted screenshots establish stable Windows baselines.

- [ ] **Step 2: Run the native smoke in the normal Windows build**

```powershell
npm run tauri build
./scripts/windows-interaction-smoke.ps1 `
  -ExePath "src-tauri/target/release/blackhole-tasks.exe" `
  -OutputDirectory "output/windows-smoke"
```

Expected: the script exits 0 and `output/windows-smoke/black-hole-color-evidence.txt` contains compact and expanded rows.

- [ ] **Step 3: Commit the evidence logging**

```powershell
git add scripts/windows-interaction-smoke.ps1
git commit -m "test: record Windows black-hole color evidence"
git push origin HEAD:agent/initial-blackhole-tasks
```

### Task 4: Full Windows verification and visual review

**Files:**
- Verify only; modify production files only through a new RED-GREEN cycle if a defect is found.

- [ ] **Step 1: Run the complete Windows verification**

```powershell
npm ci
npm run typecheck
npm run lint
npm run test
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri build
./scripts/windows-interaction-smoke.ps1 `
  -ExePath "src-tauri/target/release/blackhole-tasks.exe" `
  -OutputDirectory "output/windows-smoke"
```

Expected: every command exits 0; the smoke proves renderer readiness and all task interactions.

- [ ] **Step 2: Inspect artifacts**

Download and inspect:

- compact orb screenshot;
- expanded four-quadrant screenshot;
- interaction screenshots after create, drag, complete, delete, close, and reopen;
- `black-hole-color-evidence.txt`;
- NSIS and MSI artifacts.

Confirm manually:

- black center remains black;
- upper and lower lensed disk images are both visible;
- the disk retains orange/amber filaments instead of becoming a flat white wedge;
- Doppler asymmetry remains visible;
- background task texture bends without a circular handoff seam;
- DOM controls and drag targets remain crisp and interactive.

- [ ] **Step 3: Request code review**

Review the diff from `794e66e341d93e9ee4cde963b955606b487d6f8e` to the final head against the approved design. Resolve every Critical or Important finding before reporting completion.

- [ ] **Step 4: Report final evidence**

Provide the final commit SHA, GitHub Actions run URL, exact test counts, installer artifact names, screenshot artifact names, observed color-evidence rows, and any remaining WebView2/GPU variability.
