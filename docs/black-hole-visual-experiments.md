# Black-hole visual experiment log

This file records Windows-validated black-hole visual tuning experiments on `agent/initial-blackhole-tasks`.

## Rules

- `#479` is the current accepted visual baseline until a later Windows artifact is explicitly accepted.
- Geometry is frozen: do not change `DISK_OUTER`, `OBSERVER_THETA`, Kerr/geodesic stepping, disk crossing structure, BH/disk/observer geometry, or use screen-space geometry patches.
- No Canvas2D, framebuffer mirror/flip, copied lower half, fake annulus, alternate fallback renderer, or `screen.y` upper/lower hard patches.
- One experiment changes one main photometric variable or one independent visual layer.
- Shader implementation and its test must be committed atomically.
- A candidate is not accepted until the Windows visual workflow succeeds and the actual artifact screenshots are opened and compared.

## Accepted baseline history

### #473 — geometry compromise accepted
- Commit: `3ec58116fb952f62a3edde360eee682f1e59aca0`
- `DISK_OUTER=35M`.
- Geometry compromise accepted; geometry frozen after this point.

### #475 — warm filmic highlight response
- Commit: `f765aa8ab137e088a44caae7dea76bdfd2b85df8`
- Warm ivory / pale-gold highlight response and protected veiling flare.
- Direction accepted; flare remained conservative.

### #479 — current visual baseline
- Commit: `8e83056d29f6bda610700dba6ca09be9e89fd7a4`
- Added `flareCoreReject = 1.0 - 0.82 * smoothstep(0.56, 0.82, basePeak)`.
- Result: retained the stronger outer veil while preventing the direct disk core from becoming thick and overexposed.
- Accepted as the current baseline.

## Rejected / low-value experiments

### #477 — stronger veiling flare without enough core rejection
- Commit: `e991501b4e8e844c6c7440731983aee9c8880394`
- Result: flare became more visible, but direct core thickness rose strongly and overexposed pixels increased substantially.
- Verdict: rejected.
- Do not repeat: simple global increases of near/mid/far flare weights without core protection.

### #481 — far-flare radius LOD 7.0
- Commit: `d39da653d6ad8397f30980b603fb05f825219f87`
- Change: far flare LOD `6.0 -> 7.0`.
- Result: energy spread too broadly; visible warm coverage and lower brightness slightly decreased with little visual benefit.
- Verdict: rejected.
- Do not repeat: far flare LOD `7.0`.

### #483 — far-flare radius LOD 6.5
- Commit: `7dfe8f1c73c6b3fbbbec73323e92e067f056fcf8`
- Change: far flare LOD `7.0 -> 6.5`.
- Result: better than 7.0, but still no clear advantage over #479; gains were below meaningful visual threshold.
- Verdict: not accepted.
- Do not spend more rounds on fine LOD radius sweeps around `6.0–7.0` unless another layer changes the flare response materially.

### #485 — first LOD1 micro-contrast shoulder experiment
- Commit: `0dca9fa5875855a64b47558bda6fed484b9e75a5`
- Result: only a very small core-thickness reduction; visually difficult to distinguish.
- Verdict: low value.

### #487 — `microShoulder=0.88`
- Commit: `988f26321beb801ab13daa679ac2d53497491db5`
- Result: slightly cleaner/thinner direct core, but change remained too small.
- Verdict: not accepted.

### #489 — `microShoulder=0.78`
- Commit: `2d48ac8abd08a32e47ecd81c75d0e0f079361866`
- Result: core became thinner, but warm highlight coverage, lower brightness, and overall photographic richness fell.
- Verdict: rejected as a baseline replacement.
- Do not repeat: pushing negative-detail shoulder suppression below `0.88`; `0.78` is specifically known to be too dry.

### #491 — isolated positive-detail core, `microCore=0.28`
- Commit: `40b64c24788c87804a9a8e6702e213c52b661ed6`
- Removed shoulder suppression from the main path and isolated positive-detail core response.
- Result: warm/flare richness recovered compared with #489, but direct-core thinning/peak separation was still too small to beat #479.
- Verdict: direction valid, strength insufficient.

### #493 — isolated positive-detail core, `microCore=0.42`
- Commit: `808251557aa232756e239978630aa9344d295ef0`
- Change: peak-only mix strength `0.28 -> 0.42` with the same white-point target.
- Result: high-intensity pixels increased slightly, but core thickness stayed effectively unchanged and the visual difference remained small.
- Verdict: not accepted.
- Do not repeat: simply raising `microCore` mix strength above `0.42`; evidence indicates it increases peak intensity more than ridge separation.

