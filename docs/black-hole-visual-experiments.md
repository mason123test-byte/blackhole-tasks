# Black-hole visual experiment log

This file records Windows-validated black-hole visual tuning experiments on `agent/initial-blackhole-tasks`.

## Rules

- `#479` is the current accepted visual baseline until a later Windows artifact is explicitly accepted.
- Geometry is frozen: do not change `DISK_OUTER`, `OBSERVER_THETA`, Kerr/geodesic stepping, disk crossing structure, BH/disk/observer geometry, or use screen-space geometry patches.
- No Canvas2D, framebuffer mirror/flip, copied lower half, fake annulus, alternate fallback renderer, or `screen.y` upper/lower hard patches.
- One experiment changes one main photometric variable or one independent visual layer.
- Shader implementation and its test must be committed atomically.
- A candidate is not accepted until the Windows visual workflow succeeds and the actual artifact screenshots are opened and compared.
- Rejected mechanisms are recorded so later rounds do not re-scan the same weak selector or gain range.

## Accepted baseline history

### #473 — geometry compromise accepted
- Commit: `3ec58116fb952f62a3edde360eee682f1e59aca0`.
- `DISK_OUTER=35M`.
- Geometry compromise accepted; geometry frozen after this point.

### #475 — warm filmic highlight response
- Commit: `f765aa8ab137e088a44caae7dea76bdfd2b85df8`.
- Added warm ivory / pale-gold highlight response and protected veiling flare.
- Direction accepted.

### #479 — current visual baseline
- Commit: `8e83056d29f6bda610700dba6ca09be9e89fd7a4`.
- Added `flareCoreReject = 1.0 - 0.82 * smoothstep(0.56, 0.82, basePeak)`.
- Result: retained the stronger outer veil while preventing the direct disk core from becoming thick and overexposed.
- Accepted as the current baseline.

## Rejected / low-value experiments

### #477 — stronger veiling flare
- Commit: `e991501b4e8e844c6c7440731983aee9c8880394`.
- Result: core and overexposure increased strongly.
- Verdict: rejected. Do not globally raise flare weights without independent core protection.

### #481 / #483 — far-flare LOD radius scan
- #481 commit: `d39da653d6ad8397f30980b603fb05f825219f87`, LOD 7.0.
- #483 commit: `7dfe8f1c73c6b3fbbbec73323e92e067f056fcf8`, LOD 6.5.
- Result: wider far flare reduced local warmth with no clear advantage over #479.
- Do not continue fine LOD scans in the `6.0–7.0` range unless another independent layer materially changes the flare response.

### #485 / #487 / #489 — local micro-contrast shoulder suppression
- #485: initial LOD1 micro-contrast shoulder.
- #487: `microShoulder=0.88`.
- #489: `microShoulder=0.78`.
- Result: stronger suppression made the ridge thinner but progressively removed warm/lower light and photographic richness.
- Do not push negative-detail shoulder suppression below about `0.88`; `0.78` is known to be too dry.

### #491 / #493 — isolated positive-detail core
- #491 commit: `40b64c24788c87804a9a8e6702e213c52b661ed6`, `microCore=0.28`.
- #493 commit: `808251557aa232756e239978630aa9344d295ef0`, `microCore=0.42`.
- Result: increasing strength raised peak brightness but did not materially narrow the core.
- Do not simply raise `microCore` beyond `0.42`.

### #513 — isotropic four-neighbor ridge selector
- Visual-code HEAD: `7f2729b9147e20787ac6c51d464edcc112d47ea2`.
- Windows run: `#513` / `32253449518`; artifact `9365521120`.
- Selector: `ridgeDetail = max(basePeak - ridgeNeighborPeak, 0.0)` using four direct texture neighbors.
- Gates: ridge detail `0.018–0.075`, base peak `0.58–0.88`, white target `1.10`, mix `0.24`.
- Result: lower/warm light preserved but high-intensity core slightly widened instead of thinning.
- Verdict: rejected / low value. Do not repeat this exact selector and parameter set.

