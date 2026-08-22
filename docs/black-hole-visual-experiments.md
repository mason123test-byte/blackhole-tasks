# Black-hole visual experiment log

Canonical registry for `agent/initial-blackhole-tasks`.

## Permanent rules
- Accepted visual baseline: `#571`.
- Geometry frozen: do not change `DISK_OUTER`, `OBSERVER_THETA`, Kerr/geodesic stepping, disk-crossing structure, BH/disk/observer geometry, or use geometry changes to fake photometric improvement.
- One WebGL2 numerical Kerr path only. No Canvas2D, framebuffer mirror/flip, copied lower half, fake annulus, second renderer, silent fallback, `screen.y` hard patches, or screen-space neighborhood ridge selector.
- Do not use source texture/final RGB brightness as a transfer classifier.
- Candidate implementation + test are atomic. `update_ref(force=false)` only; no reset/rebase/force push/noop/temp files.
- Every candidate requires GitHub-hosted Windows `windows-latest`, runnable Tauri release EXE, native WebView2 capture, artifact upload, actual image inspection, and fixed-metric validation.
- Rejected candidates are logged, then production is forward-restored to #571 before another candidate is mounted.

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
10. Standalone path stretch broad suppression is too destructive (#553); keep accepted incidence-qualified semantics frozen.
11. Do not retune #561/#571 path-stretch/local-incidence or shoulder gates.
12. No #567 scalar warm-tint recovery scan.
13. No source peak/alpha knife-core scan (#575).
14. No source-texture residual recovery (#581).
15. No standalone local-polar-momentum reconstruction scan (#585); polar momentum may remain only as frozen continuity semantics paired with an independent width observable.
16. No polar-path detour scan `1.02–1.18` (#591).
17. No first-order incidence-Jacobian scan `3.2–5.2` (#599).
18. No second-derivative/fold-curvature scan `0.08–0.22` (#603).
19. No `polarMomentum + incidenceCosine` endpoint determinant scan `0.45–1.35` (#607).
20. No crossing-point radial/polar gradient shear scan `0.30–0.70` (#613).
21. No propagated scalar Jacobi-compression scan `0.035–0.11` (#621).
22. No uncoupled two-polarization Jacobi-shear scan `0.045–0.16` (#627).
23. No endpoint-only coupled 2x2 simplified Jacobi rank-deficiency rescue/threshold scan (#633).
24. No simplified coupled 2x2 Jacobi minimum-rank-ratio/conjugate-history rescue or gain scan (#639).
25. No Kerr-vs-spinless azimuthal transport fraction threshold/gain/sign/cancellation scan (#645); it adds no core separation.
26. Geometry remains frozen.

## Recent continuity / propagation experiments
### #599 — continuity reference — REJECTED
- Candidate `92ca02ba98e735f671c5f6259da86a70a40288d7`; Build `#599`; run `32449303088`; artifact `9435214835`.
- Metrics: avg `2.1608391608`; median `2`; core `309`; cols `143`; longest `45`; span `682`; lower `10988`; warm `30113`; shadow `152`; dead `0`.
- Strong continuity, wrong ~2px thickness. Frozen continuity semantics only.

### #603 — second derivative curvature — REJECTED
- Candidate `734e2d536c925dbd788b2ed5f63cc6b5e6fbc31c`; Build `#603`; run `32450568043`; artifact `9435633965`.
- Metrics: avg `2.608`; median `2`; core `133`; cols `51`; longest `31`; lower `10640`; warm `29846`.

### #607 — endpoint transfer determinant — REJECTED
- Candidate `b3e3fbe49a26f78f6cde04502a28d55f0d78e749`; Build `#607`; run `32458144578`; artifact `9438113192`.
- Metrics effectively #571; transfer coordinates were too correlated.

### #613 — radial/polar gradient shear — REJECTED
- Candidate `d0472c1f0fad55e91a63e2322753ff1a0ce46059`; Build `#613`; run `32461261474`; artifact `9439158197`.
- Metrics: avg `2.1786`; median `2`; core `305`; cols `140`; longest `45`; lower `10904`; warm `30006`.
- Preserves continuity but not width.

### #621 — propagated scalar Jacobi — REJECTED
- Candidate `020dc5a8467d0d83598c6555e8147376bd33ae1f`; Build `#621`; run `32468881925`; artifact `9442063691`.
- Metrics: avg `2.0364963504`; median `2`; core `279`; cols `137`; longest `29`; lower `10660`; warm `29800`.
- Restore `7ec6e1f3a491237410d4a8b06630bc031a7ffb9f`; restore Build `#625` success.

### #627 — uncoupled two-polarization Jacobi shear — REJECTED
- Candidate `4cc0c81a870354fa836f1ba0e105a461505f58ff`; Build `#627`; run `32503599689`; artifact `9454661750`.
- Metrics: avg `1.800`; median `2`; core `225`; cols `125`; longest `29`; span `682`; lower `10657`; warm `29770`; shadow `152`; dead `0`.
- Restore `9ad499e3cfe856089c1d87eed74b56098d97722d`; restore Build `#631` success.

### #633 — coupled simplified 2x2 Jacobi endpoint rank deficiency — REJECTED
- Candidate `c067e5d8de305bb87665bb571f1ab4e70d7888d7`; Build `#633`; run `32505509765`; artifact `9455282963`.
- Metrics exactly #571. Endpoint rank deficiency adds no continuity separation.
- Log `388b8180e1e30fc6d6e5a7d9ffaf22e0103bc652`; restore `04bf800573ffea6ca18c8ea595d77b6f81057d63`; restore Build `#637` success.

### #639 — simplified 2x2 Jacobi propagation-history conjugate proximity — REJECTED
- Candidate `5127904ebc68fc23519a278dfce1abd206645bee`; Build `#639`; run `32538039894`; artifact `9466167087`; digest `sha256:38cf69635ffeab1b6d80c8671a63ee8a768ece12675606e3ea078335c18cafbb`.
- Metrics: avg `1.1923076923`; median `1`; core `31`; cols `26`; longest `7`; span `682`; lower `10636`; warm `29715`; shadow `152`; dead `0`.
- Simplified Jacobi endpoint/history family exhausted. Log `881354702fce1d177a43812b88377db74d525bb8`; restore `a3925065b18db6bb6397e72de7e2a32003c083f5`.
- Restore Build `#643`, run `32538662043`, completed success.

### #645 — Kerr azimuthal transport excess history — REJECTED
- Starting accepted restore `a3925065b18db6bb6397e72de7e2a32003c083f5`; Build `#643` completed success before candidate creation.
- Unique topology: on the existing main Kerr geodesic, accumulate `|dphi_Kerr - dphi_a=0|` and normalize by accumulated `|dphi_Kerr|`; the analytic spinless reference is evaluated at the same main-ray state and does not trace a second geodesic. At first disk hit use `frameDragFraction = excessTravel / kerrAzimuthTravel` directly as a threshold-free multiplier on unchanged #599 continuity support. This is not raw `diskPhi` and does not alter geometry/stepping.
- Candidate `5efef46ec28ff530bb98b702d3962265873489f1`.
- Windows Build `#645`; run `32539376836`; workflow `328346937`; artifact `9466591984`; digest `sha256:cef7b99560d6300b1005581a92c8a007564286140c15cb86149e1fd81a198661`.
- Frontend typecheck/lint/Vitest, Rust fast checks, runnable Tauri release EXE, native WebView2 capture and artifact upload all succeeded.
- Required images opened: `visual-candidate.png`, `visual-baseline.png`, `visual-split.png`, `02-single-scene-expanded.png`, #571/#645 original-size side-by-side, and #571/#645 core enlargement.
- Fixed metrics: avg `1.1923076923`; median `1`; core `31`; cols `26`; longest `7`; span `682`; lower `10653`; warm `29709`; shadow `152`; dead `0`.
- Visual: no additional horizontal knife-edge continuity at original size or core enlargement. Core statistics are exactly #571; lower/warm changes are small and within tolerance but do not address the target.
- Verdict: rejected.
- Root cause: integrated frame-dragging azimuthal excess is not a direct-family vertical-width/continuity coordinate. Do not scan thresholds, gains, sign-sensitive or cancellation variants of this same accumulated transport fraction.
- Restore commit: pending immediate forward restore after this log commit.

## Operational notes
- Historical accidental temp/noop/contents-API commits were cleaned only by normal forward commits and never accepted. No future temp/noop/contents-API placeholders are allowed.
- #499/#511 were non-visual code/test failures; #553 first visual capture was transient; #559 initial workflow was cancelled before steps and later validated on the same SHA.

## Current checkpoint
- Accepted baseline remains #571.
- #645 is rejected and must be forward-restored before another candidate.
- Next orthogonal topology should leave accumulated scalar transport and simplified Jacobi proxies. Preferred direction: propagate a tangent-linear sensitivity of the actual Kerr ODE along the single accepted main geodesic (full-state variational response to camera-up perturbation), then use the physical first-hit transfer compression derived from that propagated sensitivity. This is not a second geodesic, not a framebuffer neighbor selector, and not the simplified `3/r^3` Jacobi proxy.
