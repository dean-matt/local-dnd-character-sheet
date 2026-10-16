import { describe, expect, it } from "vitest";
import { z } from "zod";
import { appliedItemFieldsSchema } from "./index.ts";

describe("appliedItemFieldsSchema", () => {
  it("describes every field", () => {
    const undescribed = Object.entries(appliedItemFieldsSchema.shape)
      .filter(([, schema]) => !schema.description)
      .map(([key]) => key);
    expect(undescribed).toEqual([]);
  });

  it("converts to a JSON schema of what a table writes", () => {
    const { properties } = z.toJSONSchema(appliedItemFieldsSchema, { io: "input" });
    expect(properties?.ability).toHaveProperty("description");
    expect(Object.keys(properties ?? {})).toEqual(Object.keys(appliedItemFieldsSchema.shape));
  });
});
