import { describe, expect, it } from "vitest";
import { getRenderProfile } from "./blackHoleRenderer";

describe("black-hole render profiles", () => {
  it("matches the requested idle and active frame-rate tiers", () => {
    expect(getRenderProfile("low")).toMatchObject({ idleFps: 15, activeFps: 30 });
    expect(getRenderProfile("balanced")).toMatchObject({ idleFps: 24, activeFps: 45 });
    expect(getRenderProfile("high")).toMatchObject({ idleFps: 30, activeFps: 60 });
  });

  it("forces the low-cost profile when low-power mode is enabled", () => {
    expect(getRenderProfile("high", true)).toEqual(getRenderProfile("low"));
  });
});
