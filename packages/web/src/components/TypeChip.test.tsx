import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TypeChip } from "./TypeChip.tsx";

describe("TypeChip", () => {
  it("fills a type with its own color", () => {
    render(<TypeChip type="spell">Spell</TypeChip>);
    expect(screen.getByText("Spell")).toHaveClass("bg-type-spell", "text-white");
  });

  it("fills a row that belongs to another type in its parent's color", () => {
    render(<TypeChip type="magic variant">Magic variant</TypeChip>);
    expect(screen.getByText("Magic variant")).toHaveClass("bg-type-item");
  });

  it("falls back to the neutral chip for a type with no color", () => {
    render(<TypeChip type="optfeature">Optional feature</TypeChip>);
    const chip = screen.getByText("Optional feature");
    expect(chip).toHaveClass("bg-surface", "text-muted");
    expect(chip).not.toHaveClass("text-white");
  });
});
