import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "../test/renderWithClient.tsx";
import { stubFetchByUrl } from "../test/stubFetch.ts";
import { SourceChip } from "./SourceChip.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

const SOURCES = { sources: [{ source: "PHB", name: "Player's Handbook (2014)" }] };

describe("SourceChip", () => {
  it("reads a source as its title, with the abbreviation on screen and the title on hover", async () => {
    stubFetchByUrl({ "/api/catalog/sources": SOURCES });
    renderWithClient(<SourceChip source="PHB" />);

    expect(await screen.findByText("Player's Handbook (2014)")).toHaveClass("sr-only");
    const shown = screen.getByText("PHB");
    expect(shown).toHaveAttribute("aria-hidden", "true");
    expect(shown).toHaveAttribute("title", "Player's Handbook (2014)");
  });

  it("reads a source no volume titles as its abbreviation", async () => {
    stubFetchByUrl({ "/api/catalog/sources": SOURCES });
    renderWithClient(
      <>
        <SourceChip source="PHB" />
        <SourceChip source="TftYP" />
      </>,
    );

    await screen.findByText("Player's Handbook (2014)");
    expect(screen.getByText("TftYP")).not.toHaveAttribute("aria-hidden");
  });

  it("draws a homebrew row in the same chip as a source", () => {
    stubFetchByUrl({ "/api/catalog/sources": SOURCES });
    renderWithClient(
      <>
        <SourceChip source={undefined} />
        <SourceChip source="TftYP" />
      </>,
    );

    expect(screen.getByText("Homebrew").className).toBe(screen.getByText("TftYP").className);
  });

  it("puts the edition's year beside the source where the row carries one", () => {
    stubFetchByUrl({});
    renderWithClient(<SourceChip source="XPHB" edition="one" of="spell" />);

    expect(screen.getByText("2024 rules")).toBeInTheDocument();
    expect(screen.getByTitle("This spell uses the 2024 rules")).toBeInTheDocument();
  });
});
