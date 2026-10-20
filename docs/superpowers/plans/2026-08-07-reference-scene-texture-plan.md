# Reference-Style Scene Texture Lensing Implementation Plan

> **For agentic workers:** Execute inline on the existing PR branch. All runtime commands and visual verification must run on GitHub-hosted Windows Actions.

**Goal:** Feed a GPU scene texture into the Schwarzschild shader so task-field content bends like Ghostty's `iChannel0`, without Canvas2D or loss of DOM Pointer Events.

**Architecture:** An SVG snapshot of non-editing task visuals is decoded by WebView2 and uploaded directly to a WebGL texture. The existing shader samples it through the reference weak-field and integrated near-field mappings while the real DOM remains the interaction surface.

**Tech Stack:** React 19, TypeScript, WebGL2, SVG/ImageBitmap, Tauri 2, PowerShell, GitHub Actions `windows-latest`.

---

### Task 1: Establish the failing contracts

**Files:**
- Create: `src/shader/sceneTexture.test.ts`
- Modify: `src/shader/renderBoundary.test.ts`
- Modify: `src/shader/blackHoleRenderer.test.ts`

- [ ] Add a test importing `buildSceneTextureSvg`, supplying a task title containing `<&`, and asserting XML escaping plus all four quadrant identifiers.
- [ ] Change the surface-boundary test to require `u_scene_texture` and continue rejecting `getContext("2d")` and `CanvasRenderingContext2D`.
- [ ] Require renderer metadata `sceneInput: "svg-gpu-texture"`.
- [ ] Push the test-only commit and let Windows CI fail because the new module and shader contract do not exist.

### Task 2: Build the source texture without Canvas2D

**Files:**
- Create: `src/shader/sceneTexture.ts`

- [ ] Define `SceneTextureTask`, `SceneTextureSnapshot`, and `buildSceneTextureSvg(snapshot)`.
- [ ] Escape XML with replacements for `& < > " '`.
- [ ] Emit an opaque near-black SVG surface, center axes, four terminal-style quadrant headers, and bounded task rows positioned to match the DOM layout.
- [ ] Exclude the editing task id from the snapshot.
- [ ] Export a stable signature helper so the renderer uploads only changed snapshots.
- [ ] Run the focused Vitest file on Windows and confirm it passes.

### Task 3: Feed the scene texture through the reference lens

**Files:**
- Modify: `src/app/OrbApp.tsx`
- Modify: `src/components/orb/BlackHoleCanvas.tsx`
- Modify: `src/shader/blackHoleRenderer.ts`
- Modify: `src/styles/global.css`

- [ ] Pass visible non-editing task visual data through a ref-backed scene getter.
- [ ] Allocate a WebGL texture on unit 0, build the SVG bitmap asynchronously, upload with `texImage2D`, close the bitmap, and ignore stale revisions.
- [ ] Add `u_scene_texture` and `u_scene_ready`.
- [ ] Port the reference finite-camera weak-field sampling and near-field projected background sampling.
- [ ] Unpremultiply straight-alpha color before WebView2 composition and keep fully captured rays opaque.
- [ ] Use 48 integration steps for balanced/high while preserving the low-power tier.
- [ ] Raise the expanded canvas over quadrant visuals with `pointer-events: none`; keep toolbar, editor, drag ghost, and center control above it.
- [ ] Run typecheck, lint, tests, and build on Windows.

### Task 4: Repair the native close interaction

**Files:**
- Modify: `scripts/windows-interaction-smoke.ps1`

- [ ] Compute centered toolbar width as `Min(560, clientWidth - 64)`.
- [ ] Click near its right edge at the vertical center of the terminal-style toolbar.
- [ ] Log the derived toolbar rectangle and requested/actual cursor position.
- [ ] Keep the retry but recompute bounds before retrying.
- [ ] Verify the scene returns below `300x230` on Windows.

### Task 5: Windows end-to-end verification

**Files:**
- Modify only if evidence requires a focused correction.

- [ ] Run `npm ci`, typecheck, lint, tests, and build.
- [ ] Run Rust format, Clippy, and tests.
- [ ] Build NSIS/MSI packages.
- [ ] Run the native Windows interaction smoke.
- [ ] Inspect compact and expanded screenshots from the Actions artifact.
- [ ] Confirm no `getContext("2d")`, no status/quadrant/priority selects, and Pointer Events drag wiring remains.
- [ ] Review the final GitHub diff against this plan before reporting completion.
