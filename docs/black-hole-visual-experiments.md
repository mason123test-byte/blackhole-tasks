# Black-hole visual experiment log

Canonical registry for `agent/initial-blackhole-tasks`.

## Permanent rules
- Accepted visual baseline: `#571`.
- Geometry frozen: do not change `DISK_OUTER`, `OBSERVER_THETA`, Kerr/geodesic stepping, disk-crossing structure, BH/disk/observer geometry, or use geometry changes to fake photometric improvement.
- One WebGL2 numerical Kerr path only. No Canvas2D, framebuffer mirror/flip, copied lower half, fake annulus, second renderer, silent fallback, `screen.y` hard patches, or screen-space neighborhood ridge selector.
- Do not use source texture/final RGB brightness as a transfer classifier.
- Candidate implementation + test are atomic. `update_ref(force=false)` only; no reset/rebase/force push/noop/temp files/contents-API placeholders.
- Every candidate requires GitHub-hosted Windows `windows-latest`, runnable Tauri release EXE, native WebView2 capture, artifact upload, actual image inspection, and fixed-metric validation.
- Rejected candidates are logged, production is forward-restored to #571, restore production blobs are checked, and a restore Windows run is completed before another candidate is mounted.

## Fixed measurements
- Core ROI `y330:385, x80:840`, bright core = mean RGB `>180`.
- High-intensity columns = columns with >=1 bright-core pixel.
- Average thickness = bright-core pixels / active columns; median thickness = median count among active columns; longest run = longest contiguous active-column run.
- Lower ROI `y360:510, x80:840`, mean RGB `>60`.
- Warm ROI `y180:520, x80:840`, `R > B + 8` and mean RGB `>60`.
- Direct span row `y=354`, mean RGB `>60`.
- Shadow ROI `y285:345, x410:510`, mean RGB `>5`.
- Dead white = exact `(255,255,255)` count.
- Measurement scripts/ROIs/thresholds are frozen.

## Accepted baseline
### #571 — ACCEPTED
- Candidate `d837208847b9f0ec307f1d100d14759271bb7b2b`; Build `#571`; run `32385189946`; workflow `328346937`; artifact `9412866330`; digest `sha256:02996f49b3622af1942321d7011443e7ffee2eec2107493ec7bd7bf182f08e99`.
- Metrics: avg `1.1923076923`; median `1`; core `31`; columns `26`; longest `7`; span `682`; lower `10636`; warm `29693`; shadow `152`; dead `0`.
- Production blobs: shader `130745839c509a727d409992b086e72a6908ce5b`; incidence test `84b2577676b0bc7fc0617bdf14ab68fb5c6bb9a4`; renderer `ec217566ab098891461ecb35e94dfa2d8827dd96`; renderer test `c666e899a98deb32e4b6f1ceccf0b1f567484af0`; baseline shader `bc4c6f96dad7f32d6ba671b85371803a079c6b3c`.

