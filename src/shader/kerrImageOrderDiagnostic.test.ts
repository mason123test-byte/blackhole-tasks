import { describe, expect, it } from "vitest";
import { REFERENCE_BLACK_HOLE_FRAGMENT } from "./referenceBlackHoleShader";

describe("Kerr equatorial image-order diagnostic", () => {
  it("counts every real equatorial crossing before disk-radius acceptance", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("int equatorialCrossingCount = 0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("equatorialCrossingCount += 1;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("if (diskRadius > DISK_INNER && diskRadius < DISK_OUTER)");

    const countIndex = REFERENCE_BLACK_HOLE_FRAGMENT.indexOf("equatorialCrossingCount += 1;");
    const radiusIndex = REFERENCE_BLACK_HOLE_FRAGMENT.indexOf("if (diskRadius > DISK_INNER && diskRadius < DISK_OUTER)");
    expect(countIndex).toBeGreaterThan(-1);
    expect(radiusIndex).toBeGreaterThan(countIndex);
  });

  it("colors accepted disk hits by physical equatorial crossing ordinal without screen-space shaping", () => {
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("const float DISK_ORDER_DIAGNOSTIC = 1.0;");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("if (equatorialCrossingCount == 1)");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("else if (equatorialCrossingCount == 2)");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).toContain("diskColor = vec3(0.10, 0.25, 1.00);");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("screen.y < 0.0");
    expect(REFERENCE_BLACK_HOLE_FRAGMENT).not.toContain("referenceUv.y < 0.5");
  });
});