### #517 — directional vertical-thinness + horizontal-continuity selector
- Commit: `fcc4ac51387d96dc52b8b73e0ec9234e89786cf8`.
- Windows run: `#517` / `32255050216`; artifact `9366336438`.
- Used vertical thinness plus horizontal continuity with the same amplification as #513.
- Same-definition #479 / #513 / #517 average core thickness: `2.211 / 2.245 / 2.229 px`; high-intensity coverage `90 / 94 / 96 px`.
- Result: preserved surrounding light but still widened high-intensity coverage.
- Verdict: rejected. Do not repeat the exact #517 gate combination or simply raise its mix.

### #527 — multi-scale 1px/2px ridge-width evidence
- Commit: `d3ef6693649864c0bf876c46342bfa0b71014b70`.
- Windows run: `#527` / `32266998167`; artifact `9370838494`.
- Redistribution: `mix(0.78, 1.20, ridgeWidthEvidence)`.
- #479 -> #527 core thickness: `2.211 -> 2.189 px`; median `2 -> 2`; coverage `90 -> 90`.
- Result: harmless but visually sub-threshold.
- Verdict: rejected / low value.

### #529 — stronger multi-scale ridge redistribution
- Commit: `8529e529db903ea282018fce65ce82d9a2421325`.
- Windows run: `#529` / `32268184738`; artifact `9371326613`.
- Redistribution: `mix(0.60, 1.30, ridgeWidthEvidence)`.
- Average bright-core thickness `2.178 px`, median `2 px`, horizontal coverage `90 px`, `>180` pixels `196`, lower bright `10817`, warm coverage `30806`, dead-white `0`.
- Result: could not be stably distinguished from #527 at original size.
- Verdict: rejected. Do not continue scanning the current multi-scale ridge selector redistribution/gain; the limitation is selector separation, not gain strength.

### #535 — physical first-crossing photometric response
- Commit: `c09c60dcd199d5dd838f9bf400ce36df9cff59ea`.
- Windows run: `#535` / `32271183829`; artifact `9372425947`.
- Mechanism: `diskCrossingCount == 0`, with strong `0.45 -> 1.75` direct color gain and warm core; alpha/transmittance and geometry unchanged.
- #479 -> #535: core thickness `2.211 -> 5.446 px`, median `2 -> 4`, coverage `90 -> 437`, `>180` `199 -> 2380`, lower `10817 -> 6937`, warm `30816 -> 17023`, dead-white `0 -> 102`.
- Result: first physical crossing belongs to a broad primary/lensed family and is not the screen-visible horizontal direct-image identity.
- Verdict: rejected. Do not tune the `0.45 -> 1.75` strength range to rescue this selector.

### #541 — inbound first-crossing radial-leg classifier
- Commit: `f8e9aaab985e282932edcdc1a55d3b2a146466b6`.
- Windows run: `#541` / `32317351153`; artifact `9388702029`.
- Mechanism: `diskCrossingCount == 0 && !radialTurned && inboundStep`.
- #479 -> #541: core thickness `2.211 -> 2.733 px`, median `2 -> 2`, coverage `90 -> 258`, direct span `682 -> 631`, lower `10817 -> 8304`, warm `30816 -> 21916`, dead-white `0 -> 9`.
- Result: radial-leg metadata is more selective than crossing ordinal alone but still covers too broad a primary image family.
- Verdict: rejected. Do not tune the `0.40 -> 1.45` gain range or nearby response thresholds to rescue this classifier.

### #545 — first-crossing azimuthal-deflection weighting
- Commit: `db33dced4b50436f8b2f6ff46d48439d4055183c`.
- Windows run: `#545` / `32318716581`; artifact `9389121668`.
- Mechanism: used `abs(diskPhi)` with `1.0 - smoothstep(1.15, 2.75, azimuthalDeflection)`.
- #479 -> #545: core thickness `2.211 -> 3.000 px`, median `2 -> 2`, coverage `90 -> 309`, `>180` `199 -> 927`, direct span `682 -> 661`, lower `10817 -> 8894`, warm `30816 -> 24848`, dead-white `0 -> 12`.
- Result: raw disk azimuth mixes true path deflection with physical disk-hit azimuth and still over-selects the primary image family.
- Verdict: rejected. Do not scan the `1.15–2.75` window or `0.58–1.42` gain for this mechanism.

