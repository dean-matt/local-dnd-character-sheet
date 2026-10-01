import { describe, expect, it } from "vitest";
import { escapeLikeTerm } from "./search-terms.ts";

describe("escapeLikeTerm", () => {
  it("escapes a percent, an underscore and the escape character itself", () => {
    expect(escapeLikeTerm("50%")).toBe("50!%");
    expect(escapeLikeTerm("under_score")).toBe("under!_score");
    expect(escapeLikeTerm("bang!")).toBe("bang!!");
  });
});
