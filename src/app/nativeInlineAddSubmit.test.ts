import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const orbSource = readFileSync(resolve(process.cwd(), "src/app/OrbApp.tsx"), "utf8");

describe("inline add submit lifecycle", () => {
  it("closes the input before awaiting the native create command", () => {
    const submitStart = orbSource.indexOf("const submit = async () => {");
    const submitEnd = orbSource.indexOf("\n  };", submitStart);
    const submit = orbSource.slice(submitStart, submitEnd);
    expect(submit).toContain("onDone();");
    expect(submit).toContain("await createTask({ title: title.trim(), quadrant });");
    expect(submit.indexOf("onDone();")).toBeLessThan(submit.indexOf("await createTask"));
  });
});
