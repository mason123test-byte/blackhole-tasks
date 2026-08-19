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

## Current exclusions / lessons

1. Do not increase global flare weights to create cinematic flare; it thickens the core unless independently protected.
2. Do not keep sweeping far-flare LOD `6.0–7.0`; benefit is below the useful threshold in the current compositor.
3. Do not use negative-detail shoulder suppression as the main way to thin the disk; values around `0.78` make the image dry and reduce lower/warm light.
4. Do not keep raising `microCore` scalar strength; `0.28 -> 0.42` raised peak brightness without materially narrowing the core.
5. Favor selectors that improve peak/ridge separation without reducing surrounding warm veil or changing geometry.

## Next experiment target

Try a new independent photometric selector rather than another scalar-strength sweep: a narrow local ridge/peak selectivity response that distinguishes the sharp direct-disk highlight from its surrounding warm veil, while keeping #479 flare/core guard, tone, shadow protection, and all physical geometry unchanged.
