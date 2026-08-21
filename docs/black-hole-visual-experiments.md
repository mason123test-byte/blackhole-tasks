# Black-hole visual experiment log

This file is the canonical experiment registry for `agent/initial-blackhole-tasks`.
It was consolidated after #627 because #607/#613/#621 had been recorded in scattered follow-up files/commits instead of this canonical path. Older verbose detail remains available in Git history, including prior canonical blob `c9f461a90a95edc52c0f4c3fba7d15ad43e30df8` and experiment-specific history. This registry preserves the acceptance baseline, fixed measurement definitions, every active exclusion family, and the recent propagation experiments needed to avoid duplicate work.

## Permanent rules

- Current accepted visual baseline: `#571`.
- Frozen geometry: do not change `DISK_OUTER`, `OBSERVER_THETA`, Kerr/geodesic stepping, disk-crossing structure, BH/disk/observer geometry, or use geometry changes to fake photometric improvement.
- One WebGL2 numerical Kerr path only. No Canvas2D, framebuffer mirror/flip, copied lower half, fake annulus, second renderer, silent fallback, `screen.y` hard patches, or screen-space neighborhood ridge selector.
- Do not use source texture/final RGB brightness as a transfer classifier.
- Candidate implementation + test are atomic; `update_ref` is fast-forward only (`force=false`). No reset/rebase/force push/noop/temp files.
- Every candidate requires GitHub-hosted Windows `windows-latest`, runnable Tauri release EXE, native WebView2 capture, artifact upload, actual image inspection, and fixed-metric validation before acceptance.
- Rejected candidates are logged, then production is forward-restored to the accepted baseline before any new topology is mounted.

## Fixed visual measurements

- Core ROI: `y330:385, x80:840`; bright-core pixel = mean RGB `>180`.
- High-intensity columns: core ROI x-columns containing >=1 bright-core pixel.
- Average core thickness: bright-core pixels / active high-intensity columns.
- Median thickness: median bright-core pixel count among active columns.
- Longest run: longest contiguous run of active high-intensity columns.
- Lower ROI: `y360:510, x80:840`; mean RGB `>60`.
- Warm ROI: `y180:520, x80:840`; `R > B + 8` and mean RGB `>60`.
- Direct span: row `y=354`, mean RGB `>60`, max-x minus min-x + 1.
- Shadow ROI: `y285:345, x410:510`, mean RGB `>5`.
- Dead white: exact RGB `(255,255,255)` count.
- Measurement scripts/ROIs/thresholds are frozen.

## Accepted baseline

### #571 — incidence-qualified thinning + sub-white warm shoulder shelf — ACCEPTED
- Candidate `d837208847b9f0ec307f1d100d14759271bb7b2b`.
- Windows Build `#571`; run `32385189946`; workflow `328346937`.
- Artifact `9412866330`; digest `sha256:02996f49b3622af1942321d7011443e7ffee2eec2107493ec7bd7bf182f08e99`.
- Physical classifier: first crossing + path stretch `1.05–1.45` + local incidence `0.07–0.26`; shoulder `0.58–0.72`, suppression floor `0.38`, high-core protection unchanged.
- Warm shelf: support `0.22–0.68`, peak `min(0.68, directPeak*0.94)`, tint `vec3(1.0,0.93,0.74)`.
- Metrics: average `1.1923076923 px`; median `1`; core `31`; columns `26`; longest `7`; span `682`; lower `10636`; warm `29693`; shadow `152`; dead white `0`.
- Strength: true ~1px core and stable geometry/lower/warm/shadow. Weakness: horizontal high-intensity continuity is too short.
- Production blobs: `referenceBlackHoleShader.ts=130745839c509a727d409992b086e72a6908ce5b`, `referenceBlackHoleIncidence.test.ts=84b2577676b0bc7fc0617bdf14ab68fb5c6bb9a4`, `blackHoleRenderer.ts=ec217566ab098891461ecb35e94dfa2d8827dd96`, `blackHoleRenderer.test.ts=c666e899a98deb32e4b6f1ceccf0b1f567484af0`, `referenceBlackHoleShaderBaseline.ts=bc4c6f96dad7f32d6ba671b85371803a079c6b3c`.

## Active exclusions from earlier experiments

