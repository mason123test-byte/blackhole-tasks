# Black-hole visual experiment log

This file records Windows-validated black-hole visual tuning experiments on `agent/initial-blackhole-tasks`.

## Rules

- `#479` is the current accepted visual baseline until a later Windows artifact is explicitly accepted.
- Geometry is frozen: do not change `DISK_OUTER`, `OBSERVER_THETA`, Kerr/geodesic stepping, disk crossing structure, BH/disk/observer geometry, or use screen-space geometry patches.
- No Canvas2D, framebuffer mirror/flip, copied lower half, fake annulus, alternate fallback renderer, or `screen.y` upper/lower hard patches.
- One experiment changes one main photometric variable or one independent visual layer.
- Shader implementation and its test must be committed atomically.
- A candidate is not accepted until the Windows visual workflow succeeds and actual artifact screenshots are opened and compared.
- Rejected mechanisms are recorded so later rounds do not re-scan the same weak selector or gain range.

## Accepted baseline history

### #473 — geometry compromise accepted
- Commit: `3ec58116fb952f62a3edde360eee682f1e59aca0`.
- `DISK_OUTER=35M`; geometry frozen after this point.

### #475 — warm filmic highlight response
- Commit: `f765aa8ab137e088a44caae7dea76bdfd2b85df8`.
- Added warm ivory / pale-gold highlight response and protected veiling flare.

### #479 — current visual baseline
- Commit: `8e83056d29f6bda610700dba6ca09be9e89fd7a4`.
- Added `flareCoreReject = 1.0 - 0.82 * smoothstep(0.56, 0.82, basePeak)`.
- Accepted because it keeps the stronger outer veil while preventing the direct core from becoming thick and overexposed.

## Rejected / low-value experiments

### #477 — stronger veiling flare
- Commit: `e991501b4e8e844c6c7440731983aee9c8880394`.
- Result: core and overexposure increased strongly.
- Do not globally raise flare weights without independent core protection.

### #481 / #483 — far-flare LOD radius scan
- #481 `d39da653d6ad8397f30980b603fb05f825219f87`, LOD 7.0.
- #483 `7dfe8f1c73c6b3fbbbec73323e92e067f056fcf8`, LOD 6.5.
- Result: wider far flare reduced local warmth with no clear advantage over #479.
- Do not continue fine LOD scans in `6.0–7.0` unless another independent layer materially changes the flare response.

### #485 / #487 / #489 — local micro-contrast shoulder suppression
- #487 used `microShoulder=0.88`; #489 used `0.78`.
- Stronger suppression made the ridge thinner but progressively removed warm/lower light and photographic richness.
- Do not push negative-detail shoulder suppression below about `0.88`; `0.78` is known too dry.

### #491 / #493 — isolated positive-detail core
- #491 `40b64c24788c87804a9a8e6702e213c52b661ed6`, `microCore=0.28`.
- #493 `808251557aa232756e239978630aa9344d295ef0`, `microCore=0.42`.
- Increasing strength raised peak brightness but did not materially narrow the core.
- Do not simply raise `microCore` beyond `0.42`.

### #513 — isotropic four-neighbor ridge selector
- Visual-code HEAD `7f2729b9147e20787ac6c51d464edcc112d47ea2`; run `#513` / `32253449518`; artifact `9365521120`.
- Gates: detail `0.018–0.075`, base peak `0.58–0.88`, white target `1.10`, mix `0.24`.
- Result: lower/warm light preserved but high-intensity core slightly widened.
- Do not repeat this exact selector and parameter set.

### #517 — directional vertical-thinness + horizontal-continuity selector
- Commit `fcc4ac51387d96dc52b8b73e0ec9234e89786cf8`; run `#517` / `32255050216`; artifact `9366336438`.
- #479 / #513 / #517 average core thickness `2.211 / 2.245 / 2.229 px`; high-intensity coverage `90 / 94 / 96 px`.
- Rejected. Do not repeat the exact #517 gate combination or simply raise its mix.

### #527 — multi-scale 1px/2px ridge-width evidence
- Commit `d3ef6693649864c0bf876c46342bfa0b71014b70`; run `#527` / `32266998167`; artifact `9370838494`.
- Redistribution `mix(0.78, 1.20, ridgeWidthEvidence)`.
- #479 -> #527 core thickness `2.211 -> 2.189 px`, median `2 -> 2`, coverage `90 -> 90`.
- Harmless but visually sub-threshold.