### #553 — affine path-stretch first-crossing classifier
- Candidate commit: `5ac6adba5629058ebede393fa46fcf9f04a0cccd`.
- Windows run: `#553` / `32320401192`.
- First Windows visual attempt built the Tauri EXE and captured baseline/candidate successfully, but timed out during the later visual capture stage (`Orb did not produce a non-empty WebGL2 frame within 20000ms`). Partial artifact: `9389670021`. No visual parameters were changed in response.
- The exact same Windows visual job was rerun with the same SHA and parameters; the second attempt completed successfully. Valid artifact: `9389827608`, digest `sha256:1e0943e09dba758161ccbdbdd569c2f2482318bc634f683d46927887ce811f88`.
- Mechanism: accumulated accepted affine step length before the first disk crossing and normalized by radial direct distance: `pathStretch = hitPathLength / max(OBSERVER_R - diskRadius, 1.0)`.
- Selector: `shortPathWeight = 1.0 - smoothstep(1.05, 1.45, pathStretch)` on crossing 0 only.
- Response: `directColorGain = mix(0.32, 1.00, directResponse)`; strong shoulder suppression with no peak boost.
- #479 -> #553: average bright-core thickness `2.211 -> 1.176 px` (-46.8%), median `2 -> 1 px`, coverage `90 -> 17`, direct span `682 -> 499` (-26.8%), lower bright heavily reduced, warm coverage heavily reduced, dead-white `0 -> 0`.
- Result: first physical signal to produce real 1px-class thinning, but it destroys too much direct span/lower/warm light.
- Verdict: rejected. Do not reuse the exact broad `1.05–1.45` path-stretch suppression as a standalone classifier.

### #559 — incidence-qualified path-stretch shoulder suppression
- Candidate commit: `c89bda0707964eaa573625a58afee59397c5c18e`.
- Windows run: `#559` / `32322673121`; valid artifact `9390455145`, digest `sha256:9816ea6aa4756e114264a16560d7ed53925d9bd41c64e44ff1cbc4e70b86c85a`.
- Initial workflow was cancelled before any job step ran; the same SHA was re-run without visual changes. Frontend, Rust and Windows visual subsequently completed successfully.
- Mechanism: combines #553 short-path metadata with a new local disk-incidence classifier derived from Kerr hit-state momenta. `grazingWeight = 1.0 - smoothstep(0.07, 0.26, incidenceCosine)`; `directTransferWeight = shortPathWeight * grazingWeight`.
- Response suppresses only the selected mid-bright shoulder, with a floor around `0.38`, while protecting low-light and high-emissivity core regions.
- Same fixed script, #479 -> #559: average core thickness `2.211 -> 1.400 px` (-36.7%), median `2 -> 1`, direct span `682 -> 456`, lower `9270 -> 9231`, warm coverage `25992 -> 18720`, dead-white `0 -> 0`, fixed shadow >5 `152 -> 152`.
- Result: incidence metadata preserves lower much better than #553 and retains real 1px-class thinning, but direct span remains badly shortened and warm veil falls by about 28%.
- Verdict: rejected. Do not accept #559 as a baseline replacement.

