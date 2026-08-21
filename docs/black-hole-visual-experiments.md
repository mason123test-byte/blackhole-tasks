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

### #575 — dual-band warm veil + knife-core reconstruction
- Candidate `ce5cf0826bd25be027d214429b3568a40adfc3ad`; Windows Build `#575`, run ID `32433553427`, workflow ID `328346937`.
- Artifact `9430055338`, digest `sha256:ede116d6fa31af620df068ddfc7839b4f65048ef60351e4be38ead767e4076a1`.
- Kept the #561/#571 path-stretch + local-incidence classifier and shoulder thinning unchanged, then explicitly formed `warmLowFrequency` and `directHighFrequency` layers before `max` reconstruction. The knife core used only the same physical direct-transfer weight plus source peak/alpha gates; no screen-space neighborhood selector or y-position patch was introduced.
- Same fixed #479 validation definitions: #479 -> #575 average bright-core thickness `2.211 -> 1.231 px` (-44.3%), median `2 -> 1 px`, `>180` core pixels `199 -> 32`, high-intensity columns `90 -> 26`, direct span `682 -> 682 px`, lower bright `10817 -> 10636` (-1.7%), warm coverage `30816 -> 29693` (-3.6%), shadow `>5` count `152 -> 152`, dead-white `0 -> 0`.
- Relative to accepted #571, only one additional `>180` core pixel appeared: thickness `1.192 -> 1.231 px`, high-intensity columns stayed `26`, and direct span/lower/warm/shadow/dead-white were numerically identical.
- Actual Windows `visual-candidate.png`, `visual-baseline.png`, `visual-split.png`, expanded screenshot, #479/#575 original-size side-by-side, and #479/#571/#575 core enlargement were opened before verdict.
- Visual result: #575 remains clearly thinner than #479, but it is effectively indistinguishable from #571 at original size and in the core enlargement. The new high-frequency layer did not restore additional horizontal continuity; it only moved one core pixel above the fixed threshold.
- Verdict: rejected. Do not scan the `0.76–0.88` knife-core peak gate, `0.44–0.72` alpha gate, or nearby core strength values. The limitation is that source-intensity gating does not add an independent continuity signal beyond the already accepted #571 response.

### #581 — physical disk-source high-frequency residual
- Candidate `f9a5b6bfd1d248127a9bbb0fdc2a7e2f0cfb4216`; Windows Build `#581`, run ID `32435891284`, workflow ID `328346937`.
- Artifact `9430844776`, digest `sha256:52d7d20896ddb24554a2a5b93918fca26da9c7590b77de2d33120466de6c4a96`.
- Kept the accepted #571 path-stretch/local-incidence classifier, shoulder suppression and warm shelf unchanged. `sampleDiskSurface` additionally exported a source-domain residual `sourceHighFrequency = max(physicalLayers - broadSourceLayers, 0.0)`, where `broadSourceLayers` excludes the primary ribbon/filament excess. Only direct first-crossing rays qualified by the accepted transfer classifier could use that residual to reconstruct a sub-white warm knife core. No screen-space neighborhood selector, y-position patch, geometry change or second renderer was introduced.
- Same fixed #479 validation definitions: #479 -> #581 average bright-core thickness `2.211 -> 1.256 px` (-43.2%), median `2 -> 1 px`, `>180` core pixels `199 -> 49`, high-intensity columns `90 -> 39`, direct span `682 -> 682 px`, lower bright `10817 -> 11122` (+2.8%), warm coverage `30816 -> 30091` (-2.4%), shadow `>5` count `152 -> 152`, dead-white `0 -> 0`.
- Relative to accepted #571: average thickness `1.192 -> 1.256 px`, high-intensity columns `26 -> 39`, longest contiguous >180 column run `7 -> 10`, lower bright `10636 -> 11122`, warm coverage `29693 -> 30091`, direct span/shadow/dead-white unchanged. For reference #479 has 90 high-intensity columns and a longest contiguous run of 38.
- Actual Windows `visual-candidate.png`, `visual-baseline.png`, `visual-split.png`, expanded screenshot, #479/#581 original-size side-by-side, and #479/#571/#581 core enlargement were opened before verdict.
- Visual result: the source residual is a genuinely independent physical signal and restores more bright samples than #575/#571, but the added energy appears as sparse source-structure highlights rather than a visibly continuous horizontal knife edge. At original size the change from #571 is modest, and the core enlargement shows only short runs/speckles rather than the required long high-intensity ridge.
- Verdict: rejected. Do not scan the `sourceHighFrequency` support window `0.055–0.24`, the `+0.22` source-core lift, or nearby gains. The signal is physically independent but its topology is source texture, not the transfer continuity needed for a long knife-edge core.

