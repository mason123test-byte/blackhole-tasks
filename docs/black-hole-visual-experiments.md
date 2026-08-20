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
- The exact same Windows visual job was rerun with the same SHA and parameters; the second attempt completed successfully, including baseline/candidate/split capture and artifact upload. Valid artifact: `9389827608`, digest `sha256:1e0943e09dba758161ccbdbdd569c2f2482318bc634f683d46927887ce811f88`.
- Mechanism: accumulated accepted affine step length before the first disk crossing, interpolated the hit path length at the crossing, then normalized by the radial direct-distance proxy: `pathStretch = hitPathLength / max(OBSERVER_R - diskRadius, 1.0)`.
- Selector: `shortPathWeight = 1.0 - smoothstep(1.05, 1.45, pathStretch)` on crossing 0 only.
- Photometric response deliberately did not boost the peak above baseline: `directColorGain = mix(0.32, 1.00, directResponse)`. It strongly suppressed the selected mid-bright shoulder while retaining only the high-emissivity core.
- Kerr equations, integration controls, `DISK_OUTER`, `OBSERVER_THETA`, disk-plane crossing geometry, crossing gains, alpha/transmittance and #479 compositor were not changed.
- Same fixed validation script, #479 -> #553: average bright-core thickness `2.211 -> 1.176 px` (-46.8%), median `2 -> 1 px`, horizontal high-intensity coverage `90 -> 17 px`, `>180` core pixels `199 -> 20`, direct span `682 -> 499 px` (-26.8%), lower bright `10817 -> 4905` (-54.7%), warm coverage `30816 -> 12015` (-61.0%), dead-white `0 -> 0`, fixed shadow >5 count `3454 -> 3449`.
- Original-size candidate is plainly distinguishable from #479 and the core crop shows a genuinely thinner 1px-class highlight. This is the first tested physical discriminator in this sequence that clearly reduces measured bright-core thickness by much more than the 15% target and changes the median from 2px to 1px.
- However, the response removes far too much legitimate direct-disk length, lower light and warm veil. Direct span loses about 27%, lower bright about 55%, and warm coverage about 61%; these failures are far outside the acceptance limits.
- Verdict: rejected. Path stretch contains useful separation information, but this exact `1.05–1.45` selector plus shoulder-suppression response is not selective enough to preserve the accepted image family.
- Do not accept or re-use this exact broad path-stretch suppression. Future work may use path-stretch only as one component of a richer physical classifier, preferably combined with an independent local disk-hit invariant such as emission angle, while keeping geometry frozen.

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
10. Do not use the exact #553 `pathStretch 1.05–1.45 + 0.32–1.00 shoulder suppression` as a standalone direct-image mask; it succeeds at thinning but destroys direct-span/lower/warm retention.
11. Path stretch is the first physical signal tested here that demonstrated strong real core-thinning separation, so it remains useful as metadata, but not as a standalone selector.
12. Any accepted replacement must beat #479 visibly at original size while preserving its warm veil, lower brightness, shadow cleanliness and frozen geometry.

## Operational validation notes

- #499 was not a visual verdict: validation stopped at TypeScript because of a renderer syntax typo during experiment preparation.
- #511 was not a visual verdict: typecheck/lint passed but an unrelated diagnostic-frame test assertion contained a text typo.
- Temporary placeholder files created during earlier recovery were deleted by forward commits; they were tooling mistakes, not visual experiments.
- During #545 preparation, an unattached noop commit object and an unpushed incorrect candidate object were created by tool error; neither was connected to a branch ref.
- During #553 preparation, a schema-probing mistake accidentally created a `DO_NOT_USE` file in commit `80d04d006dde3e500d51dc27866b7e752f2cead6`; it was immediately removed by forward commit `fa31d802493c2521af1408bf035fe668d08a544f`. No reset/rebase/force operation was used.
- During #553 preparation, earlier unattached candidate objects were not connected to the branch; the valid candidate is `5ac6adba5629058ebede393fa46fcf9f04a0cccd`.
- #553's first visual attempt failed after baseline/candidate capture; the identical job rerun succeeded. Only the successful second artifact is valid for final visual judgment.
- Required #553 candidate/baseline/split/expanded screenshots plus #479 original-size and direct-core comparisons were opened before the verdict.

## Next experiment target

Do not rescan #553's broad path-stretch gate or simply weaken/strengthen its `0.32–1.00` suppression. The key result is that path length has real separating power but is insufficient alone. The next physical experiment should add an independent disk-hit invariant—preferably local emission angle / incidence geometry—and use path-stretch only as supporting transfer metadata, while leaving Kerr geometry and disk-crossing structure untouched.
