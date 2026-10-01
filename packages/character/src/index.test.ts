import { readdir, readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("a key the schema does not name", () => {
  /**
   * The parse tests beside each schema name that schema. This one holds the schema added
   * next: an open object in any source file reopens the hole, and a parse of a fixed shape
   * misses it.
   *
   * Comments come out first, so that prose naming the forbidden call — as the package's
   * module doc has every reason to — stays free to say it.
   */
  it("keeps every object in the package strict, including the one added next", async () => {
    const root = new URL("./", import.meta.url);
    const files = (await readdir(root, { recursive: true })).filter(
      (file) => file.endsWith(".ts") && !file.endsWith(".test.ts"),
    );
    const sources = await Promise.all(files.map((file) => readFile(new URL(file, root), "utf8")));
    const code = sources
      .map((source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, ""))
      .join("\n");

    expect(files).toContain("definition.ts");
    expect(code).toContain("z.strictObject(");
    expect(code).not.toMatch(/\.(object|looseObject)\(/);
  });
});
