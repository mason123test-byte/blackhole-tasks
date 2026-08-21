# Black-hole visual experiment log

Canonical registry for `agent/initial-blackhole-tasks`.

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
- Metrics: average `1.1923076923`; median `1`; core `31`; columns `26`; longest `7`; span `682`; lower `10636`; warm `29693`; shadow `152`; dead `0`.
- Production blobs: `referenceBlackHoleShader.ts=130745839c509a727d409992b086e72a6908ce5b`, `referenceBlackHoleIncidence.test.ts=84b2577676b0bc7fc0617bdf14ab68fb5c6bb9a4`, `blackHoleRenderer.ts=ec217566ab098891461ecb35e94dfa2d8827dd96`, `blackHoleRenderer.test.ts=c666e899a98deb32e4b6f1ceccf0b1f567484af0`, `referenceBlackHoleShaderBaseline.ts=bc4c6f96dad7f32d6ba671b85371803a079c6b3c`.

## Active exclusions

1. No global flare increase without independent core protection (#477).
2. No far-flare LOD `6.0–7.0` sweep (#481/#483).
3. No strong generic screen-space negative-detail suppression (#485/#487/#489).
4. No simple `microCore` strength raising (#491/#493).
5. No screen-space neighbor ridge selectors (#513/#517).
6. No multi-scale screen-space redistribution/gain scan (#527/#529).
7. First crossing alone is not a direct-image identity (#535).
8. Radial-leg identity is too broad (#541).
9. Do not scan raw `diskPhi` `1.15–2.75` (#545).
10. Standalone path stretch broad suppression is too destructive (#553).
11. Do not retune accepted #561/#571 path-stretch/local-incidence semantic gates or shoulder thresholds.
12. Do not return to #567 scalar warm-tint recovery.
13. No source peak/alpha knife-core scan (#575).
14. No source-texture residual recovery scan (#581).
15. No standalone local-polar-momentum reconstruction scan (#585); polar momentum may remain only as frozen continuity semantics when paired with an independent width observable.
16. No polar-path detour scan `1.02–1.18` (#591).
17. No first-order incidence-Jacobian scalar scan `3.2–5.2` (#599).
18. No normalized second-derivative/fold-curvature scan `0.08–0.22` (#603).
19. No `polarMomentum + incidenceCosine` endpoint transfer-area determinant scan `0.45–1.35` (#607).
20. No crossing-point radial/polar momentum-gradient shear scan `0.30–0.70` (#613).
21. No propagated single-axis scalar Jacobi-compression scan `0.035–0.11` (#621).
22. No uncoupled two-polarization Jacobi-shear scan `0.045–0.16` (#627).
23. No disk-hit endpoint-only coupled 2x2 Jacobi rank-deficiency observable (#633); it collapses back to #571 and must not be rescued by adding a nearby endpoint threshold.
24. Geometry remains frozen.

## Recent propagation / continuity experiments

### #599 — polar continuity + first-order incidence Jacobian — REJECTED
- Candidate `92ca02ba98e735f671c5f6259da86a70a40288d7`; Build `#599`; run `32449303088`; artifact `9435214835`; digest `sha256:b89d38f7d3c5fdc1602d8e345cd18da259b1a27b2c8fd032c6fe9e7ad7236314`.
- Metrics: avg `2.1608391608`; median `2`; core `309`; cols `143`; longest `45`; span `682`; lower `10988`; warm `30113`; shadow `152`; dead `0`.
- Strong continuity, wrong ~2px thickness. Keep semantics frozen; do not scan `3.2–5.2`.

### #603 — three-point polar-transfer curvature — REJECTED
- Candidate `734e2d536c925dbd788b2ed5f63cc6b5e6fbc31c`; Build `#603`; run `32450568043`; artifact `9435633965`.
- Metrics: avg `2.608`; median `2`; core `133`; cols `51`; longest `31`; lower `10640`; warm `29846`.
- Over-selects localized still-thick folds. Do not scan `0.08–0.22`.

### #607 — endpoint transfer determinant — REJECTED
- Candidate `b3e3fbe49a26f78f6cde04502a28d55f0d78e749`; Build `#607`; run `32458144578`; artifact `9438113192`.
- Metrics effectively #571: avg `1.1923076923`; median `1`; core `31`; cols `26`; longest `7`; span `682`; lower `10636`; warm `29692`; shadow `152`; dead `0`.
- `polarMomentum` and `incidenceCosine` are too correlated. Do not scan `0.45–1.35`.

### #613 — crossing-point radial/polar gradient shear — REJECTED
- Candidate `d0472c1f0fad55e91a63e2322753ff1a0ce46059`; Build `#613`; run `32461261474`; artifact `9439158197`.
- Metrics: avg `2.1786`; median `2`; core `305`; cols `140`; longest `45`; span `682`; lower `10904`; warm `30006`; shadow `152`; dead `0`.
- Preserves continuity but does not rank vertical width. Do not scan `0.30–0.70`.

### #621 — propagated scalar Jacobi focusing — REJECTED
- Candidate `020dc5a8467d0d83598c6555e8147376bd33ae1f`; Build `#621`; run `32468881925`; artifact `9442063691`; digest `sha256:5e8640f652f7f24a32f90c8b9dddd8f885ba76ac880f8990332f71c9992180bb`.
- Metrics: avg `2.0364963504`; median `2`; core `279`; cols `137`; longest `29`; span `682`; lower `10660`; warm `29800`; shadow `152`; dead `0`.
- Single-axis propagation improves mean thickness but fragments continuity and stays 2px median. Do not scan `0.035–0.11`.
- Restore `7ec6e1f3a491237410d4a8b06630bc031a7ffb9f`; restore Build `#625` success, artifact `9442604825`.

### #627 — uncoupled two-polarization Jacobi shear — REJECTED
- Candidate `4cc0c81a870354fa836f1ba0e105a461505f58ff`; Build `#627`; run `32503599689`; workflow `328346937`; artifact `9454661750`; digest `sha256:5164fbd1a040f19e4958f79eb13d967a1f81674801b009d37d3fa2111114794a`.
- Metrics: avg `1.800`; median `2`; core `225`; cols `125`; longest `29`; span `682`; lower `10657`; warm `29770`; shadow `152`; dead `0`.
- Original size is more continuous than #571, but core enlargement remains ~2px. Uncoupled scalar anisotropy is not rank collapse. Do not scan `0.045–0.16`.
- Result log commit `8450d1d59625378f36e7dd5212812629921fcd2f`; restore `9ad499e3cfe856089c1d87eed74b56098d97722d`; restore Build `#631` success, artifact `9455053926`, digest `sha256:960aaa7fef1aeb08159c35dafb6d15a3dcd6406c96fe84a62c7f2aa8d49e4d14`.

### #633 — coupled 2x2 Jacobi endpoint rank-deficiency — REJECTED
- Starting accepted production: restore commit `9ad499e3cfe856089c1d87eed74b56098d97722d`, fully validated by Build `#631`.
- Unique topology: propagate a coupled 2x2 Jacobi matrix `J` and derivative `V=J'` along the existing main geodesic under a trace-free optical-tidal tensor whose orientation is derived from the main-ray `(pr, ptheta)` direction. At the physical first disk hit compute `rankRatio = 2*abs(det(J))/max(||J||_F^2, eps)` and `rankDeficiency = 1-rankRatio`, then multiply this endpoint rank-deficiency directly into the unchanged #599 continuity support. No second geodesic, framebuffer neighborhood, source-texture gate, geometry/stepping/crossing change, or second renderer.
- Candidate `c067e5d8de305bb87665bb571f1ab4e70d7888d7`.
- Windows Build `#633`; run `32505509765`; workflow `328346937`; URL `https://github.com/mason123test-byte/blackhole-tasks/actions/runs/32505509765`.
- Artifact `9455282963`; digest `sha256:b7f086082f0192661eb911bb43c87ca6f7ad37114d194a177bde4cf334de72df`.
- Frontend typecheck/lint/Vitest, Rust fast checks, runnable Tauri release EXE, native Windows WebView2 capture, and artifact upload all succeeded.
- Required images opened: `visual-candidate.png`, `visual-baseline.png`, `visual-split.png`, `02-single-scene-expanded.png`, #571/#633 original-size side-by-side, and #571/#633 core enlargement.
- Fixed metrics: avg `1.1923076923`; median `1`; core `31`; cols `26`; longest `7`; span `682`; lower `10636`; warm `29693`; shadow `152`; dead `0` — exactly the accepted #571 measurements.
- Original-size and core-enlargement verdict: visually indistinguishable from #571; no continuity recovery appears.
- Verdict: rejected.
- Root cause: endpoint-only rank deficiency can miss a bundle that approaches/crosses a conjugate fold earlier and re-expands before the disk hit. At the endpoint the scale-invariant determinant ratio has recovered, so the selector carries effectively no additional information.
- Do not rescue this by scanning an endpoint rank-deficiency threshold or endpoint determinant gain. The next topology must move the observable into propagation history.
- Restore commit: pending immediate forward restore after this log commit.

## Operational notes

- #499 TypeScript syntax failure and #511 test-text typo were non-visual failures.
- #553 first visual capture failed transiently; identical SHA rerun succeeded.
- #559 initial workflow was cancelled before steps; same SHA later validated successfully.
- Historical accidental temp/noop commits were cleaned only by normal forward commits and never accepted. No future temp/noop/contents-API placeholders are allowed.

## Current checkpoint

- Accepted visual baseline remains `#571`.
- #633 is rejected and must be forward-restored before another candidate.
- Next orthogonal topology: keep the coupled 2x2 Jacobi propagation, but record the minimum scale-invariant determinant/rank ratio encountered along the physical path before first disk crossing (conjugate-point / fold-history proximity), rather than using only the endpoint matrix. This changes the observable topology from endpoint state to propagation-history caustic encounter and is not an endpoint threshold scan.