## Active exclusions
1. No global flare increase without core protection (#477).
2. No far-flare LOD `6.0–7.0` sweep (#481/#483).
3. No strong generic screen-space negative-detail suppression (#485/#487/#489).
4. No simple `microCore` strength raising (#491/#493).
5. No screen-space neighbor ridge selectors (#513/#517).
6. No multi-scale screen-space redistribution/gain scan (#527/#529).
7. First crossing alone is not a direct-image identity (#535).
8. Radial-leg identity is too broad (#541).
9. No raw `diskPhi` scan `1.15–2.75` (#545).
10. Standalone path-stretch broad suppression is too destructive (#553); accepted #561/#571 incidence/path semantics stay frozen.
11. No #567 scalar warm-tint recovery scan.
12. No source peak/alpha knife-core scan (#575).
13. No source-texture residual recovery (#581).
14. No standalone local-polar-momentum reconstruction scan (#585); polar momentum may remain only as frozen continuity semantics paired with an independent width observable.
15. No polar-path detour scan `1.02–1.18` (#591).
16. No first-order incidence-Jacobian scan `3.2–5.2` (#599).
17. No second-derivative/fold-curvature scan `0.08–0.22` (#603).
18. No `polarMomentum + incidenceCosine` endpoint determinant scan `0.45–1.35` (#607).
19. No crossing-point radial/polar gradient shear scan `0.30–0.70` (#613).
20. No propagated scalar Jacobi-compression scan `0.035–0.11` (#621).
21. No uncoupled two-polarization Jacobi-shear scan `0.045–0.16` (#627).
22. No endpoint-only coupled 2x2 simplified Jacobi rank-deficiency rescue/threshold scan (#633).
23. No simplified coupled 2x2 Jacobi minimum-rank/conjugate-history rescue or gain scan (#639).
24. No Kerr-vs-spinless azimuthal transport fraction threshold/gain/sign/cancellation scan (#645).
25. No single-axis full-Kerr tangent-linear radial-transfer-compression threshold/gain scan (#651).
26. No normalized full-Kerr first-hit 2x2 transfer rank-deficiency threshold/gain/determinant remap (#657): it selects more columns but thickens to median 2px.
27. No full-Kerr first-hit absolute minimum-singular-transfer threshold/gain/remap (#663): it collapses to #571.
28. No static endpoint singular-spectrum scans of the same first-hit 2x2 tangent map; both rank angle and absolute `sigma_min` are excluded.
29. No cumulative absolute principal-axis twist normalization/gain/threshold scan (#669): it saturates the #599 continuity family and reproduces the 2px ridge.
30. Geometry remains frozen.

## Recent continuity / propagation experiments
### #599 — continuity reference — REJECTED
- Candidate `92ca02ba98e735f671c5f6259da86a70a40288d7`; Build `#599`; run `32449303088`; artifact `9435214835`.
- Metrics: avg `2.1608391608`; median `2`; core `309`; cols `143`; longest `45`; span `682`; lower `10988`; warm `30113`; shadow `152`; dead `0`.
- Strong continuity, wrong ~2px thickness. Keep only the continuity semantics frozen.

### #603 / #607 / #613 — endpoint/local derivative family — REJECTED
- #603 second derivative curvature: avg `2.608`, median `2`, core `133`, cols `51`, longest `31`.
- #607 endpoint determinant: effectively #571.
- #613 radial/polar gradient shear: avg `2.1786`, median `2`, core `305`, cols `140`, longest `45`.

### #621 / #627 / #633 / #639 — simplified Jacobi family — REJECTED
- #621 scalar: avg `2.0365`, median `2`, cols `137`, longest `29`; restore Build #625 success.
- #627 uncoupled two-polarization: avg `1.800`, median `2`, cols `125`, longest `29`; restore Build #631 success.
- #633 endpoint 2x2 rank deficiency: exactly #571; restore Build #637 success.
- #639 history conjugate proximity: exactly #571 core; restore Build #643 success.

### #645 — Kerr azimuthal transport excess — REJECTED
- Candidate `5efef46ec28ff530bb98b702d3962265873489f1`; Build `#645`; run `32539376836`; artifact `9466591984`; digest `sha256:cef7b99560d6300b1005581a92c8a007564286140c15cb86149e1fd81a198661`.
- Metrics: avg `1.1923`; median `1`; core `31`; cols `26`; longest `7`; lower `10653`; warm `29709`.
- Restore `dff75c56196cb4b7e8cea58a1efcd1d4a35d8cf5`; restore Build #649 success.

### #651 — full-Kerr camera-up radial tangent compression — REJECTED
- Candidate `f4aff8c9ed1332e51600f3b54fa6916e41b2c45d`; Build `#651`; run `32540412278`; artifact `9467001533`; digest `sha256:53bacf11a5ebceaa94d1807a2669fdc02b77f6d5872c4577d9eba3bca6f88937`.
- Metrics exactly #571 core; warm `29705`.
- Log `e9c1bd184e60f5a87627a9ae98428812ef9cd36e`; restore `44245e0ead1d804991eb61c81e942f402cee4e4e`; restore Build #655 success.

### #657 — full-Kerr first-hit 2x2 transfer rank deficiency — REJECTED
- Candidate `40bf8b2465b8015c6e27b87329037974505e9e48`; Build `#657`; run `32543508966`; workflow `328346937`; artifact `9467938985`; digest `sha256:ef393fecc3f69269d9305f63df1f63ddaed6c8265a169bfaacf047b18dc00883`.
- Metrics: avg `1.600`; median `2`; core `104`; cols `65`; longest `11`; span `682`; lower `10691`; warm `29792`; shadow `152`; dead `0`.
- Log `199d78959433a315686191024f95a8f851f9b92c`; restore `fdf7c0f4db5616bd04199e8adede1b8bf7692dce`; restore Build `#661`, run `32547472046`, success; artifact `9469063725`; digest `sha256:672e8768ed100b40e8bca04f8379e94c6c234b48b3b62e78de87ec7de0256e4e`.

### #663 — full-Kerr first-hit absolute minimum singular transfer — REJECTED
- Candidate `24fc054c5e70a2fad93d8fb82d656e70462a39da`; Build `#663`; run `32547882914`; artifact `9469193500`; digest `sha256:5fe307df5b677752a0800b82db37dd1cd0ebe994094129b241588a7d9d68f060`.
- Metrics: avg `1.1923076923`; median `1`; core `31`; cols `26`; longest `7`; span `682`; lower `10637`; warm `29700`; shadow `152`; dead `0`.
- Static endpoint `sigma_min` carries no useful ridge separation.
- Log `a40b1ab97686bfcd2bfa3d4e97900670b03efc56`; restore `bff468984693ebcc46efc5dbb182bd85e79ba036`; restore Build `#667`; run `32548354461`; success; artifact `9469326168`; digest `sha256:b8db6e28858d072560866bb0c2c11540d958a6e66ddbc9bdcf785111d8202a39`.
- Restored production blobs: shader `130745839c509a727d409992b086e72a6908ce5b`, incidence test `84b2577676b0bc7fc0617bdf14ab68fb5c6bb9a4`.

### #669 — full-Kerr propagation-history principal-axis twist — REJECTED
- Starting accepted production: restore `bff468984693ebcc46efc5dbb182bd85e79ba036`, fully validated by Build #667.
- Unique topology: propagate two actual-Kerr tangent-linear camera directions along the same physical main ray. At every accepted step build the 2x2 `(delta r / r, delta theta)` tangent map, extract the principal-axis double-angle from `A*A^T`, and accumulate absolute principal-axis rotation. At first physical disk crossing use only the crossing fraction of the final step. Normalize accumulated twist by a physical 90-degree rotation (`0.5*PI`) and multiply the unchanged #599 continuity support. No endpoint determinant or singular value is used.
- Candidate `6c1d3efac73ca4a3e27b723e7da8a33503c2ec14`.
- Windows Build `#669`; run `32561626642`; workflow `328346937`; artifact `9473013092`; digest `sha256:66970c2b3073c5b92044521bf94a3ecf14d54f787cb7980d2111eda4857cbfae`.
- Frontend typecheck/lint/Vitest, Rust fast checks, Tauri release EXE, native Windows WebView2 capture, and artifact upload all succeeded.
- Required images opened: `visual-candidate.png`, `visual-baseline.png`, `visual-split.png`, `02-single-scene-expanded.png`, #571/#669 original-size side-by-side, and #571/#669 4x core enlargement.
- Fixed metrics: avg `2.1608391608`; median `2`; core `309`; cols `143`; longest `45`; span `682`; lower `10988`; warm `30103`; shadow `152`; dead `0`.
- Visual: the direct ridge is substantially longer, but the core enlargement shows a clear ~2px bright band. The core metrics are essentially #599, not a 1px knife edge.
- Verdict: rejected.
- Root cause: cumulative absolute principal-axis twist saturates across the entire #599 continuity family, so it carries continuity identity but not vertical-width discrimination.
- Do not rescue by retuning the 90-degree normalization, adding a twist threshold/gain, or scanning cumulative absolute twist variants.
- Restore commit: pending immediate normal forward restore after this log commit.

## Operational notes
- Historical accidental contents-API/temp/noop commits were cleaned only by normal forward commits and never accepted. Do not repeat them.
- #499/#511 were non-visual code/test failures; #553 first visual capture was transient; #559 initial workflow was cancelled before steps and later validated on the same SHA.

## Current checkpoint
- Accepted baseline remains #571.
- #669 is rejected and must be forward-restored before another candidate.
- Next experiment must be materially orthogonal to cumulative principal-axis twist and to the excluded endpoint singular spectrum. A viable direction is an actual-Kerr finite-time tangent-bundle phase-space stretching observable (Lyapunov/area-growth history) that uses propagated tangent-state growth rather than endpoint rank, singular values, or accumulated orientation rotation.
