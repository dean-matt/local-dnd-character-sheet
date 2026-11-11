import { describe, expect, it } from "vitest";
import { homebrewClassFormSchema } from "./homebrewClassChecks.ts";

describe("homebrewClassFormSchema", () => {
  it("names the feature whose name would break its tag", () => {
    const result = homebrewClassFormSchema.safeParse({
      name: "Warden",
      hd: { number: 1, faces: 10 },
      edition: "one",
      features: [{ name: "Fury | Rage", level: 1, entries: ["x"] }],
    });
    const issue = result.error?.issues.find(({ path }) => path[0] === "features");
    expect(issue?.message).toBe('Feature "Fury | Rage" cannot contain "|"');
  });

  it("names the character in a class name that would break its features' tags", () => {
    const result = homebrewClassFormSchema.safeParse({
      name: "War}den",
      hd: { number: 1, faces: 10 },
      edition: "one",
    });
    const issue = result.error?.issues.find(({ path }) => path[0] === "name");
    expect(issue?.message).toBe('Class "War}den" cannot contain "}"');
  });
});
