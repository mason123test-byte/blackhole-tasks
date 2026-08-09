# Strict Inferno Rendering and Fallback Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the default Inferno black hole at native Windows canvas resolution and delete the retired or no-effect fallback paths without changing DOM task interaction boundaries.

**Architecture:** Keep the reference shader and SVG → ImageBitmap → WebGL2 input texture, but make the drawing buffer match the actual client size and keep the explicit Windows-proven FBO as a 1:1 compositor boundary. Reduce the scheduler to one requestAnimationFrame owner, convert all render failures into explicit errors, and delete dead compatibility, pulse, reload, multi-window, and smoke retry paths.

**Tech Stack:** React 19, TypeScript, Vitest, WebGL2/GLSL ES 3.0, Tauri 2/Rust, PowerShell Win32 smoke automation, GitHub Actions `windows-latest`.

---

## File Map

- Modify `src/shader/blackHoleRenderer.ts`: native render size, functional quality profile, one-frame scheduler, explicit failure semantics.
- Modify `src/shader/blackHoleRenderer.test.ts`: native-size and profile contracts.
- Create `src/shader/fallbackBoundary.test.ts`: source-boundary assertions for removed fallbacks.
- Modify `src/components/orb/BlackHoleCanvas.tsx`: remove hover/pulse plumbing.
- Delete `src/components/orb/GravitySceneTexture.tsx`: unused null compatibility export.
- Modify `src/app/OrbApp.tsx`: remove no-effect pulse state/listener and convert center control to decoration.
- Modify `src/shader/sceneTexture.ts`: add a subtle deterministic terminal field around the lens while retaining actual task content.
- Modify `src/shader/sceneTexture.test.ts`: assert dense lens input and XML safety.
- Modify `src-tauri/src/lib.rs`: remove pulse emission and both compile-disabled legacy modules.
- Modify `scripts/windows-interaction-smoke.ps1`: remove retry clicks, clean smoke files, and record compact/expanded drawing-buffer evidence.
- Modify `README.md`: replace stale 480×360 and fallback claims with the verified native-resolution behavior.

### Task 1: Lock the Native-Resolution and No-Fallback Contracts

**Files:**
- Modify: `src/shader/blackHoleRenderer.test.ts`
- Create: `src/shader/fallbackBoundary.test.ts`

- [ ] **Step 1: Add a failing native-size test**

Update the renderer test import and add:

```ts
import {
  BLACK_HOLE_RENDERER_INFO,
  getRenderProfile,
  getRenderSize,
} from "./blackHoleRenderer";

it("renders the Windows scene at client resolution without a fixed backing-buffer cap", () => {
  expect(getRenderSize(920, 700, 1, 1.25)).toEqual({ width: 920, height: 700 });
  expect(getRenderSize(920, 700, 1.5, 1.25)).toEqual({ width: 1150, height: 875 });
  expect(getRenderSize(240, 180, 1, 1)).toEqual({ width: 240, height: 180 });
});
```

- [ ] **Step 2: Add a failing fallback-boundary test**

Create `src/shader/fallbackBoundary.test.ts` with complete source assertions:

```ts
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

describe("strict Inferno fallback boundary", () => {
  it("contains no fixed low-resolution, pulse, reload, or bootstrap fallback", () => {
    const renderer = read("./blackHoleRenderer.ts");
    const canvas = read("../components/orb/BlackHoleCanvas.tsx");
    const app = read("../app/OrbApp.tsx");
    expect(renderer).not.toMatch(/MAX_RENDER_|renderScale|blackhole-webgl-context-retries/);
    expect(renderer).not.toMatch(/bootstrapTimers|getHover|getPulse|detail:/);
    expect(renderer).not.toContain("window.location.reload()");
    expect(canvas).not.toMatch(/hovered|pulse/);
    expect(app).not.toMatch(/orb:render-pulse|setPulse|pulseTimer/);
  });

  it("contains no retired compatibility modules or retry clicks", () => {
    const rust = read("../../src-tauri/src/lib.rs");
    const smoke = read("../../scripts/windows-interaction-smoke.ps1");
    expect(rust).not.toContain("#[cfg(any())]");
    expect(rust).not.toContain("orb:render-pulse");
    expect(smoke).not.toContain("RETRY_");
    expect(existsSync(fileURLToPath(new URL(
      "../components/orb/GravitySceneTexture.tsx",
      import.meta.url,
    )))).toBe(false);
  });
});
```

- [ ] **Step 3: Run the Windows RED build**

Commit only the tests to `agent/initial-blackhole-tasks`. GitHub Actions command set:

