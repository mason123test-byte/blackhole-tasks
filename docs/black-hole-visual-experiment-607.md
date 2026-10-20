# Black-hole visual experiment #607

- Accepted baseline remains `#571`.
- Candidate commit: `b3e3fbe49a26f78f6cde04502a28d55f0d78e749`.
- Windows Build `#607`, run ID `32458144578`, workflow ID `328346937`.
- Artifact `9438113192`, digest `sha256:044bd57ab62b6122cc898323837e43d8c4c1a94d1ea677fdd0db5ac6dffa923b`.

## Topology

Kept the accepted #571 path-stretch/local-incidence shoulder shaping and warm shelf unchanged, and kept #585 polar-momentum continuity semantics unchanged. Added a two-axis local transfer-area discriminator. Camera-right and camera-up offsets `±0.002` are passed only through `initDngrCameraRay`; no neighboring geodesic is integrated. At the current physical disk crossing radius, local polar momentum and local incidence are evaluated from each perturbed invariant set. Their centered derivatives form a 2x2 screen-to-transfer Jacobian, with determinant `abs(dpDx * diDy - dpDy * diDx)`. The candidate maps it through `transferAreaWeight = smoothstep(0.45, 1.35, transferAreaJacobian)` before reconstructing the same sub-white #585 core.

No framebuffer-neighbor sampling, screen-y selector, second renderer, geometry change, compositor change, source-texture gate or additional geodesic trace was introduced.

## Validation

Frontend typecheck, lint and Vitest passed. Rust fast checks passed with Rust compile steps skipped because no Rust-affecting files changed. The GitHub-hosted Windows visual job successfully built the runnable Tauri release EXE, captured native Windows WebView2 evidence and uploaded the visual artifact. Actual `visual-candidate.png`, `visual-baseline.png`, `visual-split.png`, expanded screenshot and a #571/#599/#603/#607 core comparison were opened before verdict.

Fixed validation metrics for #607:

- average bright-core thickness: `1.1923076923 px`
- median bright-core thickness: `1 px`
- `>180` core pixels: `31`
- high-intensity columns: `26`
- longest contiguous high-intensity run: `7`
- direct span: `682 px`
- lower bright count: `10636`
- warm coverage: `29692`
- central shadow `>5` count: `152`
- dead-white count: `0`

For comparison, accepted #571 is `1.1923 px / median 1 / 31 core pixels / 26 columns / longest 7 / span 682 / lower 10636 / warm 29693 / shadow 152 / dead-white 0`. Rejected #599 had `143` high-intensity columns and longest run `45` but stayed `2.161 px` average / median `2`.

## Verdict

Rejected. #607 is visually and quantitatively effectively #571 rather than an improvement: it does not recover #599's horizontal continuity at all. The `(polarMomentum, incidenceCosine)` transfer coordinates are too correlated within the target direct family for their local determinant to supply the missing independent area/magnification discriminator at the tested topology.

Do not scan the `0.45–1.35` transfer-area determinant gate or nearby scalar thresholds. A future direct-core attempt should not simply combine more derivatives of these same two correlated observables. Either derive a genuinely independent transfer coordinate/Jacobi-field observable, or leave the accepted direct response unchanged and work on a separate photographic layer. Geometry remains frozen and `#571` remains the production baseline.
