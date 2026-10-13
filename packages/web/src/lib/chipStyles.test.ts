import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PILL } from "./chipStyles.ts";

const css = readFileSync(join(import.meta.dirname, "../index.css"), "utf8");
const control = css.match(/\.control \{\s*@apply ([^;]+);/)?.[1]?.split(" ") ?? [];

describe("PILL", () => {
  it.each(["border", "py-1", "text-row"])("shares %s with the control box", (utility) => {
    expect(control).toContain(utility);
    expect(PILL.split(" ")).toContain(utility);
  });
});