```powershell
npm ci
npm run typecheck
npm run lint
npm test -- --run
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: Vitest fails because `getRenderSize` is missing and the audited fallback strings/files still exist.

- [ ] **Step 4: Commit the RED boundary**

```bash
git add src/shader/blackHoleRenderer.test.ts src/shader/fallbackBoundary.test.ts
git commit -m "test: require native strict Inferno rendering"
```

### Task 2: Render at Native Resolution with One Scheduler Owner

**Files:**
- Modify: `src/shader/blackHoleRenderer.ts`
- Modify: `src/shader/blackHoleRenderer.test.ts`

- [ ] **Step 1: Replace the profile and size calculation**

Use only functional fields:

```ts
export interface RenderProfile {
  fps: number;
  pixelRatioCap: number;
}

export function getRenderProfile(quality: RenderQuality, lowPowerMode = false): RenderProfile {
  if (lowPowerMode || quality === "low") return { fps: 12, pixelRatioCap: 1 };
  if (quality === "high") return { fps: 40, pixelRatioCap: 1.5 };
  return { fps: 30, pixelRatioCap: 1.25 };
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
```

Resize with `getRenderSize(canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio, profile.pixelRatioCap)` and remove all fixed render caps.

- [ ] **Step 2: Remove hover/pulse scheduling and bootstrap timers**

Change `startBlackHole` to:

```ts
export function startBlackHole(
  canvas: HTMLCanvasElement,
  getExpanded: () => number,
  getScene: () => SceneTextureState,
  options: RendererOptions = {},
)
```

Use `1000 / profile.fps` for the frame interval. Replace six timers with one forced-render function:

```ts
const forceRender = () => {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  render(performance.now(), true);
};

forceRender();
```

No timer collection remains. Visibility changes are the only later start/stop boundary.

- [ ] **Step 3: Make scene and context failures terminal**

Introduce a single `failed` boolean used by `schedule` and `render`. On scene texture failure:

```ts
failed = true;
if (animationFrame) cancelAnimationFrame(animationFrame);
animationFrame = 0;
const message = error instanceof Error ? error.message : String(error);
options.onError?.(`无法生成黑洞场景纹理：${message}`);
```

On `webglcontextlost`, stop scheduling and call:

```ts
failed = true;
options.onError?.("WebGL2 上下文已丢失，请检查显卡驱动或 WebView2 后重启应用。");
```

Delete context-restored reload handling and retry session storage.

- [ ] **Step 4: Update profile expectations and run GREEN tests on Windows**

Expected profile assertions:

```ts
expect(getRenderProfile("low")).toEqual({ fps: 12, pixelRatioCap: 1 });
expect(getRenderProfile("balanced")).toEqual({ fps: 30, pixelRatioCap: 1.25 });
expect(getRenderProfile("high")).toEqual({ fps: 40, pixelRatioCap: 1.5 });
```

Expected: renderer tests pass; fallback boundary still fails until Tasks 3 and 4.

- [ ] **Step 5: Commit**

```bash
git add src/shader/blackHoleRenderer.ts src/shader/blackHoleRenderer.test.ts
git commit -m "fix: render Inferno at native resolution"
```

### Task 3: Remove No-Effect UI and Add Readable Lens Input

**Files:**
- Modify: `src/components/orb/BlackHoleCanvas.tsx`
- Modify: `src/app/OrbApp.tsx`
- Delete: `src/components/orb/GravitySceneTexture.tsx`
- Modify: `src/shader/sceneTexture.ts`
- Modify: `src/shader/sceneTexture.test.ts`

- [ ] **Step 1: Remove hover and pulse props**

`BlackHoleCanvasProps` keeps only:

```ts
interface BlackHoleCanvasProps {
  expanded: boolean;
  quality: RenderQuality;
  lowPowerMode: boolean;
  tasks: SceneTextureTask[];
  editingTaskId: string | null;
  onError?(message: string): void;
}
```

Keep `expandedRef` and `sceneRef`; call `startBlackHole(ref.current, () => expandedRef.current, () => sceneRef.current, options)`.

- [ ] **Step 2: Remove the no-effect pulse UI**

Delete pulse state, timer, listener, and props from `OrbApp.tsx`. Replace the clickable center button with decoration:

```tsx
<div className="gravity-center-control" aria-hidden="true">
  <span>BLACKHOLE</span><small>drag task → quadrant</small>
</div>
```

- [ ] **Step 3: Add deterministic terminal-field lens guides**

In `buildSceneTextureSvg`, calculate task counts and build low-opacity source rows:

```ts
const counts = Object.fromEntries(
  QUADRANTS.map((quadrant) => [quadrant, tasks.filter((task) => task.quadrant === quadrant).length]),
) as Record<Quadrant, number>;
const lensRows = Array.from({ length: 11 }, (_, index) => {
  const y = 74 + index * Math.max(34, (height - 120) / 10);
  const text = `$ gravity.field/${String(index).padStart(2, "0")} q1:${counts.q1} q2:${counts.q2} q3:${counts.q3} q4:${counts.q4}`;
  return `<text x="${Math.max(18, centerX - 235)}" y="${y}" fill="#7897a1" fill-opacity=".12">${text}</text>`;
}).join("");
```

Insert it as `<g data-lens-field="terminal-guides">${lensRows}</g>` behind the actual quadrant/task markup. It is scene input only and has no events.

- [ ] **Step 4: Test the lens input**

Add:

```ts
it("provides a dense terminal field for readable lens displacement", () => {
  const svg = buildSceneTextureSvg(snapshot);
  expect(svg).toContain('data-lens-field="terminal-guides"');
  expect(svg.match(/gravity\.field\//g)).toHaveLength(11);
  expect(svg).toContain("q1:1 q2:0 q3:0 q4:0");
});
```

Run Windows Vitest; expected: scene texture and component boundary tests pass.

- [ ] **Step 5: Delete the null compatibility file and commit**

```bash
git rm src/components/orb/GravitySceneTexture.tsx
git add src/components/orb/BlackHoleCanvas.tsx src/app/OrbApp.tsx src/shader/sceneTexture.ts src/shader/sceneTexture.test.ts
git commit -m "refactor: remove no-effect black-hole UI paths"
```

### Task 4: Delete Retired Rust and Smoke Retry Paths

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `scripts/windows-interaction-smoke.ps1`

- [ ] **Step 1: Remove retired Rust code**

Delete the `orb:render-pulse` emit from `complete_task`. Delete both complete blocks beginning with:

```rust
#[rustfmt::skip]
#[cfg(any())]
mod legacy_multi_window_coordination
```

and:

```rust
#[rustfmt::skip]
#[cfg(any())]
mod legacy_cursor_monitor
```

No function from either module is present in `generate_handler!`, so no replacement is added.

- [ ] **Step 2: Remove smoke click retries**

Replace every `try/catch` retry around `Wait-SceneCompact` or `Wait-SceneSize` with one condition wait. Keep startup diagnostic `catch`, JSON partial-write retry, and state polling because they capture evidence rather than repeat a user action.

The persistence close becomes exactly:

```powershell
Invoke-SceneCloseClick $expanded "persistence"
$orb = Wait-SceneCompact $process.Id 300 230 10000
```

The 12 resize cycles issue one `Invoke-SmokeToggle` per transition and one wait per expected state.

- [ ] **Step 3: Clean smoke transport files**

At startup remove a stale snapshot if present. In `finally`, remove the marker, command, and snapshot files after copying diagnostics:

```powershell
Remove-Item -LiteralPath $diagnosticMarkerPath, $smokeCommandPath, $smokeSnapshotPath -Force -ErrorAction SilentlyContinue
```

- [ ] **Step 4: Run Rust and boundary tests on Windows**

Expected: Rustfmt, Clippy, three Rust tests, and `fallbackBoundary.test.ts` pass. `rg '#\[cfg\(any\(\)\)\]|RETRY_|orb:render-pulse'` returns no matches in the scoped files.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs scripts/windows-interaction-smoke.ps1 src/shader/fallbackBoundary.test.ts
git commit -m "refactor: delete retired rendering fallbacks"
```

### Task 5: Windows Visual Proof and Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-08-09-strict-inferno-fallback-removal.md`

- [ ] **Step 1: Run the full Windows pipeline**

Require one uncancelled run on the final code head with all workflow steps green. Expected first-frame sizes are at least `240×180` compact and `920×700` expanded at 100% runner DPI.

- [ ] **Step 2: Inspect artifacts**

Download the smoke artifact and inspect compact, expanded, created, dragged, completed, persisted, and deleted screenshots. Compare the expanded close-up with the Inferno panel in `s0xDk/ghostty-blackhole/presets-grid.png`.

- [ ] **Step 3: Reject unchanged visuals**

If disk filaments remain broad or the terminal field does not visibly bend, change only the confirmed failing boundary—DPR/render size first, lens-field opacity second—and rerun Windows CI. Do not change physical Inferno constants to mask a sampling problem.

- [ ] **Step 4: Update README with actual evidence**

Record only the run ID, actual framebuffer sizes, test counts, interaction evidence, artifact names, and visually observed comparison from the successful final run. Remove stale `480×345`/`480×360` claims.

- [ ] **Step 5: Mark plan checkboxes and commit docs**

```bash
git add README.md docs/superpowers/plans/2026-08-09-strict-inferno-fallback-removal.md
git commit -m "docs: record native Inferno Windows evidence"
```

- [ ] **Step 6: Final independent review**

Review the final diff for Critical/Important issues, confirm no Canvas2D, dropdown, or DOM Pointer Events regressions, and leave PR #1 in Draft until the user accepts the new Windows screenshot.