### #513 — isotropic four-neighbor local ridge selector
- Visual-code HEAD: `7f2729b9147e20787ac6c51d464edcc112d47ea2`
- Windows run: `#513` / `32253449518`; artifact `9365521120`.
- Selector: four direct texture neighbors, `ridgeDetail = max(basePeak - ridgeNeighborPeak, 0.0)`.
- Parameters: ridge-detail gate `0.018 -> 0.075`, base-peak gate `0.58 -> 0.88`, white-point target `basePeak * 1.10`, ridge mix `0.24`.
- #479 flare LOD 6.0, `flareCoreReject`, warm tone, glow weights, shadow protection, and physical geometry were unchanged.
- Same-definition #479 -> #513 measurements: direct-core average thickness `2.202 -> 2.237 px`, median `2 -> 2 px`, core horizontal coverage `89 -> 93 px`, `>180` pixels `204 -> 217`, lower bright count `9290 -> 9291`, warm coverage `26022 -> 26018`, dead-white pixels `0 -> 0`.
- Result: surrounding warm/lower light was preserved, but the ridge did not become visibly more knife-edge; high-intensity coverage increased slightly and the core became marginally wider rather than narrower.
- Verdict: low value / not accepted. `#479` remains baseline.
- Do not repeat this exact selector parameter set: `0.018–0.075 / 0.58–0.88 / 1.10 / 0.24`.

### #517 — directional vertical-thinness + horizontal-continuity selector
- Commit: `fcc4ac51387d96dc52b8b73e0ec9234e89786cf8`.
- Windows run: `#517` / `32255050216`; artifact `9366336438`.
- Replaced #513 isotropic center-vs-four-neighbor average with directional shape tests: `ridgeVerticalThinness = max(basePeak - 0.5 * (ridgeUpPeak + ridgeDownPeak), 0.0)` plus `ridgeHorizontalContinuity = min(ridgeLeftPeak, ridgeRightPeak)`.
- Kept #513 amplification fixed so only selector shape changed: thinness gate `0.018 -> 0.075`, base gate `0.58 -> 0.88`, white-point target `basePeak * 1.10`, mix `0.24`; added horizontal-continuity gate `0.40 -> 0.76`.
- #479 far flare LOD 6.0, `flareCoreReject`, warm tone, glow weights, shadow protection, and all physical geometry were unchanged.
- Same-definition #479 / #513 / #517 measurements: core average thickness `2.211 / 2.245 / 2.229 px`; median `2 / 2 / 2 px`; core horizontal coverage `90 / 94 / 96 px`; `>180` pixels `199 / 211 / 214`; lower bright count `9270 / 9272 / 9270`; warm coverage `25992 / 25986 / 25983`; dead-white `0 / 0 / 0`.
- Result: directional selection preserved lower/warm light and shadow, but did not create a visibly thinner knife-edge core. It slightly reduced average thickness versus #513 while widening high-intensity horizontal coverage beyond both #513 and #479.
- Verdict: rejected / low value. `#479` remains baseline.
- Do not repeat this exact directional selector: vertical thinness `0.018–0.075` + horizontal continuity `0.40–0.76` + base gate `0.58–0.88` with `1.10 / 0.24` amplification.

## Current exclusions / lessons

1. Do not increase global flare weights to create cinematic flare; it thickens the core unless independently protected.
2. Do not keep sweeping far-flare LOD `6.0–7.0`; benefit is below the useful threshold in the current compositor.
3. Do not use negative-detail shoulder suppression as the main way to thin the disk; values around `0.78` make the image dry and reduce lower/warm light.
4. Do not keep raising `microCore` scalar strength; `0.28 -> 0.42` raised peak brightness without materially narrowing the core.
5. The isotropic 4-neighbor ridge selector preserved surrounding light but slightly widened the high-intensity core; do not repeat the exact #513 gate/target/mix values.
6. The first directional vertical-thinness + horizontal-continuity selector also widened high-intensity horizontal coverage; do not repeat the exact #517 gate combination or simply raise its mix.
7. Favor a mechanism that changes the *response curve inside already-selected hot pixels* or uses multi-scale ridge width evidence, rather than another one-pixel-neighbor peak detector.
8. Any accepted replacement must beat #479 visually while preserving its warm veil, lower brightness, shadow cleanliness, and frozen geometry.

## Operational validation notes

- #499 was not a visual verdict: validation stopped at TypeScript because a renderer syntax typo was introduced during experiment preparation. The ridge parameters were not changed when fixing it.
- #511 was not a visual verdict: typecheck/lint passed, but one unrelated diagnostic-frame test assertion contained a text typo (`sonst` instead of `const`). The ridge-specific test itself passed. The ridge parameters were not changed when fixing it.
- Temporary placeholder files created during recovery were deleted by forward commits; they were tooling mistakes and are not visual experiments.
- #513 was the first valid Windows visual run for the four-neighbor ridge experiment.
- #517 passed frontend typecheck/lint/tests, Rust fast checks, Tauri EXE build, native Windows visual capture, and artifact upload; candidate/baseline/split/expanded screenshots were opened directly.

## Next experiment target

Do not continue by simply increasing #517 mix strength or lowering its gates. Prefer either a multi-scale width selector (for example comparing 1-pixel and 2-pixel vertical curvature while preserving horizontal support) or a narrow highlight response curve that changes peak-to-shoulder contrast without globally dimming the shoulder. Keep #479 flare/core guard, warm tone, shadow protection, and all physical geometry unchanged.
