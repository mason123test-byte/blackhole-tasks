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
10. Standalone path-stretch broad suppression is too destructive (#553); keep accepted incidence-qualified semantics frozen.
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
23. No endpoint-only coupled 2x2 Jacobi rank-deficiency rescue/threshold scan (#633).
24. No coupled 2x2 Jacobi minimum-rank-ratio / conjugate-history rescue or gain scan (#639). Endpoint and propagation-history variants both fail to add useful separation; leave this simplified Jacobi proxy family.
25. Geometry remains frozen.

## Recent experiments
### #599 — continuity reference — REJECTED
- Candidate `92ca02ba98e735f671c5f6259da86a70a40288d7`; Build `#599`; run `32449303088`; artifact `9435214835`.
- Metrics: avg `2.1608391608`; median `2`; core `309`; cols `143`; longest `45`; span `682`; lower `10988`; warm `30113`; shadow `152`; dead `0`.
- Strong horizontal continuity, but ~2px core. Frozen continuity semantics only; do not scan gate.

### #603 — second derivative curvature — REJECTED
- Candidate `734e2d536c925dbd788b2ed5f63cc6b5e6fbc31c`; Build `#603`; run `32450568043`; artifact `9435633965`.
- Metrics: avg `2.608`; median `2`; core `133`; cols `51`; longest `31`; lower `10640`; warm `29846`.
- Localized still-thick folds; continuity lost.

### #607 — endpoint transfer determinant — REJECTED
- Candidate `b3e3fbe49a26f78f6cde04502a28d55f0d78e749`; Build `#607`; run `32458144578`; artifact `9438113192`.
- Metrics effectively #571: avg `1.1923076923`; median `1`; core `31`; cols `26`; longest `7`; lower `10636`; warm `29692`.
- Coordinates too correlated.

### #613 — radial/polar gradient shear — REJECTED
- Candidate `d0472c1f0fad55e91a63e2322753ff1a0ce46059`; Build `#613`; run `32461261474`; artifact `9439158197`.
- Metrics: avg `2.1786`; median `2`; core `305`; cols `140`; longest `45`; lower `10904`; warm `30006`.
- Preserves continuity but not width.

### #621 — propagated scalar Jacobi — REJECTED
- Candidate `020dc5a8467d0d83598c6555e8147376bd33ae1f`; Build `#621`; run `32468881925`; artifact `9442063691`.
- Metrics: avg `2.0364963504`; median `2`; core `279`; cols `137`; longest `29`; lower `10660`; warm `29800`.
- Restore `7ec6e1f3a491237410d4a8b06630bc031a7ffb9f`; restore Build `#625` success.

### #627 — uncoupled two-polarization Jacobi shear — REJECTED
- Candidate `4cc0c81a870354fa836f1ba0e105a461505f58ff`; Build `#627`; run `32503599689`; artifact `9454661750`; digest `sha256:5164fbd1a040f19e4958f79eb13d967a1f81674801b009d37d3fa2111114794a`.
- Metrics: avg `1.800`; median `2`; core `225`; cols `125`; longest `29`; span `682`; lower `10657`; warm `29770`; shadow `152`; dead `0`.
- Log commit `8450d1d59625378f36e7dd5212812629921fcd2f`; restore `9ad499e3cfe856089c1d87eed74b56098d97722d`; restore Build `#631` success.

### #633 — coupled 2x2 Jacobi endpoint rank deficiency — REJECTED
- Candidate `c067e5d8de305bb87665bb571f1ab4e70d7888d7`; Build `#633`; run `32505509765`; workflow `328346937`; artifact `9455282963`; digest `sha256:b7f086082f0192661eb911bb43c87ca6f7ad37114d194a177bde4cf334de72df`.
- Required Windows candidate/baseline/split/expanded and #571/#633 original/core comparisons opened.
- Metrics exactly #571: avg `1.1923076923`; median `1`; core `31`; cols `26`; longest `7`; span `682`; lower `10636`; warm `29693`; shadow `152`; dead `0`.
- Endpoint rank deficiency carries no useful continuity information. Log commit `388b8180e1e30fc6d6e5a7d9ffaf22e0103bc652`; restore `04bf800573ffea6ca18c8ea595d77b6f81057d63`.
- Restore Build `#637`, run `32537523085`, success; artifact `9466009655`; digest `sha256:d8747cce59b837f598b65f239d5b1fa7b8f4f9e71e19a354713bcd08e99cf56e`.

### #639 — coupled 2x2 Jacobi propagation-history conjugate proximity — REJECTED
- Starting accepted restore `04bf800573ffea6ca18c8ea595d77b6f81057d63`, fully validated by Build `#637`.
- Unique topology: propagate the same coupled 2x2 Jacobi matrix as #633, but instead of using only disk-hit endpoint rank deficiency, record `minJacobiRankRatio` over every accepted main-ray step. At first disk hit combine the historical minimum with the partial hit-step ratio and use `conjugateProximity = 1 - minRankRatio` as a threshold-free multiplier on unchanged #599 continuity support. This tests whether rays approach a conjugate fold and later re-expand before disk crossing.
- Candidate `5127904ebc68fc23519a278dfce1abd206645bee`.
- Windows Build `#639`; run `32538039894`; workflow `328346937`; artifact `9466167087`; digest `sha256:38cf69635ffeab1b6d80c8671a63ee8a768ece12675606e3ea078335c18cafbb`.
- Frontend typecheck/lint/Vitest, Rust fast checks, Tauri release EXE, native Windows WebView2 capture and artifact upload all succeeded.
- Required images opened: `visual-candidate.png`, `visual-baseline.png`, `visual-split.png`, `02-single-scene-expanded.png`, #571/#639 original-size side-by-side, and #571/#639 core enlargement.
- Fixed metrics: avg `1.1923076923`; median `1`; core `31`; cols `26`; longest `7`; span `682`; lower `10636`; warm `29715`; shadow `152`; dead `0`.
- Visual: indistinguishable from #571 at original size and core enlargement; no continuity recovery. Only warm count changes by +22 pixels, within noise-level response and unrelated to the missing core continuity.
- Verdict: rejected.
- Root cause: the simplified trace-free `3/r^3` coupled Jacobi proxy does not generate useful direct-family separation even when the full pre-hit minimum rank history is retained. Do not rescue it with history-ratio thresholds, gains, or endpoint/history combinations.
- Restore commit: pending immediate forward restore after this log commit.

## Operational notes
- Historical accidental temp/noop/contents-API commits were cleaned only by normal forward commits and never accepted. No future temp/noop/contents-API placeholders are allowed.
- #499/#511 were non-visual code/test failures; #553 first visual capture was transient; #559 initial workflow was cancelled before steps and later validated on the same SHA.

## Current checkpoint
- Accepted baseline remains #571.
- #639 is rejected and must be forward-restored before another candidate.
- Next orthogonal topology: leave the simplified Jacobi family. Use actual Kerr azimuthal transport history from the existing `dphi` equation and compare it against the `a=0` spinless reference term `-L/(r^2 sin^2(theta))`. Accumulate the frame-dragging/excess transport along the same accepted main geodesic and derive a scale-free transfer observable. This is not raw `diskPhi`, not a crossing-point derivative, and does not alter geodesic geometry or stepping.
