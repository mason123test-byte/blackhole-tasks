# Black-hole visual experiment log

Canonical registry for `agent/initial-blackhole-tasks`.

## Permanent rules
- Accepted visual baseline: `#571`.
- Geometry frozen: `DISK_OUTER`, `OBSERVER_THETA`, Kerr geometry, adaptive stepping and disk-crossing geometry must not be tuned to fake lighting.
- One WebGL2 Kerr renderer only. No Canvas2D, fallback renderer, framebuffer mirror/flip, copied lower half, fake annulus, `screen.y` repair, or screen-space neighborhood ridge selector.
- No source texture/final RGB classifier. DOM Pointer Events dragging remains unchanged.
- Candidate implementation + test are atomic. Git writes use blobs/trees/commits and `update_ref(force=false)` only. No reset/rebase/force push/noop/temp files/contents-API placeholders.
- Every candidate requires GitHub-hosted Windows `windows-latest`, runnable Tauri release EXE, native WebView2 capture, uploaded artifact, actual image inspection, and frozen-metric validation.
- Rejected candidates are logged and forward-restored to #571; exact production blobs and the restore Windows run are verified before another candidate is mounted.

## Frozen measurement contract
- Core ROI `y330:385, x80:840`, bright core = mean RGB `>180`.
- Active columns contain >=1 bright-core pixel. Average thickness = pixels/active columns; median thickness = median active-column count; longest = longest contiguous active-column run.
- Lower ROI `y360:510, x80:840`, mean RGB `>60`.
- Warm ROI `y180:520, x80:840`, `R > B + 8` and mean RGB `>60`.
- Direct span row `y=354`, mean RGB `>60`; span is first-to-last qualifying pixel inclusive.
- Shadow ROI `y285:345, x410:510`, mean RGB `>5`.
- Dead white = exact `(255,255,255)` count.

## Accepted baseline
### #571 — ACCEPTED
- Candidate `d837208847b9f0ec307f1d100d14759271bb7b2b`; Build #571; run `32385189946`; artifact `9412866330`; digest `sha256:02996f49b3622af1942321d7011443e7ffee2eec2107493ec7bd7bf182f08e99`.
- Metrics: avg `1.1923076923`; median `1`; core `31`; cols `26`; longest `7`; span `682`; lower `10636`; warm `29693`; shadow `152`; dead `0`.
- Production blobs: shader `130745839c509a727d409992b086e72a6908ce5b`; incidence test `84b2577676b0bc7fc0617bdf14ab68fb5c6bb9a4`; renderer `ec217566ab098891461ecb35e94dfa2d8827dd96`; renderer test `c666e899a98deb32e4b6f1ceccf0b1f567484af0`; baseline shader `bc4c6f96dad7f32d6ba671b85371803a079c6b3c`.