1. No global flare increase without independent core protection (#477).
2. No far-flare LOD `6.0–7.0` sweep (#481/#483).
3. No strong generic screen-space negative-detail suppression (#485/#487/#489).
4. No simple `microCore` strength raising (#491/#493).
5. No screen-space neighbor ridge selectors (#513/#517).
6. No multi-scale 1px/2px screen-space redistribution/gain scan (#527/#529).
7. First crossing alone is not a direct-image identity (#535).
8. Radial-leg identity is too broad (#541).
9. Raw `diskPhi` is not a sufficient direct-image identity; do not scan `1.15–2.75` (#545).
10. Standalone path stretch broad suppression is too destructive (#553); path stretch only works with incidence qualification.
11. Do not retune the accepted #561/#571 path-stretch/local-incidence semantic gates or shoulder threshold family (#559/#561).
12. Do not return to #567 scalar warm-tint recovery (`0.78/0.60/0.84`).
13. No source peak/alpha-only knife-core scan (#575: peak `0.76–0.88`, alpha `0.44–0.72`, nearby core strengths).
14. No source-texture residual recovery scan (#581: support `0.055–0.24`, `+0.22` lift, nearby gains).
15. No standalone local-polar-momentum core reconstruction scan (#585: `0.10–0.22`, fixed `0.82`, nearby scalar variants). Polar momentum is retained only as known continuity semantics when paired with an independent width discriminator.
16. No polar-path detour scan (#591: `1.02–1.18`).
17. No first-order incidence-Jacobian threshold scan (#599: `3.2–5.2`). It may remain unchanged as known continuity support, but its scalar window is frozen.
18. No normalized second-derivative/fold-curvature scan (#603: `0.08–0.22`).
19. No `polarMomentum + incidenceCosine` 2D transfer determinant scan (#607: `0.45–1.35`).
20. No crossing-point radial/polar momentum-gradient shear scan (#613: `0.30–0.70`).
21. No propagated single-axis scalar Jacobi-compression scan (#621: `0.035–0.11`).
22. No uncoupled two-polarization Jacobi-shear threshold scan (#627: `0.045–0.16`).
23. Geometry remains frozen.

## Recent continuity / width experiments

### #599 — polar-momentum continuity + first-order incidence Jacobian — REJECTED
- Candidate `92ca02ba98e735f671c5f6259da86a70a40288d7`; Windows Build `#599`; run `32449303088`; workflow `328346937`.
- Artifact `9435214835`; digest `sha256:b89d38f7d3c5fdc1602d8e345cd18da259b1a27b2c8fd032c6fe9e7ad7236314`.
- Topology: keep #571 response, add polar-momentum continuity, then use camera-up `±0.002` only through `initDngrCameraRay` to estimate local `|d incidence/d cameraUp|`; no neighboring geodesic integration.
- Metrics: average `2.1608391608`; median `2`; core `309`; columns `143`; longest `45`; span `682`; lower `10988`; warm `30113`; shadow `152`; dead `0`.
- Visual: first strong continuity recovery with acceptable lower/warm energy, but still a ~2px bright band.
- Root cause: first-order local slope is not a 1px caustic-width discriminator.
- Do not scan `3.2–5.2` or nearby scalar thresholds.

### #603 — three-point polar-transfer curvature — REJECTED
- Candidate `734e2d536c925dbd788b2ed5f63cc6b5e6fbc31c`; Build `#603`; run `32450568043`; artifact `9435633965`; digest `sha256:b060d15dc443a512b4e63c55e4e5724192ce4024b212a682e1839b71b775ea2e`.
- Metrics: average `2.608`; median `2`; core `133`; columns `51`; longest `31`; span `682`; lower `10640`; warm `29846`; shadow `152`; dead `0`.
- Visual/root cause: normalized second derivative selects localized still-thick folds and destroys #599 continuity. Do not scan `0.08–0.22`.

### #607 — `polarMomentum + incidenceCosine` transfer-area determinant — REJECTED
- Candidate `b3e3fbe49a26f78f6cde04502a28d55f0d78e749`; Build `#607`; run `32458144578`; workflow `328346937`.
- Artifact `9438113192`; digest `sha256:044bd57ab62b6122cc898323837e43d8c4c1a94d1ea677fdd0db5ac6dffa923b`.
- Metrics: average `1.1923076923`; median `1`; core `31`; columns `26`; longest `7`; span `682`; lower `10636`; warm `29692`; shadow `152`; dead `0`.
- Visual/root cause: candidate is effectively #571; the two transfer coordinates are locally too correlated to create useful area information. Do not scan `0.45–1.35`.

### #613 — radial/polar momentum-gradient shear — REJECTED
- Candidate `d0472c1f0fad55e91a63e2322753ff1a0ce46059`; Build `#613`; run `32461261474`; workflow `328346937`.
- Artifact `9439158197`; digest `sha256:f0ad1796bf35d2660eba4b858fbf3138e1d29acd7ed2e94f0868451a69d1379f`.
- Metrics: average `2.1786`; median `2`; core `305`; columns `140`; longest `45`; span `682`; lower `10904`; warm `30006`; shadow `152`; dead `0`.
- Visual/root cause: independent crossing-point shear preserves #599 continuity but does not rank vertical width. Do not scan `0.30–0.70`.

### #621 — propagated scalar Jacobi focusing — REJECTED
- Candidate `020dc5a8467d0d83598c6555e8147376bd33ae1f`; Build `#621`; run `32468881925`; workflow `328346937`.
- Artifact `9442063691`; digest `sha256:5e8640f652f7f24a32f90c8b9dddd8f885ba76ac880f8990332f71c9992180bb`.
- Topology: along the actual main geodesic propagate `J=0, J'=1` with `J'' + (3/r^3)J = 0`; at first hit use compression `1-|J|/pathLength` to gate unchanged #599 continuity support. No second geodesic or framebuffer neighbor sampling.
- Metrics: average `2.0364963504`; median `2`; core `279`; columns `137`; longest `29`; span `682`; lower `10660`; warm `29800`; shadow `152`; dead `0`.
- Visual/root cause: propagation-domain information improves average thickness but fragments continuity and remains 2px median. Do not scan `0.035–0.11`.
- Operational note: accidental contents-API commit `149c890db67d8bb4fb0f49cd8041812ae65b037f` created `DO_NOT_USE.txt`; forward Git-object candidate `020dc5...` deleted it. This mistake must not be repeated.
- Result log commit `caad12933446f0a2a9f7f2c2aeb7c31dc9c4e0b9`; restore `7ec6e1f3a491237410d4a8b06630bc031a7ffb9f`.
- Restore validation: Windows Build `#625`, run `32470013456`, completed success; artifact `9442604825`, digest `sha256:f41e43464c8933e4128717281e9a55f5765e730467be239d3db598e34aae4ac5`.

### #627 — uncoupled two-polarization Jacobi propagation shear — REJECTED
- Starting accepted HEAD `7ec6e1f3a491237410d4a8b06630bc031a7ffb9f` (`#571` production blobs); #625 restore validation already successful.
- Unique topology: propagate two orthogonal scalar Jacobi modes on the same main geodesic: `Jfocus'' + K*Jfocus = 0`, `Jdefocus'' - K*Jdefocus = 0`, `K=3/r^3`. At the real first disk hit compute normalized scales `focusScale=|Jfocus|/pathLength`, `defocusScale=|Jdefocus|/pathLength`, then `jacobiShear=|defocusScale-focusScale|/(defocusScale+focusScale)`. Multiply `smoothstep(0.045,0.16,jacobiShear)` into the unchanged #599 continuity support. No neighboring geodesic, framebuffer neighborhood, source texture gate, geometry/stepping/crossing change, or second renderer.
- Candidate `4cc0c81a870354fa836f1ba0e105a461505f58ff`.
- Windows Build `#627`; run `32503599689`; workflow `328346937`; URL `https://github.com/mason123test-byte/blackhole-tasks/actions/runs/32503599689`.
- Artifact `9454661750`; digest `sha256:5164fbd1a040f19e4958f79eb13d967a1f81674801b009d37d3fa2111114794a`.
- Fast checks, Tauri release EXE, native WebView2 capture and artifact upload all succeeded.
- Required images opened: `visual-candidate.png`, `visual-baseline.png`, `visual-split.png`, `02-single-scene-expanded.png`, #571/#627 original-size side-by-side, and #571/#627 4x core comparison.
- Fixed metrics: average `1.800 px`; median `2`; core `225`; columns `125`; longest `29`; span `682`; lower `10657`; warm `29770`; shadow `152`; dead `0`.
- Relative to #571, continuity is substantially higher (`26->125` columns, `7->29` longest) and lower/warm/span/shadow remain in tolerance, but median thickens `1->2` and average rises `1.192->1.800`, violating hard acceptance criteria.
- Original-size visual: clearly more continuous than #571. Core enlargement: selected ridge is still visibly ~2px through substantial stretches, not a long 1px knife edge.
- Verdict: rejected. Root cause: uncoupled opposite-sign scalar Jacobi modes provide anisotropy magnitude but not the coordinate-invariant rank deficiency of a genuinely coupled 2D bundle map; the same broad family remains selected.
- Do not scan `jacobiShear` gate `0.045–0.16` or nearby scalar values.
- Restore commit: pending immediate forward restore in the next commit; production must return to the exact #571 blobs before the next candidate.
- Next topology: propagate a coupled 2x2 Jacobi matrix driven by a trace-free local optical-tidal tensor oriented from the main-ray momentum, then use normalized matrix rank deficiency / determinant (or smallest singular value) at the physical first hit to identify one-dimensional fold collapse. Do not reuse the uncoupled shear threshold.

## Operational notes

- #499 TypeScript syntax failure and #511 test-text typo were non-visual failures.
- #553 first visual capture failed transiently; identical SHA rerun succeeded.
- #559 initial workflow was cancelled before steps; same SHA later validated successfully.
- Historical accidental temp/noop commits were cleaned only by normal forward commits and never accepted. No future temp/noop/contents-API placeholders are allowed.

## Current checkpoint

- Accepted visual baseline remains `#571`.
- #627 is rejected and must be forward-restored before any new candidate.
- The next meaningful experiment is a coupled 2x2 Jacobi rank-deficiency/fold observable, not another scalar threshold scan or crossing-point algebraic derivative.