### #529 — stronger multi-scale ridge redistribution
- Commit `8529e529db903ea282018fce65ce82d9a2421325`; run `#529` / `32268184738`; artifact `9371326613`.
- Redistribution `mix(0.60, 1.30, ridgeWidthEvidence)`.
- Core thickness `2.178 px`, median `2`, coverage `90`, `>180` `196`, lower `10817`, warm `30806`, dead-white `0`.
- Could not be stably distinguished from #527. Do not continue scanning this selector's redistribution/gain.

### #535 — physical first-crossing photometric response
- Commit `c09c60dcd199d5dd838f9bf400ce36df9cff59ea`; run `#535` / `32271183829`; artifact `9372425947`.
- `diskCrossingCount == 0`, strong `0.45 -> 1.75` color gain.
- #479 -> #535: core `2.211 -> 5.446 px`, median `2 -> 4`, coverage `90 -> 437`, `>180` `199 -> 2380`, lower `10817 -> 6937`, warm `30816 -> 17023`, dead-white `0 -> 102`.
- First physical crossing is too broad a primary/lensed family. Do not tune the gain range to rescue it.

### #541 — inbound first-crossing radial-leg classifier
- Commit `f8e9aaab985e282932edcdc1a55d3b2a146466b6`; run `#541` / `32317351153`; artifact `9388702029`.
- `diskCrossingCount == 0 && !radialTurned && inboundStep`.
- #479 -> #541: core `2.211 -> 2.733`, coverage `90 -> 258`, direct span `682 -> 631`, lower `10817 -> 8304`, warm `30816 -> 21916`, dead-white `0 -> 9`.
- More selective than crossing ordinal alone but still too broad. Do not tune nearby gain/thresholds to rescue it.

### #545 — first-crossing azimuthal-deflection weighting
- Commit `db33dced4b50436f8b2f6ff46d48439d4055183c`; run `#545` / `32318716581`; artifact `9389121668`.
- Used `abs(diskPhi)` with `1.0 - smoothstep(1.15, 2.75, azimuthalDeflection)`.
- #479 -> #545: core `2.211 -> 3.000`, coverage `90 -> 309`, direct span `682 -> 661`, lower `10817 -> 8894`, warm `30816 -> 24848`, dead-white `0 -> 12`.
- Raw disk azimuth mixes true path deflection with physical disk-hit azimuth. Do not scan this window/gain.

### #553 — affine path-stretch first-crossing classifier
- Candidate `5ac6adba5629058ebede393fa46fcf9f04a0cccd`; run `#553` / `32320401192`.
- First visual attempt timed out after baseline/candidate capture; identical rerun succeeded. Valid artifact `9389827608`, digest `sha256:1e0943e09dba758161ccbdbdd569c2f2482318bc634f683d46927887ce811f88`.
- Selector `pathStretch = hitPathLength / max(OBSERVER_R - diskRadius, 1.0)`, gate `1.05–1.45` on crossing 0; response `0.32–1.00` with no peak boost.
- #479 -> #553: core `2.211 -> 1.176 px`, median `2 -> 1`, coverage `90 -> 17`, direct span `682 -> 499`; lower and warm light heavily reduced; dead-white `0`.
- First physical signal with real 1px-class thinning, but standalone path stretch destroys too much valid image energy.

### #559 — incidence-qualified path-stretch shoulder suppression
- Candidate `c89bda0707964eaa573625a58afee59397c5c18e`; run `#559` / `32322673121`; artifact `9390455145`, digest `sha256:9816ea6aa4756e114264a16560d7ed53925d9bd41c64e44ff1cbc4e70b86c85a`.
- Uses path stretch plus local incidence: `grazingWeight = 1.0 - smoothstep(0.07, 0.26, incidenceCosine)`.
- #479 -> #559: core `2.211 -> 1.400`, median `2 -> 1`, direct span `682 -> 456`, lower almost preserved, warm strongly reduced, dead-white `0`.
- Incidence metadata improves selectivity but v1 shortens direct span and loses warmth.

### #561 — narrowed incidence-qualified shoulder band
- Candidate `68827a8902e682b2ee562b5e07b9fe1170dc15b1`; run `#561` / `32323820546`; artifact `9390841530`, digest `sha256:aed4172bf16b4f9306e35bdb3ddf1172d07ea547045761df296dd503e1a55f3b`.
- Same physical classifier as #559; only narrowed suppressed shoulder from about `0.42–0.64` to `0.58–0.72`.
- Fixed script: #479 -> #561 average core `2.211 -> 1.333 px` (-39.7%), median `2 -> 1`, `>180` `199 -> 8`, high-intensity columns `90 -> 6`, direct span `682 -> 681`, lower essentially preserved, warm coverage still down about 24%, dead-white `0`, shadow unchanged.
- Rejected. It solves direct span/lower while preserving 1px-class thinning, but remains visibly too dry/grey. Do not keep scanning the same shoulder threshold.