### #585 — Kerr local-polar-momentum coherence core
- Candidate `33216e2b5b87c09d963ac02dc44858de3d8c8b4f`; Windows Build `#585`, run ID `32437680295`, workflow ID `328346937`.
- Artifact `9431425755`, digest `sha256:d092879661eb61271ae3d9a63d1df910fffb9de1ee821c39d826cd6ec980004c`.
- Kept #571 path-stretch/local-incidence classification, shoulder suppression and warm shelf unchanged, then derived `diskLocalPolarMomentum = sqrt(max(kappa - KERR_A2 - L*L, 0.0)) / diskRadius`. Only direct first-crossing rays already qualified by #571 could reconstruct a sub-white core through `polarCoherence = 1.0 - smoothstep(0.10, 0.22, polarMomentum)` and a fixed `0.82` warm core level. No screen-space y selector, neighborhood ridge selector, source-texture gate, geometry change or second renderer was introduced.
- Same fixed #479 validation definitions: #479 -> #585 average bright-core thickness `2.211 -> 2.691 px` (+21.7%), median `2 -> 2 px`, `>180` core pixels `199 -> 401`, high-intensity columns `90 -> 149`, longest contiguous >180 run `38 -> 58`, direct span `682 -> 682 px`, lower bright `10817 -> 17635` (+63.0%), warm coverage `30816 -> 35628` (+15.6%), shadow `>5` count `152 -> 152`, dead-white `0 -> 0`.
- Relative to accepted #571: average thickness `1.192 -> 2.691 px`, median `1 -> 2 px`, high-intensity columns `26 -> 149`, longest contiguous run `7 -> 58`, while lower bright and warm coverage increase far beyond their allowed bands.
- Actual Windows `visual-candidate.png`, `visual-baseline.png`, `visual-split.png`, expanded screenshot, #479/#571/#585 original-size comparison, and #479/#571/#585 core enlargement were opened before verdict.
- Visual result: polar momentum is genuinely transfer-domain and produces the first strong horizontal continuity recovery, but it does so by lighting a broad first-crossing strip rather than isolating a ~1px knife edge. The direct core becomes visibly thicker than #479 and the lower/warm response is substantially over-raised.
- Verdict: rejected. Do not scan the `0.10–0.22` polar-momentum window, the fixed `0.82` core level, or nearby scalar variants. The signal is too broad as a standalone core-support coordinate; continuity without an independent vertical-width/Jacobian discriminator simply recreates a thick bright band.

