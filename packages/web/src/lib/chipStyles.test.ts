import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PILL } from "./chipStyles.ts";

const css = readFileSync(join(import.meta.dirname, "../index.css"), "utf8");
const control = css.match(/\.control \{\s*@apply ([^;]+);/)?.[1]?.split(" ") ?? [];
const pill = PILL.split(" ");
const paddingY = (utilities: string[]) => utilities.find((utility) => utility.startsWith("py-"));

describe("PILL", () => {
  it("pads as the control box does, so the two stand one height", () => {
    expect(paddingY(pill)).toBeDefined();
    expect(paddingY(control)).toBe(paddingY(pill));
  });

  it.each(["border", "text-row"])("shares %s with the control box", (utility) => {
    expect(control).toContain(utility);
    expect(pill).toContain(utility);
  });
});