### #567 — capped warm-veil recovery on the #561 classifier
- Candidate commit: `08142c58aacca949959bb8e929d8302bbe89bc95`.
- Windows run: `#567` / `32326023853`; artifact `9391514127`, digest `sha256:8d4e69507491bbe512df53f12059f0b759b77b3f534683d2846ea9e877e19489`.
- Relative to #561, the physical classifier and shoulder suppression are unchanged. The only shader addition is a capped warm recovery inside the already-selected shoulder: `warmVeilTarget = vec3(1.0, 0.92, 0.70) * min(directPeak * 0.78, 0.60)` and `warmVeilRecovery = shoulderSuppression * 0.84`.
- Required candidate/baseline/split/expanded screenshots were opened, plus #479/#561/#567 original-size and direct-core comparisons.
- Same fixed script: #479 / #561 / #567 average core thickness `2.211 / 1.333 / 1.154 px`; median `2 / 1 / 1`; `>180` core pixels `199 / 8 / 15`; high-intensity columns `90 / 6 / 13`; lower bright `8695 / 8649 / 8669`; warm coverage `16888 / 11195 / 12775`; dead-white `0 / 0 / 0`.
- Warm coverage recovers about 14% versus #561, and lower remains within about 0.3% of #479. The core remains strongly thinned with no dead white.
- However, warm coverage is still about 24% below #479, and the truly high-intensity horizontal core remains far too short (`13` columns versus `90`). Original-size comparison still looks noticeably drier and less continuous than #479.
- Verdict: rejected. Do not continue scanning the current `directPeak * 0.78 / cap 0.60 / recovery 0.84` warm-recovery strength. The remaining issue is not simply insufficient tint strength; the response needs a different way to preserve a long continuous warm shoulder while retaining the 1px core.

## Current exclusions / lessons

1. Do not increase global flare weights without core protection.
2. Do not keep sweeping far-flare LOD `6.0–7.0` in the current compositor.
3. Do not use strong negative-detail shoulder suppression as the primary thinning mechanism.
4. Do not keep raising `microCore` scalar strength beyond the tested range.
5. Do not repeat #513/#517 screen-space neighborhood ridge selectors or their exact gates.
6. Do not continue #527/#529 multi-scale ridge redistribution/gain scans.
7. Do not equate `diskCrossingCount == 0` with the horizontal direct image.
8. Do not use first-crossing radial-leg state as a sufficient direct-core mask.
9. Do not use raw `abs(diskPhi)` as a direct-image mask.
10. Do not use the exact #553 broad path-stretch suppression as a standalone direct-image mask.
11. Path stretch has real core-thinning separation value but requires an independent physical qualifier.
12. Local incidence geometry substantially improves path-stretch selectivity.
13. Do not continue scanning #559/#561 shoulder thresholds alone.
14. Do not continue scanning #567's capped warm tint strength; it partially restores warmth but not enough continuity/coverage.
15. Any accepted replacement must visibly beat #479 while preserving warm veil, lower brightness, shadow cleanliness, long horizontal continuity and frozen geometry.

## Operational validation notes

- #499 stopped at TypeScript due to a renderer syntax typo; not a visual verdict.
- #511 stopped because an unrelated diagnostic-frame test assertion had a text typo; not a visual verdict.
- Temporary placeholder/noop artifacts from earlier recovery were removed by forward commits and were never accepted visual experiments.
- During #545 preparation, unattached erroneous commit objects were never connected to the branch.
- During #553 preparation, accidental `DO_NOT_USE` commit `80d04d006dde3e500d51dc27866b7e752f2cead6` was immediately cleaned by forward commit `fa31d802493c2521af1408bf035fe668d08a544f`; no reset/rebase/force.
- #553's first visual attempt failed after partial capture; identical rerun succeeded.
- #559's initial workflow was cancelled before any step; same SHA later validated successfully.
- Required #559, #561 and #567 Windows screenshots plus #479 comparisons and direct-core crops were opened before verdicts.

## Next experiment target

Do not do another scalar scan of #561/#567 shoulder or tint strengths. The incidence-qualified classifier remains the best physical separation found so far because it preserves direct span/lower while enabling 1px-class thinning. The next experiment should change the response topology rather than the scalar strength: preserve a long low-frequency warm shoulder/veil independently from the high-intensity core, ideally using a luminance-preserving or low-frequency component that is explicitly capped below the core threshold. Keep geometry, path-stretch and incidence semantics frozen.
