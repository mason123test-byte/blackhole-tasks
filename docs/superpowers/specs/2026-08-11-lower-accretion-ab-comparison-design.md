# Lower Accretion Arc A/B Comparison Design

## Goal

Make the lower lensed accretion-disk arc visibly rounder and remove the abrupt inward notch while preserving the reference Inferno upper arc, diagonal foreground disk, WebGL2 renderer, DOM Pointer Events, and existing task controls.

Success must be demonstrated by deterministic screenshots from the GitHub Actions Windows runner. A code-constant change or a single candidate screenshot is not sufficient evidence.

## Root Cause

The lower U-shaped arc is a lensed image of the far side of the disk. The current `NEAR_DISK_INNER` experiment weights positive `diskPoint.z`, so it changes the foreground/near-side crossing instead of the lower far-side image. The lower arc therefore retains the baseline `DISK_INNER` geometry.

The existing screenshots also sample an animated shader at different times. Their pixel differences mix geometry changes with moving streak noise, which makes subjective before/after comparison unreliable.

## Rendering Design

Remove the ineffective near-side-only inner-radius adjustment.

At each disk crossing, derive two independent weights:

- `farSideWeight` from negative `diskPoint.z`, selecting the far-side disk crossing.
- `lowerImageWeight` from the bottom half of screen space, selecting only the lower lensed image.

Their product controls a candidate lower inner radius. The baseline path continues to use `DISK_INNER`; the candidate path smoothly increases the inner radius only for the lower far-side image. Band density, Keplerian streak motion, and temperature profile must all use the same effective inner radius so the result remains one physical disk calculation rather than a painted overlay.

The upper far-side arc, foreground diagonal disk, outer disk radius, inclination, roll, and exposure remain unchanged.

## Windows-Only Comparison Mode

The packaged application accepts a diagnostic environment value only when launched by the Windows smoke script. Rust maps `BLACKHOLE_VISUAL_COMPARE` to an application query value; normal launches omit it and use the candidate production renderer.

Supported diagnostic values:

- `baseline`: original lower-arc geometry with shader time frozen.
- `candidate`: proposed lower-arc geometry with the same frozen time.
- `split`: an aligned vertical wipe, baseline on the left and candidate on the right.

This mode adds no visible production control, dropdown, fallback renderer, or Canvas2D path.

## Evidence Pipeline

The Windows interaction script launches the packaged EXE in baseline and candidate diagnostic modes using the same window bounds and deterministic shader time. It saves:

- `visual-baseline.png`
- `visual-candidate.png`
- `visual-split.png`
- `visual-difference.png`
- `visual-comparison-metrics.txt`

The difference image is produced by the PowerShell/System.Drawing evidence script after capture; it is not part of application rendering.

The metrics compare thresholded bright-pixel masks in fixed lower-arc and upper-arc regions. Acceptance requires:

- lower-arc mask IoU at or below `0.93`, proving a visible geometric change;
- upper-arc mask IoU at or above `0.98`, proving the change remains localized;
- a successful normal-mode native interaction smoke test after diagnostic captures.

The final human check must confirm that the lower contour is continuous, the black shadow remains round, and neither the upper arch nor the diagonal disk is clipped.

## Tests

Add failing tests before implementation for:

- removal of `NEAR_DISK_INNER` and `nearSide`;
- presence and use of far-side and lower-image weights;
- baseline/candidate/split comparison selection;
- fixed comparison time without freezing normal animation;
- absence of Canvas2D and visible comparison controls;
- Windows evidence filenames and metric gates.

Run the existing frontend typecheck, lint, Vitest suite, Rust formatting, Clippy, Rust tests, Tauri installer build, native interaction smoke test, and the new visual comparison capture on `windows-latest`.

## Failure Handling and Rollback

If the lower mask does not cross the visibility threshold, reject the candidate and change only the lower far-side inner-radius target or transition width. If the upper mask changes beyond tolerance, narrow the screen-space selector before adjusting any global Inferno constant.

Rollback is a normal revert of the shader, Rust query plumbing, and Windows evidence-script changes. No data migration, task-state change, or dependency addition is involved.