### #591 — polar-momentum continuity + polar-path detour gate
- Candidate `1637e5036fc3c527de19b969af76b3d037d150e2`; Windows Build `#591`, run ID `32444151683`, workflow ID `328346937`.
- Artifact `9433569755`, digest `sha256:3668995df3675900504415ca4ae8dae8d93117e1e3b4f688f9ec9ca86e85ac22`.
- Kept the accepted #571 classifier/warm shelf and kept #585 polar-momentum continuity semantics unchanged. Added one independent transfer-domain width discriminator: accumulated polar travel to the first disk hit, `hitPolarTravel = polarTravel + crossing * abs(side - previousSide)`, normalized by the observer-to-equator shortest polar distance. The resulting `polarStretch` was mapped by `polarPathCoherence = 1.0 - smoothstep(1.02, 1.18, polarStretch)` and multiplied into #585 core support. No screen-space selector, source-texture gate, geometry change, compositor change or second renderer was introduced.
- Same fixed #479 validation definitions: #479 -> #591 average bright-core thickness `2.211 -> 2.616 px` (+18.3%), median `2 -> 2 px`, `>180` core pixels `199 -> 382`, high-intensity columns `90 -> 146`, longest contiguous >180 run `38 -> 37`, direct span `682 -> 682 px`, lower bright `10817 -> 17633` (+63.0%), warm coverage `30816 -> 35644` (+15.7%), shadow `>5` count `152 -> 152`, dead-white `0 -> 0`.
- Relative to #585, average thickness only changes `2.691 -> 2.616 px` (-2.8%), core pixels `401 -> 382`, high-intensity columns `149 -> 146`, lower bright `17635 -> 17633`, warm coverage `35628 -> 35644`; only the longest contiguous >180 run falls materially, `58 -> 37`.
- Actual Windows `visual-candidate.png`, `visual-baseline.png`, `visual-split.png`, #571/#585/#591 original-size comparison, and #479/#571/#585/#591 core enlargement were opened before verdict.
- Visual result: the polar-path detour gate breaks some long contiguous runs but does not reject the broad direct-ray family responsible for #585's excessive thickness and lower/warm energy. At original size #591 remains essentially the same thick bright strip as #585, not a ~1px knife edge.
- Verdict: rejected. Do not scan the `1.02–1.18` polar-path stretch window or nearby scalar variants. Polar detour is not the missing vertical-width discriminator for the #585 continuity family.

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
12. Do not add another source-intensity/alpha-only knife-core gate on top of #571; #575 proved it does not create additional horizontal continuity.
13. Do not continue source-texture residual recovery from #581; it increases sparse bright samples but does not create the required long transfer-continuous knife edge.
14. Do not continue standalone local-polar-momentum core reconstruction from #585; it restores continuity by broadening the bright strip and heavily over-raises lower/warm energy.
15. Do not continue #591 polar-path detour gating or scan `1.02–1.18`; it barely changes #585 thickness/energy and mainly fragments the longest run.
16. Geometry remains frozen. Any future baseline must preserve #571's direct span, lower image, shadow cleanliness and full Kerr geometry.

## Operational validation notes

- #499 stopped at TypeScript due to a renderer syntax typo; not a visual verdict.
- #511 stopped because a diagnostic-frame test assertion had a text typo; not a visual verdict.
- Temporary placeholder/noop artifacts from earlier recovery were removed by forward commits and were never accepted visual experiments.
- During #545 preparation, unattached erroneous commit objects were never connected to the branch.
- During #553 preparation, accidental `DO_NOT_USE` commit `80d04d006dde3e500d51dc27866b7e752f2cead6` was immediately cleaned by forward commit `fa31d802493c2521af1408bf035fe668d08a544f`; no reset/rebase/force.
- #553's first visual attempt failed after partial capture; identical rerun succeeded.
- #559's initial workflow was cancelled before any step; same SHA later validated successfully.
- Required #559, #561, #567, #571, #575, #581, #585 and #591 Windows screenshots plus baseline comparisons were opened before verdicts.

## Next experiment target

`#571` remains the accepted baseline. Do not retune its physical classifier or warm shelf, and do not continue #575 source-intensity gates, #581 source-texture residual recovery, #585 standalone polar-momentum reconstruction, or #591 polar-path detour gating. #585 still proves that polar momentum contains useful horizontal continuity, but #591 shows that path detour is not an independent width coordinate for the same broad direct family. A future continuity attempt needs a genuinely local ray-bundle magnification/focusing discriminator (for example an analytically derived transfer/Jacobian proxy), not another accumulated path-length-like scalar. Otherwise leave the accepted direct response unchanged and work on a separate photographic layer without changing geometry.