## Active exclusions / no-scan registry
1. No global flare increase (#477), far-flare LOD 6–7 (#481/#483), generic screen-space negative-detail suppression (#485/#487/#489), or microCore gain raising (#491/#493).
2. No screen-space neighbor ridge selector (#513/#517) or multi-scale redistribution scan (#527/#529).
3. First crossing alone is not direct identity (#535); radial leg too broad (#541); no raw `diskPhi` 1.15–2.75 (#545).
4. Standalone path-stretch suppression is destructive (#553); accepted #571 path/incidence semantics remain frozen. No #567 warm-tint scan.
5. No source peak/alpha (#575), source-texture residual (#581), or standalone polar-momentum reconstruction (#585). Polar momentum may remain only as frozen #599 continuity semantics.
6. No polar-path detour 1.02–1.18 (#591), incidence-Jacobian 3.2–5.2 scan (#599), second-order fold curvature 0.08–0.22 (#603), endpoint incidence determinant 0.45–1.35 (#607), or radial/polar gradient shear 0.30–0.70 (#613).
7. No scalar Jacobi compression 0.035–0.11 (#621), uncoupled Jacobi shear 0.045–0.16 (#627), simplified 2x2 endpoint rank rescue (#633), or simplified Jacobi conjugate-history rescue (#639).
8. No Kerr-vs-spinless azimuthal transport fraction threshold/gain/sign variant (#645).
9. No single-axis full-Kerr radial-transfer-compression rescue (#651).
10. No full-Kerr first-hit 2x2 rank/determinant remap (#657): it broadens to median 2px.
11. No full-Kerr first-hit `sigma_min` threshold/gain/remap (#663): it collapses to #571. Static endpoint singular-spectrum family is excluded.
12. No cumulative absolute principal-axis twist normalization/gain/threshold scan (#669): it saturates and reproduces #599's 2px family.
13. No pooled two-axis pre-hit configuration–momentum focusing-alignment magnitude scan (#677): it saturates the #599 family.
14. No axis-differential focusing-anisotropy magnitude scan (#685), including gain/clamp/threshold/right-up weighting/simple absolute-difference remaps: it saturates the #599 family.
15. No first contraction-onset timing/path-fraction asymmetry remap (#691): zero-crossing event timing also saturates the #599 family.
16. No reduced phase-space symplectic cross-coupling signed/absolute cancellation remap (#697): it is inert and reproduces #571 exactly; do not scan cancellation/coherence normalization, gain, clamp, or threshold.
17. No configuration-area versus momentum-area log-ratio total-variation/net-drift reversal remap (#703): it is inert on the high-intensity core; do not scan its log clamp, reversal normalization, gain, or threshold.
18. No finite-time right/up growth-order persistence remap (#717): corrected implementation reproduces #571 exactly; do not scan its persistence smoothstep, gain, or threshold.
19. Geometry remains frozen.

## Key continuity reference
### #599 — REJECTED
- Candidate `92ca02ba98e735f671c5f6259da86a70a40288d7`; Build #599; run `32449303088`; artifact `9435214835`.
- Metrics: avg `2.1608391608`; median `2`; core `309`; cols `143`; longest `45`; span `682`; lower `10988`; warm `30113`; shadow `152`; dead `0`.
- Lesson: frozen polar-momentum/incidence-Jacobian semantics recover continuity but do not discriminate 1px width.

## Recent propagation experiments
- #621 scalar Jacobi: avg `2.0365`, median `2`, cols `137`, longest `29`; rejected; restore #625 success.
- #627 two-polarization Jacobi: avg `1.800`, median `2`, cols `125`, longest `29`; rejected; restore #631 success.
- #633 simplified coupled endpoint rank: core exactly #571; rejected; restore #637 success.
- #639 simplified conjugate history: core exactly #571; rejected; restore #643 success.
- #645 Kerr azimuthal transport: core exactly #571; rejected; restore #649 success.
- #651 actual-Kerr camera-up radial tangent compression: core exactly #571; rejected; restore `44245e0ead1d804991eb61c81e942f402cee4e4e`, Build #655 success.

### #657 — actual-Kerr first-hit 2x2 transfer rank — REJECTED
- Candidate `40bf8b2465b8015c6e27b87329037974505e9e48`; Build #657; run `32543508966`; artifact `9467938985`; digest `sha256:ef393fecc3f69269d9305f63df1f63ddaed6c8265a169bfaacf047b18dc00883`.
- Metrics: avg `1.600`; median `2`; core `104`; cols `65`; longest `11`; span `682`; lower `10691`; warm `29792`; shadow `152`; dead `0`.
- Real separation exists, but it selects adjacent broad bundle response. Restore `fdf7c0f4db5616bd04199e8adede1b8bf7692dce`; Build #661 success.

### #663 — actual-Kerr first-hit minimum singular transfer — REJECTED
- Candidate `24fc054c5e70a2fad93d8fb82d656e70462a39da`; Build #663; run `32547882914`; artifact `9469193500`; digest `sha256:5fe307df5b677752a0800b82db37dd1cd0ebe994094129b241588a7d9d68f060`.
- Metrics: avg `1.1923076923`; median `1`; core `31`; cols `26`; longest `7`; span `682`; lower `10637`; warm `29700`; shadow `152`; dead `0`.
- Endpoint `sigma_min` is inert. Restore `bff468984693ebcc46efc5dbb182bd85e79ba036`; Build #667 success; artifact `9469326168`; digest `sha256:b8db6e28858d072560866bb0c2c11540d958a6e66ddbc9bdcf785111d8202a39`.

### #669 — actual-Kerr propagation-history principal-axis twist — REJECTED
- Candidate `6c1d3efac73ca4a3e27b723e7da8a33503c2ec14`; Build #669; run `32561626642`; artifact `9473013092`; digest `sha256:66970c2b3073c5b92044521bf94a3ecf14d54f787cb7980d2111eda4857cbfae`.
- Unique topology: two actual-Kerr tangents, configuration transfer principal-axis orientation, cumulative absolute pre-hit rotation.
- Metrics: avg `2.1608391608`; median `2`; core `309`; cols `143`; longest `45`; span `682`; lower `10988`; warm `30103`; shadow `152`; dead `0`.
- Visual: long ridge but clear ~2px core; cumulative absolute twist saturates continuity family.
- Log `299702171c5a4cce0ae499681d28c714d314a680`; restore `9d7816e4be999a3355055cc2bf71da99fd6db969`; Build #673 success; artifact `9473191345`; digest `sha256:9dfea4618aad1ea63ab784747ae53bf3524d75806ae7b26a834f80631cb864c3`.

### #677 — actual-Kerr configuration–momentum focusing alignment history — REJECTED
- Candidate `097cc27805d77cb4a494f3dc2ea9540c11d08c8e`; Build #677; run `32567370649`; artifact `9474499603`; digest `sha256:95c90f0352922df54d70f45aecf5f8b1c1999cbfb0c86f2e97b232a67de651aa`.
- Unique topology: strongest pre-hit normalized negative correlation of pooled reduced phase-space tangent bundle.
- Metrics: avg `2.1608391608`; median `2`; core `309`; cols `143`; longest `45`; span `682`; lower `10988`; warm `30091`; shadow `152`; dead `0`.
- Visual: long 45-column ridge, clearly ~2px. Pooled focusing magnitude has no vertical-width separation.
- Restore `c7c4619988222e10a2af5e85b6bb7dd711a52d57`; Build #681 success; artifact `9474598808`; digest `sha256:ae794d48ef95ae852d0535f3113f675baa59cc3b586e72ba02891ef8b82a1bbc`; restore metrics exactly #571.

### #685 — actual-Kerr axis-differential phase-space focusing anisotropy history — REJECTED
- Starting accepted checkpoint `f9be7fd79c9b2529ed35714cb6a14f3bcd4361bc`.
- Candidate `ea61ad38c3089d2f71bbc1c6eddcca05ff72e57d`.
- Unique topology: compute normalized configuration–momentum contraction independently for camera-right and camera-up tangents, retain strongest `abs(up-right)` pre-hit anisotropy on frozen #599 continuity support.
- Build #685; run `32568238898`; artifact `9474713487`; digest `sha256:c8dd6276ceb31703bc89f9ab60b321bfb8316a069dd894718c5f68144f5595b5`.
- Metrics: avg `2.1608391608`; median `2`; core `309`; cols `143`; longest `45`; span `682`; lower `10988`; warm `30091`; shadow `152`; dead `0`.
- Visual: same long #599 ridge and ~2px core. Axis-differential magnitude does not isolate 1px fold.
- Log `a847c74483dd4a3a0f57c789de6485f92a75648f`; restore `e1caada63252bac733fa956ea6fb718675d02c44`; Restore Build #689 run `32571452889` success; artifact `9475482095`; digest `sha256:646270517a94d1e67dcdf7c4763da3e7e32ceb833631c020d558515d1808c9e8`; restore metrics exactly #571.

### #691 — actual-Kerr contraction-onset timing asymmetry — REJECTED
- Candidate `9d9a4f3f91f6e0523640cad916b6af8ef53171ff`; Build #691; run `32571853791`; artifact `9475579143`; digest `sha256:5ca8660860db9d9a0f53fc640879ae742a79953147868fb56bec82f91fb95d29`.
- Unique topology: detect each actual-Kerr tangent's first non-contracting-to-contracting zero crossing and use relative right/up onset-path separation.
- Metrics: avg `2.1608391608`; median `2`; core `309`; cols `143`; longest `45`; span `682`; lower `10973`; warm `30097`; shadow `152`; dead `0`.
- Visual: full long ridge but visibly ~2px. Event timing saturates the #599 family.
- Restore `743b24611b74e094e29657586635a0340a6909b7`; Restore Build #695 run `32572270160` success; artifact `9475694090`; digest `sha256:241594bbb1e9d8def45b985ca1563a0df4c68a4d4ab435d70920246ef81fbe9a`; restore metrics exactly #571.

### #697 — actual-Kerr reduced phase-space symplectic cancellation history — REJECTED
- Candidate `31344ea6acfbe0f4deb4af6807ad968dfa762b72`; Build #697; run `32585668147`; artifact `9479050456`; digest `sha256:219b24cc7f9d62f18198d5e84b2a089030cedd98d883bd3466b464b7840f5e65`.
- Unique topology: propagate the same two actual-Kerr camera tangents, form reduced phase-space axes, integrate normalized cross-axis symplectic pairing `Omega` both signed and absolute, and use signed/absolute cancellation as the sole new discriminator on frozen #599 continuity support.
- Metrics: avg `1.1923076923`; median `1`; core `31`; cols `26`; longest `7`; span `682`; lower `10636`; warm `29693`; shadow `152`; dead `0` — exactly #571.
- Visual: indistinguishable from #571 at original size and 4x core ROI. REJECTED as inert.
- Root cause: symplectic cancellation does not separate any additional frozen #599 continuity pixels. No normalization/gain/clamp/threshold scan.
- Restore `9a04d709a8e12977b1aa71bb466e1dff56fd36c8`; restored exact #571 shader/test blobs.
- Restore Build #701; run `32586138666`; completed success; artifact `9479227489`; digest `sha256:a9ba35a383dfcf8e29d34532d1ca8ac27091b4a4f9f437616b1011544833ec06`.
- Restore artifact downloaded and `visual-candidate.png` opened. Metrics: avg `1.1923076923`; median `1`; core `31`; cols `26`; longest `7`; span `682`; lower `10636`; warm `29715` (only +22 / 0.07% versus canonical #571, within 5% stability gate); shadow `152`; dead `0`. Restore validated.

### #703 — actual-Kerr configuration/momentum subspace area-exchange reversal history — REJECTED
- Starting accepted restore `9a04d709a8e12977b1aa71bb466e1dff56fd36c8`, validated by Build #701.
- Candidate `0d0ca1e9b76c6f0a15a9665f544e6471027e1136`.
- Production candidate blobs: shader `de027da0ab7320327c4fed4258bab900efef499d`; incidence test `9fbb8b911f634f3f30f792fc3dd08a5f471ea38e`.
- Unique topology: propagate the same two actual-Kerr camera tangents; separately form oriented configuration-plane area `|det(qR,qU)|` and momentum-plane area `|det(pR,pU)|`; use their bounded log ratio along accepted pre-hit states; accumulate total variation of that ratio and compare it with net drift from the initial ratio. The sole new discriminator is the reversal fraction `(totalVariation-netDrift)/totalVariation`. It does not use the #697 symplectic pairing, endpoint determinant/rank/singular values, focusing magnitude/onset, `screen.y`, source texture, RGB, or framebuffer neighborhoods.
- Build #703; run `32609463943`; completed success.
- Artifact `9485156919`; digest `sha256:fba9d46fd5018540f0644c7da0cf38a4edaea4ab607e8234bf9201e3350edc5b`.
- Frontend/Rust fast checks, Tauri runnable EXE, native WebView2 capture and artifact upload succeeded. `visual-candidate.png`, `visual-baseline.png`, `visual-split.png`, expanded screenshot, accepted/candidate original-size comparison and accepted/candidate 4x core comparison were opened.
- Metrics: avg `1.1923076923`; median `1`; core `31`; cols `26`; longest `7`; span `682`; lower `10643`; warm `29712`; shadow `152`; dead `0`.
- Against restore #701: core metrics are identical; lower is +7 pixels and warm -3 pixels, both negligible. Original-size and 4x-core inspection show no high-intensity continuity gain.
- Verdict: REJECTED. It preserves 1px but fails the mandatory columns/longest continuity improvement gate.
- Root cause: configuration-vs-momentum subspace area reversal history is effectively inert on the desired direct core. Do not scan the log clamp, total-variation/net-drift normalization, gain, threshold, or simple remaps.
- Rejection log `a347b20c141fcae0d3809c56750948c4b309ea15`.
- Restore `f9d2e490165ffaefefe276f440e7b1232e60ae62`; restored production blobs: shader `130745839c509a727d409992b086e72a6908ce5b`, incidence test `84b2577676b0bc7fc0617bdf14ab68fb5c6bb9a4`.
- Restore Build #707; run `32609873530`; completed success; artifact `9485256978`; digest `sha256:b7d3ade9547a630ce9b7d1082147cf8c010b867c2c32fb5d14a3a8b507540fe6`.
- Restore artifact downloaded and `visual-candidate.png` opened. Fixed metrics returned exactly to #571: avg `1.1923076923`; median `1`; core `31`; cols `26`; longest `7`; span `682`; lower `10636`; warm `29693`; shadow `152`; dead `0`. Restore validated.

### #711 — actual-Kerr finite-time relative growth-rate ordering history — TECHNICALLY INVALID
- Starting accepted checkpoint `517ff50997723e9bcb914adeff6adbf06a39cb7a`, with #703 restore already validated by Build #707.
- Candidate `42695e368321ed936bdf5db34d09c992cadf7329`.
- Candidate blobs: shader `15ae8c854f7073bc3b2a5d51d5d22538e3107043`; incidence test `6ac1bc148cbd3554b468e17166ea77e41288130e`.
- Intended topology: propagate right/up actual-Kerr tangents, compute each reduced phase-space tangent's finite-time logarithmic growth rate per accepted step, retain the longest contiguous path interval on which the right-vs-up growth-rate ordering is unchanged, and use longest-run/path persistence as the sole new width discriminator on frozen #599 continuity support.
- Build #711; run `32612657993`.
- Frontend and Rust fast checks succeeded. Tauri runnable EXE built successfully.
- Native WebView2 capture failed before producing any non-empty WebGL2 frame: `Orb did not produce a non-empty WebGL2 frame within 20000ms; lastTitle=''`.
- Artifact `9486073707`; digest `sha256:872b72487011174d34c3e9ea7964eb0ef487b82b9dd2c25c08725f0de0554ee0`; artifact contains only `visual-baseline-diagnostics.txt` with `build=native-cursor-v5 phase=database-opened`, no screenshots and therefore no valid frozen metrics.
- Root cause is implementation, not topology: candidate used `predictedR = r + dr * acceptedStepLength`, but the baseline loop's in-scope radial derivative is named `dr0`. The resulting GLSL references an undeclared identifier, preventing shader compilation and any non-empty WebGL2 frame.
- Verdict: TECHNICALLY INVALID / UNVERIFIED, not a visual rejection. No topology exclusion was added from #711 itself.
- Forward restore `84ffc3c06fe50c7e9d04ca8d01082e28ddb9784d` restored exact #571 shader/test blobs.
- Restore Build #715; run `32613211196`; completed success; artifact `9486194968`; digest `sha256:594a4cdb0101d1f411bb3799251d4d15128d3dc8a764839f00b55460962db41b`.
- Restore artifact downloaded and `visual-candidate.png` opened. Fixed metrics returned exactly to #571: avg `1.1923076923`; median `1`; core `31`; cols `26`; longest `7`; span `682`; lower `10636`; warm `29693`; shadow `152`; dead `0`.

### #717 — corrected actual-Kerr finite-time relative growth-rate ordering history — REJECTED
- Starting accepted restore `84ffc3c06fe50c7e9d04ca8d01082e28ddb9784d`, validated by Build #715.
- Candidate `f74d8a9fffce706fb43d09955a226afebc4ef0bd`; shader blob `31cc2db1726489613b0645fe9719b409277d45f2`; incidence test blob `6ac1bc148cbd3554b468e17166ea77e41288130e`.
- Topology is the intended #711 growth-order persistence calculation with the implementation-only correction `predictedR = r + dr0 * acceptedStepLength`; no threshold or gain was changed.
- Build #717; run `32613576408`; completed success.
- Artifact `9486299155`; digest `sha256:2102444d8cbe95e1d80894cd2cec2d9924cdb735aaee36e56aa5cde30eaeff98`.
- Candidate/baseline/split/expanded screenshots, accepted-vs-candidate original-size comparison and 4x core comparison were actually opened.
- Frozen metrics: avg `1.1923076923`; median `1`; core `31`; cols `26`; longest `7`; span `682`; lower `10636`; warm `29693`; shadow `152`; dead `0` — exactly #571.
- Visual: no visible continuity gain at original size or 4x core; the candidate reproduces accepted #571.
- Verdict: REJECTED / inert. Do not scan growth-order persistence threshold, smoothstep range, or gain.
- Required action: forward restore exact #571 production blobs and Windows-validate before infrastructure work.

## Current checkpoint
- Accepted baseline remains #571.
- #717 is rejected and logged; its finite-time growth-order persistence family is now excluded from further serial threshold/gain tuning.
- Next action is not a new visual topology. Forward-restore #571, Windows-validate it, then refactor Windows visual experiments for single-build batch capture and machine-readable metrics.

## Batch infrastructure checkpoint — Run #746
- Head `2bff0d4b7c9669191365f3df10517e0388f57e9e`; workflow run `32865832422`; event `workflow_dispatch`; `validation_mode=batch`; Windows batch job `97860751082` completed success.
- Scope of the conclusion is **batch infrastructure only**. Run #746 is not visual acceptance, installer acceptance, or full interaction acceptance; `Full Windows validation` was skipped.
- The Windows visual batch job itself performed one `npm ci` and one `tauri build -- --no-bundle`; the overall workflow also had the independent frontend job and therefore must not be described as one `npm ci` for the whole run.
- One release EXE SHA256 `3d600a575c0effd5a907da87a1c76c17a10099c29a7fc782f1858ac06818eafa` was reused for nine isolated native WebView2 candidate captures. Artifact contained exactly 13 required files and `metrics.jsonl` contained nine parseable rows.
- Four 1.55 repetitions were stable only inside this one runner under the current custom screenshot tolerance. This is not cross-run, cross-GPU, or cross-WebView2 statistical stability and does not imply that 1.55 is closest to the upstream visual.
- Exposure 1.45–1.65 mainly changed brightness/coverage while the lower-half topology remained the same; `batch-summary.json` explicitly had `notAVisualAcceptance=true`.

## Reference-driven lower-geometry experiment — prepared after #746
### Code evidence
- Current production geometry lives in `src/shader/referenceBlackHoleShaderBaseline.ts`.
- `initDngrCameraRay()` initializes one Kerr null ray from `OBSERVER_R`, `OBSERVER_THETA` and the camera plane.
- `rayTracedReference()` advances that ray with the adaptive Kerr integrator. Disk images are generated only when `theta - PI/2` changes sign; the crossing radius must lie between `DISK_INNER` and `DISK_OUTER`. Multiple crossings are accumulated rather than mirrored/copied.
- Upstream `s0xDk/ghostty-blackhole/blackhole.glsl` uses the corresponding physical mechanism: an explicitly inclined thin-disk normal `n=vec3(0,sin(incl),cos(incl))`, Schwarzschild geodesic integration, and repeated `dot(x,n)` sign changes to collect far-side and higher-order disk images.
- Upstream Gargantua preset in `tuner/Sources/BlackHoleTuner/ParamSpec.swift` uses `DISK_INCL=1.52`, `DISK_INNER=2.2 r_s`, `DISK_OUTER=7.0 r_s`. Current observer inclination `1.515` and current inner edge `4.2M` are already close after the Schwarzschild conversion `r_s=2M` (`2.2 r_s≈4.4M`). The strongest scale mismatch is current `DISK_OUTER=35M` versus upstream-equivalent `≈14M`.

### Geometry loss contract
The upstream reference image is the real `s0xDk/ghostty-blackhole/presets-grid.png`, Gargantua panel (top-middle third). Final ranking must apply the same contour extraction to that crop and to full-size Windows originals; brightness/count metrics remain auxiliary only.

Primary geometry vector, normalized so image scale alone cannot win:
1. `lowerReach`: lowest connected lower-disk point minus direct-disk center row, divided by shadow diameter.
2. `upperLowerHeightRatio`: lower vertical reach divided by upper vertical reach; target is the Gargantua panel value, not an assumed value of 1.
3. `lowerHorizontalSpan`: first-to-last connected lower-band x extent divided by shadow diameter.
4. `centralNotchDepth`: distance from the direct-disk center row to the first connected lower-band pixel in a narrow center column window, divided by lower vertical reach.
5. `lowerBandThickness`: median connected lower-band vertical thickness divided by shadow diameter.
6. `lowerContinuity`: fraction of x columns between lower-band endpoints that contain connected lower-band support, plus longest contiguous-column fraction as a tie-breaker.

The geometry loss is the mean absolute normalized error of those six components against the real Gargantua crop. Frozen ROI brightness metrics (`avg/core/lower/warm/...`) remain diagnostics and must not dominate selection.

Anti-cheat/failure rule: reducing the upper arch alone is not improvement. A candidate is rejected if `lowerReach` falls by more than 5% from control, if lower continuity breaks, or if fewer than three of the six primary geometry components move toward the reference even when the total bright/warm pixel count improves.

### Single-factor matrix
Only `DISK_OUTER` changes. `FILM_DISK_EXPOSURE` remains 1.55 for every candidate. Values are derived from the accepted `35M` scale and the upstream Gargantua target `7 r_s≈14M`, not arbitrary brightness tuning:

| id | DISK_OUTER | hypothesis | expected geometry direction | failure criterion |
| --- | ---: | --- | --- | --- |
| control | 35 | accepted #571 geometry | baseline | n/a |
| smoke-01 | 32 | weak contraction tests sensitivity | slightly reduce oversized far-source contribution without losing lower reach | geometry vector effectively unchanged or lower reach decreases |
| smoke-02 | 29 | continue source-radius contraction | lower span/notch starts moving toward reference | only brightness/counts change |
| smoke-03 | 26 | mid-range source contraction | upper/lower proportions converge while lower band remains continuous | upper shrinks but lower shape stays narrow/circular |
| smoke-04 | 23 | stronger contraction | lower-band span/thickness moves toward reference | lower continuity or reach regresses >5% |
| smoke-05 | 20 | enter reference-scale neighborhood | center notch and lower span improve together | only direct disk shortens |
| smoke-06 | 18 | near-reference source extent | lower geometry loss drops without topology break | lower ring fragments or collapses |
| smoke-07 | 16 | bracket upstream-equivalent target | test whether optimum lies just above 14M | lower reach/span overshoot or collapse |
| smoke-08 | 14 | upstream Gargantua-equivalent outer radius | closest source-radius scale match | no primary geometry advantage over control |

If this sweep fails the anti-cheat rule, stop scanning `DISK_OUTER`; the next mechanism to investigate is camera/projection or disk-plane orientation/intersection, not exposure and not another outer-radius micro-scan.

## Prepared checkpoint after #746
- Accepted visual baseline remains #571; no new candidate has been visually accepted.
- Run #746 establishes only the batch infrastructure boundary described above.
- Geometry sweep implementation is prepared on the working branch but has not run until a new real Windows batch Run ID and artifact exist.
- Required gate before batch dispatch: ordinary PR Windows visual CI must succeed at the new head.
