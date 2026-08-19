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

### #527 — multi-scale 1px/2px ridge-width evidence
- Commit: `d3ef6693649864c0bf876c46342bfa0b71014b70`.
- Windows run: `#527` / `32266998167`; artifact `9370838494`.
- Selector used 1px and 2px vertical curvature gates, then redistributed the existing hot-core contribution with `ridgeHotCoreGain = mix(0.78, 1.20, ridgeWidthEvidence)`.
- Same-definition #479 -> #527 measurements: average core thickness `2.211 -> 2.189 px`, median `2 -> 2 px`, horizontal coverage `90 -> 90 px`, `>180` core pixels `199 -> 197`; lower-bright and warm coverage were effectively unchanged; dead-white remained `0`.
- Result: physically harmless but visually indistinguishable at original size; about 1% core-thickness reduction is below the useful threshold.
- Verdict: rejected / low value.

### #529 — stronger multi-scale ridge redistribution
- Commit: `8529e529db903ea282018fce65ce82d9a2421325`.
- Windows run: `#529` / `32268184738`; artifact `9371326613`.
- Only changed the same multi-scale selector redistribution from `mix(0.78, 1.20, ridgeWidthEvidence)` to `mix(0.60, 1.30, ridgeWidthEvidence)`; all gates, flare, shoulder, warm tone and geometry stayed fixed.
- Same-definition measurements: average bright-core thickness `2.178 px`, median `2 px`, horizontal coverage `90 px`, `>180` core pixels `196`, lower bright `10817`, warm coverage `30806`, dead-white `0`.
- Result: original-size screenshots could not be stably distinguished from #527. The stronger gain produced only about another 0.5% thickness reduction and did not create visible core/glow separation.
- Verdict: rejected. `#479` remains the accepted baseline.
- Do not continue scanning the current multi-scale ridge selector's redistribution/gain range. `0.78–1.20` and `0.60–1.30` have both demonstrated sub-visible returns; the limitation is selector separation, not gain strength.

## Current exclusions / lessons

1. Do not increase global flare weights to create cinematic flare; it thickens the core unless independently protected.
2. Do not keep sweeping far-flare LOD `6.0–7.0`; benefit is below the useful threshold in the current compositor.
3. Do not use negative-detail shoulder suppression as the main way to thin the disk; values around `0.78` make the image dry and reduce lower/warm light.
4. Do not keep raising `microCore` scalar strength; `0.28 -> 0.42` raised peak brightness without materially narrowing the core.
5. The isotropic 4-neighbor ridge selector preserved surrounding light but slightly widened the high-intensity core; do not repeat the exact #513 gate/target/mix values.
6. The first directional vertical-thinness + horizontal-continuity selector also widened high-intensity horizontal coverage; do not repeat the exact #517 gate combination or simply raise its mix.
7. Do not continue scanning #527/#529 multi-scale ridge redistribution/gain; both conservative and stronger ranges were visually sub-threshold.
8. Prefer physically identified direct-crossing information from the ray tracer over another screen-space neighborhood selector when shaping the direct component.
9. Any accepted replacement must beat #479 visibly at original size while preserving its warm veil, lower brightness, shadow cleanliness, and frozen geometry.

## Operational validation notes

- #499 was not a visual verdict: validation stopped at TypeScript because a renderer syntax typo was introduced during experiment preparation. The ridge parameters were not changed when fixing it.
- #511 was not a visual verdict: typecheck/lint passed, but one unrelated diagnostic-frame test assertion contained a text typo (`sonst` instead of `const`). The ridge-specific test itself passed. The ridge parameters were not changed when fixing it.
- Temporary placeholder files created during recovery were deleted by forward commits; they were tooling mistakes and are not visual experiments.
- #513 was the first valid Windows visual run for the four-neighbor ridge experiment.
- #517 passed frontend typecheck/lint/tests, Rust fast checks, Tauri EXE build, native Windows visual capture, and artifact upload; candidate/baseline/split/expanded screenshots were opened directly.
- #527 and #529 both passed Windows visual validation and were inspected at original size and core crop; neither met the visible-improvement bar.

## Next experiment target

Stop screen-space ridge/gain scanning. Inspect the physical ray-tracing crossing pipeline and, if first/direct crossing identity is already available, shape that physical component independently while preserving higher-order images and #479 compositor behavior.
