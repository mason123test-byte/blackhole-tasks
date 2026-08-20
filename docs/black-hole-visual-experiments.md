# Black-hole visual experiment log

This file records Windows-validated black-hole visual tuning experiments on `agent/initial-blackhole-tasks`.

## Rules

- `#571` is the current accepted visual baseline.
- Geometry is frozen: do not change `DISK_OUTER`, `OBSERVER_THETA`, Kerr/geodesic stepping, disk crossing structure, BH/disk/observer geometry, or use screen-space geometry patches.
- No Canvas2D, framebuffer mirror/flip, copied lower half, fake annulus, alternate fallback renderer, or `screen.y` upper/lower hard patches.
- One experiment changes one main photometric variable or one independent visual layer.
- Shader implementation and its test must be committed atomically.
- A candidate is not accepted until the Windows visual workflow succeeds and actual artifact screenshots are opened and compared.
- Rejected mechanisms are recorded so later rounds do not re-scan the same weak selector or parameter family.

## Accepted baseline history

### #473 — geometry compromise accepted
- Commit `3ec58116fb952f62a3edde360eee682f1e59aca0`.
- `DISK_OUTER=35M`; geometry frozen after this point.

### #475 — warm filmic highlight response
- Commit `f765aa8ab137e088a44caae7dea76bdfd2b85df8`.
- Added warm ivory / pale-gold highlight response and protected veiling flare.

### #479 — protected warm veil baseline
- Commit `8e83056d29f6bda610700dba6ca09be9e89fd7a4`.
- Added `flareCoreReject = 1.0 - 0.82 * smoothstep(0.56, 0.82, basePeak)`.
- Accepted because it kept the stronger outer veil while preventing the direct core from becoming thick and overexposed.
- This remained the production baseline through the rejected #481–#567 experiments.

### #571 — incidence-qualified thinning + sub-white warm shoulder shelf
- Candidate commit `d837208847b9f0ec307f1d100d14759271bb7b2b`.
- Windows Build `#571`, run ID `32385189946`, workflow ID `328346937`.
- Artifact `9412866330`, digest `sha256:02996f49b3622af1942321d7011443e7ffee2eec2107493ec7bd7bf182f08e99`.
- Physical classifier is unchanged from #561: crossing 0 + path stretch `1.05–1.45` + local incidence gate `0.07–0.26`; suppressed shoulder remains `0.58–0.72` with `0.38` floor and the same high-core protection.
- New response topology only: after thinning, the selected shoulder is mapped through a nonlinear sub-white warm shelf: `warmShelfSupport = smoothstep(0.22, 0.68, shoulderSuppression)`, `warmShelfPeak = min(0.68, directPeak * 0.94)`, tint `vec3(1.0, 0.93, 0.74)`.
- Same fixed validation definitions used for #479/#571: core ROI `y330:385, x80:840`, mean RGB `>180`; lower ROI `y360:510, x80:840`, mean RGB `>60`; warm ROI `y180:520, x80:840`, `R > B + 8` and mean RGB `>60`; direct span on row `y=354`, mean RGB `>60`; fixed central shadow ROI `y285:345, x410:510`, mean RGB `>5`.
- #479 -> #571: average bright-core thickness `2.211 -> 1.192 px` (-46.1%), median `2 -> 1 px`, `>180` core pixels `199 -> 31`, high-intensity columns `90 -> 26`, direct span `682 -> 682 px`, lower bright `10817 -> 10636` (-1.7%), warm coverage `30816 -> 29693` (-3.6%), shadow `>5` count `152 -> 152`, dead-white `0 -> 0`.
- Required Windows `visual-candidate.png`, `visual-baseline.png`, `visual-split.png`, expanded screenshot, and #479/#561/#567/#571 original-size/core comparisons were opened before verdict.
- Visual result: the horizontal direct disk stays full-length and warm, the lower image and shadow remain intact, while the direct high-intensity ridge becomes visibly thinner and more separated from the warm shoulder. No grey fog or dead-white expansion was observed.
- Verdict: accepted. `#571` replaces `#479` as the current visual baseline.

## Rejected / low-value experiments

### #477 — stronger veiling flare
- Commit `e991501b4e8e844c6c7440731983aee9c8880394`.
- Core and overexposure increased strongly. Do not globally raise flare weights without independent core protection.

### #481 / #483 — far-flare LOD radius scan
- #481 `d39da653d6ad8397f30980b603fb05f825219f87`, LOD 7.0; #483 `7dfe8f1c73c6b3fbbbec73323e92e067f056fcf8`, LOD 6.5.
- Wider far flare reduced local warmth without a clear advantage. Do not continue fine scans in `6.0–7.0` unless another independent layer changes the response materially.

### #485 / #487 / #489 — local micro-contrast shoulder suppression
- #487 used `microShoulder=0.88`; #489 used `0.78`.
- Stronger negative-detail suppression made the ridge thinner but removed warm/lower light and photographic richness. Do not push this mechanism harder.

### #491 / #493 — isolated positive-detail core
- #491 `40b64c24788c87804a9a8e6702e213c52b661ed6`, `microCore=0.28`; #493 `808251557aa232756e239978630aa9344d295ef0`, `microCore=0.42`.
- More strength raised peak brightness but did not materially narrow the core. Do not simply raise `microCore` further.

### #513 — isotropic four-neighbor ridge selector
- Visual HEAD `7f2729b9147e20787ac6c51d464edcc112d47ea2`; run `32253449518`; artifact `9365521120`.
- Preserved lower/warm light but slightly widened the high-intensity core. Do not repeat the exact selector/gates.

