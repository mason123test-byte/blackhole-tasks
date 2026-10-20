import type { Quadrant } from "../types/task";

export const quadrantLabels: Record<Quadrant, string> = {
  q1: "重要且紧急",
  q2: "重要但不紧急",
  q3: "紧急但不重要",
  q4: "不重要且不紧急",
};

export function quadrantToFlags(quadrant: Quadrant) {
  return {
    important: quadrant === "q1" || quadrant === "q2",
    urgent: quadrant === "q1" || quadrant === "q3",
  };
}

export function pointToQuadrant(x: number, y: number, centerX = 0, centerY = 0): Quadrant {
  if (x < centerX && y < centerY) return "q1";
  if (x >= centerX && y < centerY) return "q2";
  if (x < centerX && y >= centerY) return "q3";
  return "q4";
}

export function quadrantOrigin(quadrant: Quadrant) {
  const gap = 80;
  if (quadrant === "q1") return { x: -340 + Math.random() * 180, y: -220 + Math.random() * 100 };
  if (quadrant === "q2") return { x: gap + Math.random() * 180, y: -220 + Math.random() * 100 };
  if (quadrant === "q3") return { x: -340 + Math.random() * 180, y: gap + Math.random() * 100 };
  return { x: gap + Math.random() * 180, y: gap + Math.random() * 100 };
}

