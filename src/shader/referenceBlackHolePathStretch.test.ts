import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  REFERENCE_BLACK_HOLE_FRAGMENT,
  REFERENCE_BLACK_HOLE_INFO,
} from "./referenceBlackHoleShader";

const wrapperSource = readFileSync(
  resolve(process.cwd(), "src/shader/referenceBlackHoleShader.ts"),
  "utf8",
);

describe("short-path direct-disk photometry experiment", () => {
  it("uses affine path stretch as the only new physical classifier", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float affinePathLength = 0.0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float acceptedStepLength = h;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float hitPathLength = pathBeforeStep + crossing * acceptedStepLength;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float radialDirectDistance = max(OBSERVER_R - diskRadius, 1.0);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float pathStretch = hitPathLength / radialDirectDistance;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float shortPathWeight = 1.0 - smoothstep(1.05, 1.45, pathStretch);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float directColorGain = mix(0.32, 1.00, directResponse);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("if (diskCrossingCount == 0) {");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "shapeShortPathDirectPhotometry(candidateWeight, pathStretch, diskColor, diskAlpha);",
    );
  });

  it("keeps the accepted Kerr geometry and avoids the rejected classifiers", () => {
    expect(REFERENCE_BLACK_HOLE_INFO.model).toBe("interstellar-gargantua-kerr-geodesic");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_OUTER = 35.00;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float OBSERVER_THETA = 1.515;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("if (crossingIndex == 1) return 0.80;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("if (crossingIndex == 1) return 0.72;");
    expect(wrapperSource).not.toContain("screen.y");
    expect(wrapperSource).not.toContain("radialTurned");
    expect(wrapperSource).not.toContain("lowDeflection");
    expect(wrapperSource).not.toContain("fakeAnnulus");
  });

  it("fails loudly instead of silently falling back if the base shader changes", () => {
    expect(wrapperSource).toContain("throw new Error(`Missing black-hole shader anchor: ${label}`);");
    expect(wrapperSource).not.toContain("try {");
    expect(wrapperSource).not.toContain("catch (");
  });
});
