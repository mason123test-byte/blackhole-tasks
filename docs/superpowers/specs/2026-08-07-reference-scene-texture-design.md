# Reference-style scene-texture lensing design

## Goal

Match the visual architecture of `s0xDk/ghostty-blackhole` while keeping BlackHole Tasks' real DOM Pointer Events and never restoring Canvas2D.

## Approved boundaries

- WebGL2 remains mandatory; no Canvas2D fallback.
- Tasks, editing controls, completion buttons, and cross-quadrant dragging remain real DOM.
- Status, quadrant, and priority selects stay removed.
- The black hole stays anchored at the four-quadrant center.
- Runtime, build, screenshots, and interaction verification run only on GitHub-hosted `windows-latest`.

## Architecture

The reference shader receives Ghostty's already-rasterized terminal surface as `iChannel0`. BlackHole Tasks will provide the equivalent source as a GPU texture without calling Canvas2D:

1. Build an SVG scene snapshot containing the terminal field, quadrant guides, and non-editing task rows.
2. Decode it with WebView2's image pipeline and upload the result directly to a WebGL texture.
3. Sample that texture from the reference far-field and near-field geodesic mappings.
4. Keep the interactive DOM above/below the transparent WebGL layer as appropriate; the canvas has `pointer-events: none`.
5. Keep editing controls outside the rasterized snapshot so text input remains crisp and accessible.

## Rendering details

- Port the reference finite-camera weak-field handoff instead of cutting the shader off outside the disk.
- Use the reference 48-step leapfrog integration for balanced and high profiles.
- Preserve Inferno disk geometry and multi-scale wrapped streak noise.
- Correct straight-alpha output so dim disk filaments are not attenuated twice by WebView2 composition.
- Refresh the scene texture only when size, expansion state, or task visual data changes.
- Discard stale asynchronous bitmap generations using a monotonically increasing revision.

## Interaction smoke fix

The Windows smoke script will derive the close-button point from the centered toolbar's actual CSS geometry rather than the removed layout's `74% / 45px` coordinate.

## Verification

- Unit tests prove SVG escaping, task/quadrant inclusion, scene-texture shader wiring, and continued absence of Canvas2D.
- Windows CI runs npm checks, Rust checks, Tauri installer builds, and the native interaction smoke.
- Windows artifacts provide compact and expanded WebView2 screenshots for visual review.
