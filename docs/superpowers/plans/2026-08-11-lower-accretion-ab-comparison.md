# Lower Accretion Arc A/B Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the lower far-side lensed accretion arc and prove the visible change with deterministic baseline, candidate, split, difference, and metric artifacts from GitHub Actions Windows.

**Architecture:** A Rust diagnostic command exposes a process-scoped visual mode to the React canvas without adding production UI. The WebGL shader selects baseline or lower-far-side candidate geometry through one uniform and freezes time only for diagnostic captures. The existing PowerShell native smoke test launches the packaged EXE in each diagnostic mode, captures aligned frames, computes mask metrics, then runs the unchanged normal interaction loop.

**Tech Stack:** Tauri 2/Rust, React 19/TypeScript, WebGL2 GLSL ES 3.0, Vitest, PowerShell/System.Drawing, GitHub Actions `windows-latest`.

---

### Task 1: Lock the comparison contract with failing tests

**Files:**
- Modify: `src/shader/referenceBlackHoleShader.test.ts`
- Modify: `src/shader/blackHoleRenderer.test.ts`
- Modify: `src/shader/renderBoundary.test.ts`

- [ ] **Step 1: Replace the ineffective near-side assertions**

Assert that the fragment shader no longer contains `NEAR_DISK_INNER` or `nearSide`, and contains `LOWER_FAR_DISK_INNER`, `farSideWeight`, `lowerImageWeight`, and a comparison uniform.

- [ ] **Step 2: Add renderer-mode assertions**

Import `getVisualComparisonSettings` and assert:

```ts
expect(getVisualComparisonSettings("normal")).toEqual({ shaderMode: 1, fixedTime: null });
expect(getVisualComparisonSettings("baseline")).toEqual({ shaderMode: 0, fixedTime: 12 });
expect(getVisualComparisonSettings("candidate")).toEqual({ shaderMode: 1, fixedTime: 12 });
expect(getVisualComparisonSettings("split")).toEqual({ shaderMode: 2, fixedTime: 12 });
```

- [ ] **Step 3: Add boundary assertions**

Assert the frontend has no visible comparison controls and the PowerShell script names `visual-baseline.png`, `visual-candidate.png`, `visual-split.png`, `visual-difference.png`, and `visual-comparison-metrics.txt`.

- [ ] **Step 4: Commit only tests and this plan**

Commit message: `test: require deterministic lower-arc comparison evidence`.

- [ ] **Step 5: Verify RED on GitHub Windows**

Run the `Windows Build` workflow. Expected: frontend tests fail because the comparison helper, far-side shader constants, and evidence filenames do not exist.

### Task 2: Implement the lower far-side shader path

**Files:**
- Modify: `src/shader/referenceBlackHoleShader.ts`
- Modify: `src/shader/blackHoleRenderer.ts`
- Modify: `src/components/orb/BlackHoleCanvas.tsx`

- [ ] **Step 1: Add the shader comparison uniform**

Declare `uniform float u_visual_compare;`. Use mode `0` for baseline, `1` for candidate, and `2` for a vertical split where `screen.x < 0` is baseline and `screen.x >= 0` is candidate.

- [ ] **Step 2: Replace near-side selection with lower far-side selection**

Use one effective inner radius for band, Keplerian motion, and temperature:

```glsl
float farSideWeight = 1.0 - smoothstep(-1.6, 0.4, diskPoint.z);
float lowerImageWeight = smoothstep(-0.02, shadowRadius * 0.65, screen.y);
float candidateWeight = u_visual_compare < 0.5
  ? 0.0
  : (u_visual_compare > 1.5 ? step(0.0, screen.x) : 1.0);
float lowerFarWeight = farSideWeight * lowerImageWeight * candidateWeight;
float innerRadius = mix(DISK_INNER, LOWER_FAR_DISK_INNER, lowerFarWeight);
```

Start `LOWER_FAR_DISK_INNER` at `2.8` so the first Windows candidate is intentionally visible; subsequent adjustment is allowed only after viewing the deterministic comparison.

- [ ] **Step 3: Add deterministic renderer settings**

Export `VisualComparisonMode` and `getVisualComparisonSettings`. Bind `u_visual_compare`; upload either elapsed time or fixed time `12` according to the settings.

- [ ] **Step 4: Delay Tauri canvas startup until the diagnostic mode resolves**

In `BlackHoleCanvas`, invoke `get_visual_comparison_mode` only under Tauri, start the renderer after the mode is known, and default browser previews to `normal`.

- [ ] **Step 5: Commit the shader and frontend implementation**

Commit message: `fix: reshape the lower far-side accretion image`.

### Task 3: Expose process-scoped diagnostic mode from Tauri

**Files:**
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add a read-only Tauri command**

Return only `baseline`, `candidate`, or `split` from `BLACKHOLE_VISUAL_COMPARE`; return `normal` for missing or invalid values.

- [ ] **Step 2: Register the command**

Add `get_visual_comparison_mode` to the existing `generate_handler!` list. Do not persist the value or expose a settings control.

- [ ] **Step 3: Add Rust unit cases**

Test the pure normalization helper with all supported values and an invalid value.

- [ ] **Step 4: Commit the Tauri diagnostic plumbing**

Commit message: `test: expose Windows visual comparison mode`.

### Task 4: Capture deterministic Windows A/B evidence

**Files:**
- Modify: `scripts/windows-interaction-smoke.ps1`

- [ ] **Step 1: Add a comparison launch helper**

For each of `baseline`, `candidate`, and `split`, set `BLACKHOLE_VISUAL_COMPARE`, launch the packaged EXE, wait for a ready WebGL2 frame, expand to `920x700`, capture the client region, stop the process, and clear the environment value.

- [ ] **Step 2: Generate difference and metrics**

Use `System.Drawing.Bitmap` to compare aligned baseline and candidate bright masks. Save a black-background difference image and a text file containing lower/upper intersection, union, XOR, and IoU.

- [ ] **Step 3: Enforce comparison gates**

Fail when lower IoU is greater than `0.93` or upper IoU is less than `0.98`. Continue into the existing normal-mode task interaction test only after the comparison gates pass.

- [ ] **Step 4: Commit the evidence pipeline**

Commit message: `test: capture lower-arc Windows visual comparison`.

### Task 5: Verify and present the first candidate

**Files:**
- No source changes unless the visual gate or human inspection rejects the candidate.

- [ ] **Step 1: Run the complete GitHub Windows workflow**

Expected passing stages: frontend typecheck, lint, Vitest; Rustfmt, Clippy, Rust tests; Tauri build; diagnostic visual gates; normal native interaction smoke; artifact uploads.

- [ ] **Step 2: Download and inspect evidence**

Inspect `visual-baseline.png`, `visual-candidate.png`, `visual-split.png`, `visual-difference.png`, and `visual-comparison-metrics.txt` from the Windows smoke artifact.

- [ ] **Step 3: Apply the human visual gate**

Reject the candidate if the lower contour still has an abrupt inward notch, if the black shadow loses its round silhouette, or if the upper arch/diagonal foreground disk changes visibly.

- [ ] **Step 4: Show the user the Windows evidence**

Embed the candidate and split screenshots using their downloaded absolute paths. Report the exact commit, run ID, metric values, test status, and any remaining risk without claiming final acceptance on the user's behalf.
