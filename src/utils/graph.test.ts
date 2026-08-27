import { describe, expect, it } from "vitest";
import { wouldCreateCycle } from "./graph";
import type { TaskRelation } from "../types/task";

const relation = (source: string, target: string): TaskRelation => ({
  id: `${source}-${target}`, sourceTaskId: source, targetTaskId: target,
  relationType: "dependency", label: null, createdAt: "", updatedAt: "",
});

describe("graph validation", () => {
  it("rejects dependency cycles", () => {
    expect(wouldCreateCycle([relation("a", "b"), relation("b", "c")], "c", "a", "dependency")).toBe(true);
  });
  it("allows acyclic edges", () => {
    expect(wouldCreateCycle([relation("a", "b")], "b", "c", "dependency")).toBe(false);
  });
});
