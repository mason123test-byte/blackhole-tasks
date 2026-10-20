# Black-hole visual experiment #621

- Accepted baseline remains `#571`.
- Candidate commit: `020dc5a8467d0d83598c6555e8147376bd33ae1f`.
- Windows Build `#621`, run ID `32468881925`, workflow ID `328346937`.
- Artifact `9442063691`, digest `sha256:5e8640f652f7f24a32f90c8b9dddd8f885ba76ac880f8990332f71c9992180bb`.

## Topology

Kept the accepted #571 path-stretch/local-incidence shoulder shaping and warm shelf unchanged, and reused #599's known continuity support (`polarMomentumCoherence` plus first-order local incidence Jacobian) unchanged. Added one propagation-domain width discriminator on the same physical geodesic: scalar Jacobi separation `J` and slope `J'` are initialized as `J=0`, `J'=1` and advanced only after each accepted main-ray step using `J'' + K J = 0` with the compact optical tidal proxy `K = 3/r^3`. At the first physical disk crossing, `jacobiCompression = 1 - |J| / pathLength` measures departure from flat-space bundle growth and gates #599 core support through `smoothstep(0.035, 0.11, jacobiCompression)`.

This adds only two scalar diagnostic states to the existing main geodesic. No neighboring geodesic integration, framebuffer-neighbor sampling, screen-y selector, geometry change, ray-step change, compositor change, source-texture gate or second renderer was introduced.

## Validation

Frontend typecheck, lint and Vitest passed. Rust fast checks passed with Rust compile steps skipped because no Rust-affecting files changed. GitHub-hosted Windows visual validation built the runnable Tauri release EXE, captured native Windows WebView2 evidence and uploaded the artifact. Actual `visual-candidate.png`, `visual-baseline.png`, and a #571/#599/#613/#621 core enlargement were opened before verdict.

Fixed validation metrics for #621:

- average bright-core thickness: `2.0364963504 px`
- median bright-core thickness: `2 px`
- `>180` core pixels: `279`
- high-intensity columns: `137`
- longest contiguous high-intensity run: `29`
- direct span: `682 px`
- lower bright count: `10660`
- warm coverage: `29800`
- central shadow `>5` count: `152`
- dead-white count: `0`

Reference: #599 was `2.1608 px / median 2 / 309 core pixels / 143 columns / longest 45 / lower 10988 / warm 30113`; #479 was `2.2111 px / median 2` and is the fixed >=15% thinning reference. #621 is only about 7.9% thinner than #479 and loses substantial horizontal continuity relative to #599.

## Verdict

Rejected. Propagated scalar Jacobi compression is a genuinely new propagation-domain signal and improves mean thickness over #599 while preserving span/lower/warm/shadow, but it fragments the continuous ridge and still leaves a 2 px median. Do not scan the `0.035–0.11` scalar Jacobi-compression window or nearby scalar thresholds. A next propagation-domain attempt should change topology to a two-polarization Jacobi/shear observable rather than retune this scalar compression.

## Operational note

During preparation, an accidental contents-API commit `149c890db67d8bb4fb0f49cd8041812ae65b037f` created `DO_NOT_USE.txt`. The immediately following Git-object candidate commit `020dc5a8467d0d83598c6555e8147376bd33ae1f` deleted it and added only the intended shader/test changes. Net diff from the accepted #571 restore contains exactly the two intended files. No reset, rebase or force push was used. This contents-API mistake must not be repeated.