### #517 — directional ridge selector
- Commit `fcc4ac51387d96dc52b8b73e0ec9234e89786cf8`; run `32255050216`; artifact `9366336438`.
- Vertical thinness + horizontal continuity still failed to create a visibly thinner knife-edge. Do not repeat or simply raise its mix.

### #527 / #529 — multi-scale 1px/2px ridge-width evidence
- #527 `d3ef6693649864c0bf876c46342bfa0b71014b70`, artifact `9370838494`, redistribution `0.78–1.20`.
- #529 `8529e529db903ea282018fce65ce82d9a2421325`, artifact `9371326613`, redistribution `0.60–1.30`.
- Both were visually sub-threshold. Do not continue scanning this selector's redistribution/gain.

### #535 — physical first-crossing photometric response
- Commit `c09c60dcd199d5dd838f9bf400ce36df9cff59ea`; artifact `9372425947`.
- `diskCrossingCount == 0` selected a broad primary/lensed family; core thickness exploded and lower/warm light collapsed. Do not tune the gain range to rescue this identity.

### #541 — inbound first-crossing radial-leg classifier
- Commit `f8e9aaab985e282932edcdc1a55d3b2a146466b6`; artifact `9388702029`.
- More selective than crossing ordinal alone but still too broad. Do not tune nearby gain/thresholds to rescue it.

### #545 — first-crossing `diskPhi` weighting
- Commit `db33dced4b50436f8b2f6ff46d48439d4055183c`; artifact `9389121668`.
- Raw disk azimuth mixes path deflection with physical hit azimuth. Do not scan the `1.15–2.75` window or nearby gain.

### #553 — affine path-stretch classifier
- Candidate `5ac6adba5629058ebede393fa46fcf9f04a0cccd`; valid artifact `9389827608` after an identical rerun of the first capture timeout.
- First physical signal to produce real 1px-class thinning, but standalone path-stretch removed too much direct span/lower/warm light.
- Do not reuse the exact broad `1.05–1.45 + 0.32–1.00` suppression as a standalone classifier.

### #559 — incidence-qualified path-stretch shoulder suppression v1
- Candidate `c89bda0707964eaa573625a58afee59397c5c18e`; artifact `9390455145`.
- Local incidence substantially improved selectivity and preserved lower light, but direct span and warmth were still too damaged.

### #561 — narrowed incidence-qualified shoulder band
- Candidate `68827a8902e682b2ee562b5e07b9fe1170dc15b1`; artifact `9390841530`.
- Solved direct-span/lower retention and kept 1px-class thinning, but warm coverage remained roughly 24% below #479. Do not continue scanning this same shoulder threshold.

### #567 — capped warm tint recovery
- Candidate `08142c58aacca949959bb8e929d8302bbe89bc95`; artifact `9391514127`.
- Added `warmVeilTarget = vec3(1.0, 0.92, 0.70) * min(directPeak * 0.78, 0.60)` with `warmVeilRecovery = shoulderSuppression * 0.84`.
- Warmth partially recovered while keeping a thin core and lower light, but warm coverage was still about 24% below #479 and the high-intensity ridge remained too discontinuous.
- Do not continue scalar scans of `0.78 / 0.60 / 0.84`; the successful #571 result came from changing response topology instead.

## Current exclusions / lessons

1. Do not increase global flare weights without core protection.
2. Do not keep sweeping far-flare LOD `6.0–7.0` in the current compositor.
3. Do not use strong generic screen-space negative-detail suppression as the primary thinning mechanism.
4. Do not keep raising `microCore` scalar strength.
5. Do not repeat #513/#517 screen-space neighborhood ridge selectors.
6. Do not continue #527/#529 multi-scale redistribution/gain scans.
7. Do not equate `diskCrossingCount == 0` with the horizontal direct image.
8. Do not use radial leg or raw `diskPhi` as sufficient direct-image identities.
9. Path stretch has useful thinning separation but requires local-incidence qualification.
10. The accepted physical selector is currently the #561/#571 path-stretch + local-incidence combination; do not casually retune its semantic gates.
11. Do not return to #567 scalar tint recovery. The accepted solution uses a separate sub-white warm shelf topology.
12. Geometry remains frozen. Any future baseline must preserve #571's direct span, lower image, shadow cleanliness and full Kerr geometry.

## Operational validation notes

- #499 stopped at TypeScript due to a renderer syntax typo; not a visual verdict.
- #511 stopped because a diagnostic-frame test assertion had a text typo; not a visual verdict.
- Temporary placeholder/noop artifacts from earlier recovery were removed by forward commits and were never accepted visual experiments.
- During #545 preparation, unattached erroneous commit objects were never connected to the branch.
- During #553 preparation, accidental `DO_NOT_USE` commit `80d04d006dde3e500d51dc27866b7e752f2cead6` was immediately cleaned by forward commit `fa31d802493c2521af1408bf035fe668d08a544f`; no reset/rebase/force.
- #553's first visual attempt failed after partial capture; identical rerun succeeded.
- #559's initial workflow was cancelled before any step; same SHA later validated successfully.
- Required #559, #561, #567 and #571 Windows screenshots plus baseline comparisons were opened before verdicts.

## Next experiment target

`#571` is the accepted baseline. Do not immediately retune its physical classifier or warm shelf. Any next visual round should start from #571 and change one genuinely independent layer only. Priority should be preserving the now-thin direct core and warm shoulder while evaluating a separate photographic refinement (for example subtle higher-order/lower-image tonal separation) without changing geometry or the accepted direct-disk response.
