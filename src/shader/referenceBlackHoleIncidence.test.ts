import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("incidence-qualified Kerr azimuthal-transport core", () => {
  it("keeps the accepted #571 classifier and warm shelf unchanged", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float shortPathWeight = 1.0 - smoothstep(1.05, 1.45, pathStretch);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float grazingWeight = 1.0 - smoothstep(0.07, 0.26, incidenceCosine);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "diskColor *= mix(1.0, 0.38, shoulderSuppression);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float warmShelfSupport = smoothstep(0.22, 0.68, shoulderSuppression);",
    );
  });

  it("uses scale-free Kerr frame-dragging excess history on the existing main ray", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "spinlessRate = -L / max(r2 * sin2, 1e-5);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "frameDragExcessTravel += abs(transportKerrRate - transportSpinlessRate) * acceptedStepLength;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float frameDragFraction = clamp(hitFrameDragExcess / max(hitKerrAzimuthTravel, 1e-5), 0.0, 1.0);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "* frameDragFraction;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("jacobiRank");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("minJacobi");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("rawDiskPhi");
  });

  it("keeps frozen #599 continuity semantics without a new frame-drag threshold", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float polarMomentumCoherence = 1.0 - smoothstep(0.10, 0.22, polarMomentum);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float compactBundleWeight = smoothstep(3.2, 5.2, incidenceJacobian);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("frameDragWeight = smoothstep");
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