### #561 — narrowed incidence-qualified shoulder band
- Candidate commit: `68827a8902e682b2ee562b5e07b9fe1170dc15b1`.
- Windows run: `#561` / `32323820546`; artifact `9390841530`, digest `sha256:aed4172bf16b4f9306e35bdb3ddf1172d07ea547045761df296dd503e1a55f3b`.
- Same physical classifier as #559. The only visual parameter change narrowed the suppressed directPeak shoulder from approximately `0.42–0.64` to `0.58–0.72`; incidence gate, path-stretch gate, suppression floor, geometry and compositor stayed fixed.
- Required candidate/baseline/split/expanded screenshots were opened, along with original-size and core comparisons against #479/#559.
- Same fixed script, #479 -> #561: average core thickness `2.211 -> 1.333 px` (-39.7%), median `2 -> 1`, `>180` core pixels `199 -> 8`, high-intensity columns `90 -> 6`, direct span `682 -> 681`, lower bright `9270 -> 9266`, warm coverage `25992 -> 19830` (-23.7%), dead-white `0 -> 0`, shadow >5 `152 -> 152`.
- Result: #561 fixes #559's direct-span and lower-light losses while keeping clearly visible 1px-class thinning. However, the warm ivory/pale-gold veil remains far outside the ±5% retention target and is visibly drier/greyer than #479.
- Verdict: rejected. Do not continue scanning this same shoulder-band threshold as the primary fix. The remaining failure is chromatic/warm-layer preservation, not disk length or core thickness.

## Current exclusions / lessons

1. Do not increase global flare weights without core protection.
2. Do not keep sweeping far-flare LOD `6.0–7.0` in the current compositor.
3. Do not use strong negative-detail shoulder suppression as the primary thinning mechanism.
4. Do not keep raising `microCore` scalar strength beyond the tested range.
5. Do not repeat #513/#517 screen-space neighborhood ridge selectors or their exact gates.
6. Do not continue #527/#529 multi-scale ridge redistribution/gain scans.
7. Do not equate `diskCrossingCount == 0` with the horizontal direct-disk image.
8. Do not use `first crossing + no radial turn + inbound` as a sufficient direct-core mask.
9. Do not use raw `abs(diskPhi)` as a direct-image mask.
10. Do not use the exact #553 `pathStretch 1.05–1.45 + 0.32–1.00 shoulder suppression` as a standalone direct-image mask.
11. Path stretch has real core-thinning separation value but requires an independent physical qualifier.
12. Local incidence geometry substantially improves path-stretch selectivity; #561 demonstrates that direct span and lower light can be preserved while achieving 1px-class thinning.
13. Do not continue scanning #559/#561's shoulder threshold alone. #561's remaining failure is a ~24% loss of warm coverage.
14. Any accepted replacement must beat #479 visibly while preserving warm veil, lower brightness, shadow cleanliness and frozen geometry.

## Operational validation notes

- #499 was not a visual verdict: validation stopped at TypeScript because of a renderer syntax typo during experiment preparation.
- #511 was not a visual verdict: typecheck/lint passed but an unrelated diagnostic-frame test assertion contained a text typo.
- Temporary placeholder files created during earlier recovery were deleted by forward commits; they were tooling mistakes, not visual experiments.
- During #545 preparation, an unattached noop commit object and an unpushed incorrect candidate object were created by tool error; neither was connected to a branch ref.
- During #553 preparation, a schema-probing mistake accidentally created a `DO_NOT_USE` file in commit `80d04d006dde3e500d51dc27866b7e752f2cead6`; it was immediately removed by forward commit `fa31d802493c2521af1408bf035fe668d08a544f`. No reset/rebase/force operation was used.
- #553's first visual attempt failed after baseline/candidate capture; the identical job rerun succeeded. Only the successful second artifact is valid for final visual judgment.
- #559's first workflow was cancelled before any job step executed. The same commit was validated by subsequent re-runs without changing visual code.
- Required #559 and #561 Windows screenshots plus #479 comparison and direct-core crops were opened before verdicts.

## Next experiment target

Do not perform another threshold scan of #561's `directPeak` shoulder band. The incidence-qualified classifier is the first mechanism in this sequence that simultaneously preserves direct span/lower light and produces strong 1px-class thinning. The next experiment should keep that physical separation concept but change the photometric response so it preserves or explicitly reconstructs the accepted warm ivory/pale-gold veil without re-thickening the high-intensity core. Keep geometry, path-stretch and incidence semantics frozen while testing one independent warm-response mechanism.
