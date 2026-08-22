import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("incidence-qualified actual-Kerr symplectic cross-coupling history core", () => {
  it("keeps accepted #571 and frozen #599 continuity semantics unchanged", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float shortPathWeight = 1.0 - smoothstep(1.05, 1.45, pathStretch);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float grazingWeight = 1.0 - smoothstep(0.07, 0.26, incidenceCosine);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float polarMomentumCoherence = 1.0 - smoothstep(0.10, 0.22, polarMomentum);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float compactBundleWeight = smoothstep(3.2, 5.2, incidenceJacobian);",
    );
  });

  it("propagates two camera tangents through the actual Kerr derivative field", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("void kerrTangentDerivative(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "initDngrCameraRay(cameraPlane.x + tangentBundleEpsilon, cameraPlane.y",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "initDngrCameraRay(cameraPlane.x, cameraPlane.y + tangentBundleEpsilon",
    );
  });

  it("uses signed versus absolute symplectic cross-coupling history cancellation", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("float tangentSymplecticCrossCoupling(");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float omega = dot(qRight, pUp) - dot(pRight, qUp);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "symplecticSignedIntegral += symplecticCrossCoupling * acceptedStepLength;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "symplecticAbsoluteIntegral += abs(symplecticCrossCoupling) * acceptedStepLength;",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain(
      "float symplecticCancellationSupport = clamp(1.0 - symplecticCoherence, 0.0, 1.0);",
    );
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("strongestFocusingAnisotropy");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("rightFocusingOnsetPath");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("principalAxisTwist");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("sigmaMin");
  });

  it("keeps frozen geometry and forbidden screen-space paths unchanged", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float OBSERVER_THETA = 1.515;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_OUTER = 35.00;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("#define N_STEPS 176");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const int MAX_DISK_CROSSINGS = 4;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("screen.y <");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("fakeAnnulus");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("mirroredUv");
  });
});
