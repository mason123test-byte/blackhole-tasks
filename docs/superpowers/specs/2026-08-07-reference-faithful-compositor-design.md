# Reference-faithful black-hole compositor design

## Goal

Make BlackHole Tasks visually match the Inferno presentation in `s0xDk/ghostty-blackhole` before adding any extra realism, while preserving the task application's DOM interaction model and Windows-only execution boundary.

## Success criteria

- The compact and expanded black hole retain the reference shadow, photon ring, upper and lower lensed disk images, filament contrast, warm-to-white temperature gradient, and Doppler asymmetry.
- Reference comparison screenshots use the same viewport, render time, expansion state, and task fixture.
- The result does not show the current washed-out white wedge or brightness inflation caused by transparent straight-alpha reconstruction.
- The Windows interaction smoke still proves open, expand, create, cross-quadrant Pointer Events drag, complete, delete, close, and persistence.
- Type-check, lint, frontend tests, Rust checks, Tauri installer build, and native Windows interaction smoke pass on `windows-latest`.

## Non-negotiable boundaries

- Do not use Canvas2D, including as a fallback.
- Keep the SVG-to-`ImageBitmap`-to-WebGL2 scene texture path.
- Keep tasks and all editing interactions as real DOM.
- Keep DOM Pointer Events cross-quadrant dragging.
- Do not restore status, quadrant, or priority selects.
- Keep the black hole centered on the four-quadrant intersection.
- Do not switch to WebGPU or introduce new runtime dependencies.
- Run editing automation, tests, builds, screenshots, and app verification only on GitHub-hosted Windows virtual machines.

## Approaches considered

### A. Continue tuning the adapted shader

This is the smallest change but preserves structural differences from the reference: dynamic step reduction, extra pulse and star light, hover-driven disk timing, altered trace boundary, and RGB reconstruction from transparent alpha. Parameter tuning cannot reliably compensate for those differences.

### B. Faithful reference core with separate coverage composition

This is the selected approach. The physical RGB pass follows the reference shader closely, while a separate coverage signal adapts the opaque Ghostty result to a transparent WebView2 window. This targets visual likeness without changing task interaction or scene-texture architecture.

### C. Replace the tracer with Bruneton lookup tables

Precomputed deflection lookup tables can improve stability and performance, but they alter the rendering architecture and introduce binary assets. This remains a later option if the goal changes from reference likeness to higher physical fidelity.

## Rendering architecture

### Reference-faithful physical pass

The physical fragment shader keeps the reference Inferno behavior:

- fixed 48-step leapfrog integration;
- `bmax = DISK_OUTER + 3.0`;
- finite-camera weak-field handoff;
- reference disk geometry, Shakura-Sunyaev temperature profile, Doppler shift, beaming, opacity, streak noise, exposure, and background projection;
- no default procedural star contribution for Inferno;
- no pulse light in the physical black-hole output;
- no hover-dependent changes to geodesic quality, disk speed, temperature, or exposure.

Application state may still control compact versus expanded shadow radius. A small visual breathing transform may be applied outside the reference equations only if it does not change disk color or integration quality.

### Scene input

The existing SVG snapshot remains the `iChannel0` equivalent. WebView2 decodes it with `createImageBitmap` and uploads it directly to WebGL2. The renderer never calls `getContext("2d")`, `OffscreenCanvasRenderingContext2D`, or another Canvas2D API.

### Transparent WebView2 composition

The reference shader assumes an opaque destination and returns alpha 1. BlackHole Tasks instead needs transparency outside the localized effect.

The renderer therefore separates:

1. physical color: reference background lensing plus tone-mapped disk emission;
2. coverage: localized lens window, captured shadow, disk absorption/emission, and optional application-only transition mask.

The compositor premultiplies physical color exactly once with coverage before presenting it to WebView2. It must not divide HDR or tone-mapped RGB by a small derived alpha inside the physical pass. Captured rays remain visually black through coverage rather than forcing nearly opaque RGB reconstruction.

The initial implementation uses the existing explicit framebuffer. If `EXT_color_buffer_float` is present, the physical target may use `RGBA16F`; otherwise it falls back to `RGBA8` after the reference exponential tone map. No visual feature may depend exclusively on the float extension.

## Component boundaries

- `src/shader/referenceBlackHoleShader.ts`: owns the reference-faithful vertex/fragment shader sources and stable rendering constants.
- `src/shader/blackHoleRenderer.ts`: owns WebGL lifecycle, framebuffer allocation, scene texture uploads, uniforms, scheduling, context-loss recovery, and final presentation.
- `src/shader/referenceBlackHoleShader.test.ts`: asserts the invariant reference features and rejects application-only light inside the physical shader.
- Existing scene-texture and render-boundary tests continue to enforce SVG GPU input and Canvas2D absence.

The split keeps the large shader independently reviewable and prevents WebGL lifecycle code from obscuring reference-equation changes.

## TDD and verification

The Windows workflow performs the change in red-green order:

1. Add failing shader invariant tests for fixed 48 steps, reference trace boundary, disabled Inferno stars, absence of pulse/hover light, and separated coverage output.
2. Run the focused test and record the expected failure.
3. Extract and implement the reference-faithful shader with the smallest renderer changes.
4. Run the focused test and full frontend test suite.
5. Run type-check and lint.
6. Build and launch the native Tauri application on `windows-latest`.
7. Capture compact and expanded screenshots plus the interaction-smoke evidence.
8. Compare screenshots against the checked-in reference target at identical dimensions and deterministic animation time.
9. Run Rust formatting, clippy, tests, and installer build.

## Error handling and fallback

- Shader compilation or framebuffer failures keep the existing renderer failure signal and diagnostic logging.
- Missing float color-buffer support selects the tested `RGBA8` path.
- Scene bitmap generation remains revision-guarded so stale asynchronous snapshots cannot overwrite newer task state.
- Context loss cancels pending frames and recreates renderer resources on restoration.
- The DOM task UI remains usable even if the visual renderer cannot initialize.

## Out of scope

- Kerr rotation, WebGPU, Gaia star catalogs, volumetric 3D accretion media, temporal anti-aliasing, and multi-level bloom.
- Changes to task state, quadrant logic, persistence, editing controls, or Pointer Events behavior.
- New settings or visual tuning controls.

A restrained bloom pass can be evaluated only after the reference-faithful baseline has been accepted.
