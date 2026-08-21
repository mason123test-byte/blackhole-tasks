import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("incidence-qualified direct-disk dual-band reconstruction", () => {
  it("keeps the #561 physical incidence and path-stretch classifier unchanged", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float shortPathWeight = 1.0 - smoothstep(1.05, 1.45, pathStretch);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float grazingWeight = 1.0 - smoothstep(0.07, 0.26, incidenceCosine);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float shoulderBand = smoothstep(0.58, 0.72, directPeak)",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "* (1.0 - smoothstep(0.78, 0.90, directPeak));",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "vec3 thinnedDirect = diskColor * mix(1.0, 0.38, shoulderSuppression);",
    );
  });

  it("separates warm low-frequency response from the high-frequency knife core", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float warmVeilSupport = smoothstep(0.22, 0.68, shoulderSuppression);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "vec3 warmLowFrequency = mix(thinnedDirect, max(thinnedDirect, warmVeil), warmVeilSupport);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float knifeCoreSupport = candidateWeight",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "* smoothstep(0.76, 0.88, directPeak)",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "vec3 directHighFrequency = directKnifeCore * knifeCoreSupport;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "diskColor = max(warmLowFrequency, directHighFrequency);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("directPeak * 0.78");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("ridgeNeighborPeak");
  });

  it("keeps geometry and forbidden screen-space paths unchanged", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float OBSERVER_THETA = 1.515;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_OUTER = 35.00;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("#define N_STEPS 176");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const int MAX_DISK_CROSSINGS = 4;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("screen.y <");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("fakeAnnulus");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("mirroredUv");
  });
});
