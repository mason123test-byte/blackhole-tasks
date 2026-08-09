# Strict Inferno Rendering and Fallback Removal Design

Date: 2026-08-09  
Repository: `mason123test-byte/blackhole-tasks`  
Branch: `agent/initial-blackhole-tasks`

## Goal

Make the visible black-hole result materially match the current default Inferno look in `s0xDk/ghostty-blackhole`, while preserving the BlackHole Tasks product boundaries:

- WebGL2 only; no Canvas2D path.
- DOM quadrants, task rows, editors, and Pointer Events remain interactive.
- Do not restore status, quadrant, or priority dropdowns.
- All runtime, build, interaction, and screenshot verification runs on GitHub-hosted `windows-latest`.

The result is accepted only when a fresh Windows artifact shows native-resolution disk filaments, a clean photon ring and shadow, warm Inferno falloff, Doppler asymmetry, and readable lensing of the task-field texture. Passing compilation alone is insufficient.

## Observed Root Causes

1. The expanded `920×700` canvas is capped at `480×360`. Browser scaling destroys the small disk filaments and turns the reference structure into broad white bands.
2. The scene input texture is sparse, so the reference effect's defining background distortion is difficult to read even though the geodesic equations are present.
3. Several compatibility and retry paths no longer serve the current architecture. Some are dead, while others hide first-frame or interaction failures.
4. Hover and pulse state no longer reaches the physical shader. It only changes the scheduler FPS and therefore presents a control with no visible effect.

## Rendering Architecture

### Native-resolution render target

The WebGL drawing buffer will follow the real canvas client size multiplied by the selected device-pixel-ratio cap. The fixed `MAX_RENDER_WIDTH` and `MAX_RENDER_HEIGHT` reduction and `renderScale` path will be removed.

The explicit RGBA8 framebuffer remains because Windows WebView2 DirectComposition evidence showed that default-framebuffer readback can be empty even when the submitted frame is visible. The framebuffer and default canvas will have the same dimensions, making the blit a 1:1 copy rather than an upscale path.

Balanced quality remains the default. Low-power and high quality may change FPS and DPR caps, but they will not change geodesic integration steps or physical shader constants.

### Strict Inferno shader contract

`referenceBlackHoleShader.ts` remains the single physical shader source. Its target is the reference repository's current default Inferno values and equations:

- 48-step leapfrog Schwarzschild integration.
- `DISK_INNER = 1.8`, `DISK_OUTER = 8.0` and trace boundary `outer + 3.0`.
- Inclination `1.50`, roll `0.35`, 5500 K temperature, Doppler mix `0.60`, beam exponent `2.5`, gain `2.2`, opacity `0.90`, exposure `1.40`.
- Continuous finite-camera far/near handoff.
- Premultiplied coverage required by the transparent WebView.

Demo drift, token growth, preset touring, starfield, hover glow, and pulse light are out of scope.

### Scene texture

The existing SVG → `createImageBitmap` → WebGL2 upload stays. It is not a Canvas2D fallback; it is the WebGL equivalent of Ghostty's `iChannel0`.

The texture will keep the actual non-editing task rows and quadrant labels, but its terminal-field structure will be made dense enough for the lens displacement to be visible around the hole. Live inputs and the editing task remain DOM-only and are excluded from the bitmap.

Scene texture creation failure will call the application error boundary. Expanded mode will not silently continue with an unlensed disk-only substitute.

## Removed Paths

The implementation will delete, rather than rename or retain behind feature flags:

1. `MAX_RENDER_WIDTH`, `MAX_RENDER_HEIGHT`, and `renderScale`.
2. The unused `RenderProfile.detail` field and its tests.
3. `hovered`, `pulse`, `getHover`, and `getPulse` plumbing that only changes FPS.
4. The `orb:render-pulse` listener/emission and the no-effect center pulse click behavior.
5. `GravitySceneTexture.tsx`, whose compatibility component always returns `null` and has no callers.
6. The `#[cfg(any())] legacy_cursor_monitor` module, which can never compile.
7. Context-loss session retry counters and automatic page reload. Context loss becomes a clear terminal render error.
8. The six delayed bootstrap render timers. They are replaced by one owned scheduling path that cannot create parallel requestAnimationFrame chains.
9. Windows smoke retry branches that repeat failed close/toggle clicks. A missed first interaction must fail the run and preserve evidence.
10. Stale README claims tied to the `480×360` framebuffer or removed fallback behavior.

## Retained Mechanisms

The following are deliberately retained because they are required behavior or have direct Windows evidence:

- Explicit texture-backed framebuffer and frame readback diagnostics.
- SVG scene texture and ImageBitmap revision guard.
- ResizeObserver, visibility pause/resume, resource disposal, and explicit shader errors.
- Windows smoke database snapshot sequence checks and condition polling.
- Real Win32 mouse/keyboard actions and DOM Pointer Events drag.
- A bounded WebView2 cold-start timeout that reports process, log, and diagnostic evidence.

These mechanisms do not substitute a lower-quality render or convert a failed assertion into success.

## Scheduler and Failure Semantics

There will be one requestAnimationFrame owner. Visibility changes may cancel or request that single frame. A forced first render may cancel an already pending frame before drawing, but it may not start an additional chain.

Failure behavior is explicit:

- WebGL2 unavailable: render error shown.
- Shader compile/link or framebuffer failure: render error shown.
- Scene texture generation failure in expanded mode: render error shown.
- Context lost: animation stops and render error shown; no reload loop.
- Windows input miss or state mismatch: smoke fails immediately after the existing condition timeout; no second click is issued.

## Verification

### Contract tests

- Native-resolution calculation has no fixed `480×360` cap.
- Render profiles contain only functional fields.
- Renderer API contains no hover/pulse parameters.
- No Canvas2D symbols appear in the rendering boundary.
- The compile-disabled legacy module and null compatibility component are absent.
- Bootstrap scheduling cannot create more than one pending animation frame.
- Shader Inferno constants and 48-step geodesic invariants remain fixed.

### Windows runtime verification

A fresh `windows-latest` run must pass:

- frontend typecheck, lint, Vitest, and production build;
- Rustfmt, Clippy with warnings denied, and Rust tests;
- Tauri EXE, NSIS, and MSI builds;
- native WebView2 WebGL2 first-frame proof at compact and expanded native drawing-buffer sizes;
- create Q1 → Pointer Events drag to Q2 → complete → collapse/reopen persistence → delete;
- repeated expand/collapse resource stability without retry clicks.

### Visual verification

The Windows artifact must include compact, expanded, and interaction screenshots. The expanded close-up will be compared side by side with the reference Inferno panel. Review will explicitly check:

- filament resolution rather than broad white bands;
- black shadow and thin photon-ring boundary;
- upper and lower lensed disk images;
- warm-white-to-amber temperature gradient;
- Doppler brightness asymmetry;
- visible bending of scene-texture lines and text;
- absence of a near/far handoff seam.

If the visual result remains effectively unchanged, the task is not complete even if CI passes.

## Risks

- Native resolution increases fragment work. The fixed 48-step physics stays unchanged; FPS and DPR caps remain the only performance controls.
- Removing reload and click retries makes genuine failures more visible and may initially expose flaky assumptions. Those failures must be diagnosed from evidence rather than hidden by another retry.
- A denser SVG scene texture must not duplicate interactive DOM strongly enough to reduce readability. Its opacity and content density are visual inputs, not alternate controls.

## Acceptance Boundary

The branch remains a Draft PR until the new Windows screenshots are reviewed by the user. No merge, Ready-for-review transition, or release action is included in this change.
