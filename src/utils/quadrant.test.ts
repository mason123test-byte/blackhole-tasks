import { describe, expect, it } from "vitest";
import { pointToQuadrant, quadrantToFlags } from "./quadrant";

describe("quadrant utilities", () => {
  it("maps points into all four quadrants", () => {
    expect(pointToQuadrant(-1, -1)).toBe("q1");
    expect(pointToQuadrant(1, -1)).toBe("q2");
    expect(pointToQuadrant(-1, 1)).toBe("q3");
    expect(pointToQuadrant(1, 1)).toBe("q4");
  });
  it("keeps quadrant flags consistent", () => {
    expect(quadrantToFlags("q3")).toEqual({ important: false, urgent: true });
  });
});

