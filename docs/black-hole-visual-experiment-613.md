# Black-hole visual experiment #613

- Accepted baseline remains `#571`.
- Candidate commit: `d0472c1f0fad55e91a63e2322753ff1a0ce46059`.
- Windows Build `#613`, run ID `32461261474`, workflow ID `328346937`.
- Artifact `9439158197`, digest `sha256:f0ad1796bf35d2660eba4b858fbf3138e1d29acd7ed2e94f0868451a69d1379f`.

## Topology

Kept the accepted #571 path-stretch/local-incidence shoulder shaping and warm shelf unchanged, and reused the exact #599 continuity semantics: #585 polar-momentum coherence plus the #599 camera-up incidence Jacobian gate `smoothstep(3.2, 5.2, incidenceJacobian)`. Added one new independent width discriminator based on radial/polar transfer shear.

At the current physical disk crossing radius, camera-right and camera-up offsets `±0.002` are passed only through `initDngrCameraRay`; no neighboring geodesic is integrated. Local polar momentum and local radial momentum are evaluated from each perturbed Kerr invariant set. Their centered screen gradients form two 2D vectors. The normalized absolute cross product

`abs(cross(gradPolar, gradRadial)) / (|gradPolar| |gradRadial|)`

measures radial/polar momentum-gradient shear in the range 0..1. The candidate maps it through `momentumShearWeight = smoothstep(0.30, 0.70, momentumShear)` and multiplies it into the exact #599 transfer-core support.

No framebuffer-neighbor sampling, screen-y selector, second renderer, geometry change, compositor change, source-texture gate or additional geodesic trace was introduced. Radial momentum was not used as a direct-image identity; it was used only as an independent local transfer-width discriminator on top of the already qualified #599 direct family.

## Validation

Frontend typecheck, lint and Vitest passed. Rust fast checks passed with Rust compile steps skipped because no Rust-affecting files changed. The GitHub-hosted Windows visual job successfully built the runnable Tauri release EXE, captured native Windows WebView2 evidence and uploaded the visual artifact. Actual `visual-candidate.png`, `visual-baseline.png`, `visual-split.png`, expanded screenshot and a #571/#599/#603/#613 core comparison were opened before verdict.

Fixed validation metrics for #613:

- average bright-core thickness: `2.1785714286 px`
- median bright-core thickness: `2 px`
- `>180` core pixels: `305`
- high-intensity columns: `140`
- longest contiguous high-intensity run: `45`
- direct span: `682 px`
- lower bright count: `10904`
- warm coverage: `30006`
- central shadow `>5` count: `152`
- dead-white count: `0`

For comparison, accepted #571 is `1.1923 px / median 1 / 31 core pixels / 26 columns / longest 7 / span 682 / lower 10636 / warm 29693 / shadow 152 / dead-white 0`. Rejected #599 is `2.1608 px / median 2 / 309 core pixels / 143 columns / longest 45 / span 682 / lower 10988 / warm 30113 / shadow 152 / dead-white 0`.

## Verdict

Rejected. The radial/polar momentum-gradient shear is a genuinely independent transfer-domain signal, but it does not supply the missing vertical-width ordering. It preserves essentially all of #599's horizontal continuity while average selected-core thickness slightly worsens (`2.1608 -> 2.1786 px`) and the median remains `2 px`. Lower/warm energy, direct span, shadow and dead-white remain well controlled, so the failure is specifically that this shear coordinate does not distinguish the 1px caustic from the broader 2px direct bundle.

Do not scan the `0.30–0.70` momentum-shear gate or nearby scalar thresholds. Do not rescue this by multiplying more first-order momentum-gradient gates onto #599. A future direct-core attempt needs a quantity tied to actual bundle expansion/contraction along the geodesic (Jacobi/geodesic-deviation state, optical scalar, or another propagation-domain observable), rather than another algebraic camera-invariant gradient evaluated only at the crossing radius. Geometry remains frozen and `#571` remains the accepted production baseline.
