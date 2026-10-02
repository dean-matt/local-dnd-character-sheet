import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { identityRecord } from "../../test/records.ts";
import { LevelSection } from "./LevelSection.tsx";

const chips = (card: string) =>
  within(screen.getByRole("region", { name: card }))
    .queryAllByRole("listitem")
    .map((item) => item.textContent);

describe("LevelSection", () => {
  it("shows the total level beside a chip per class", () => {
    render(<LevelSection character={identityRecord()} />);

    const card = screen.getByRole("region", { name: "Level" });
    expect(within(card).getByText("3")).toHaveClass("text-[32px]", "font-bold");
    expect(chips("Level")).toEqual(["Warlock 2 (Fiend Patron)", "Fighter 1"]);
  });
});
