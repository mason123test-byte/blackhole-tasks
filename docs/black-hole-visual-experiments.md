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
- Direct span row `y=354`, mean RGB `>60`.
- Shadow ROI `y285:345, x410:510`, mean RGB `>5`.
- Dead white = exact `(255,255,255)` count.

## Accepted baseline
### #571 — ACCEPTED
- Candidate `d837208847b9f0ec307f1d100d14759271bb7b2b`; Build `#571`; run `32385189946`; artifact `9412866330`; digest `sha256:02996f49b3622af1942321d7011443e7ffee2eec2107493ec7bd7bf182f08e99`.
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
13. No pooled two-axis pre-hit configuration–momentum focusing-alignment normalization/gain/threshold scan (#677): strongest negative phase-space correlation saturates the #599 continuity family and reproduces its 2px ridge.
14. Geometry remains frozen.

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
- Starting accepted restore `bff468984693ebcc46efc5dbb182bd85e79ba036`, validated by Build #667.
- Candidate `6c1d3efac73ca4a3e27b723e7da8a33503c2ec14`; unique topology: two actual-Kerr tangent directions; per accepted step build `(delta r/r, delta theta)` map, extract `A*A^T` principal-axis double-angle, accumulate absolute orientation rotation, and use crossing-fraction twist normalized by 90 degrees on frozen #599 support.
- Build #669; run `32561626642`; artifact `9473013092`; digest `sha256:66970c2b3073c5b92044521bf94a3ecf14d54f787cb7980d2111eda4857cbfae`.
- Required candidate/baseline/split/expanded, accepted/candidate original, and 4x core images opened.
- Metrics: avg `2.1608391608`; median `2`; core `309`; cols `143`; longest `45`; span `682`; lower `10988`; warm `30103`; shadow `152`; dead `0`.
- Visual: long ridge but clear ~2px core. Essentially recreates #599.
- Root cause: cumulative absolute spatial-axis twist saturates across the continuity family and carries no vertical-width discrimination. Do not scan twist normalization/gain/threshold.
- Log `299702171c5a4cce0ae499681d28c714d314a680`; restore `9d7816e4be999a3355055cc2bf71da99fd6db969`.
- Restore Build #673; run `32562060526`; completed success; artifact `9473191345`; digest `sha256:9dfea4618aad1ea63ab784747ae53bf3524d75806ae7b26a834f80631cb864c3`.
- Restored production blobs: shader `130745839c509a727d409992b086e72a6908ce5b`; incidence test `84b2577676b0bc7fc0617bdf14ab68fb5c6bb9a4`.

### #677 — actual-Kerr configuration–momentum focusing alignment history — REJECTED
- Starting accepted checkpoint `952d99d318f86019edf166f93cbb906abbc84a67`; production blobs exactly #571 before candidate.
- Candidate `097cc27805d77cb4a494f3dc2ea9540c11d08c8e`.
- Unique topology: propagate the same two actual-Kerr camera tangents used by #669, form the normalized phase-space bundle vectors `q=(delta r/r, delta theta)` and `p=(delta pr, delta ptheta/r)` for both tangent axes, evaluate threshold-free negative correlation `max(0,-dot(q,p)/(|q||p|))` at each accepted pre-hit state, and retain the strongest focusing alignment before the first disk crossing. No second geodesic, endpoint singular spectrum, spatial-axis twist, framebuffer neighborhood, source texture, RGB, or `screen.y` classifier.
- Frozen continuity support remains #599 semantics: polar momentum `0.10–0.22` and incidence Jacobian `3.2–5.2`; the only new discriminator is the threshold-free focusing-alignment history scalar.
- Build #677; run `32567370649`; workflow `328346937`; completed success.
- Artifact `9474499603`; digest `sha256:95c90f0352922df54d70f45aecf5f8b1c1999cbfb0c86f2e97b232a67de651aa`.
- Tauri runnable EXE build, native WebView2 capture and artifact upload succeeded. `visual-candidate.png`, `visual-baseline.png`, `visual-split.png`, expanded screenshot, accepted/candidate original-size comparison, and accepted/candidate 4x core comparison were opened.
- Metrics: avg `2.1608391608`; median `2`; core `309`; cols `143`; longest `45`; span `682`; lower `10988`; warm `30091`; shadow `152`; dead `0`.
- Visual: the direct ridge becomes long and continuous, but the accepted ~1px core becomes a clearly thicker ~2px band. The 4x core view confirms vertical thickening across the recovered ridge.
- Verdict: REJECTED. It violates the median=1 and avg<=~1.30 hard gates despite matching the desired #599-style 45-column continuity.
- Root cause: pooled strongest negative configuration–momentum correlation saturates across the same continuity family as #599 and does not separate the one-pixel fold from its vertically adjacent response. Do not scan correlation normalization, gain, clamp, or threshold.
- Restore pending from accepted #571 blobs.

## Current checkpoint
- Accepted baseline remains #571.
- #677 is rejected and must be forward-restored before any new candidate.
- Next orthogonal topology after restore: actual-Kerr **axis-differential phase-space focusing anisotropy history**. Keep the two propagated tangents, compute right-axis and camera-up-axis normalized configuration–momentum contraction separately, and use their pre-hit differential/anisotropy as the single width discriminator instead of pooled correlation. Do not scan the rejected pooled-correlation family.
