import { fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDisabledSources, setDisabledSources } from "../../lib/disabledSources.ts";
import { renderWithClient } from "../../test/renderWithClient.tsx";
import { stubFetchByUrl } from "../../test/stubFetch.ts";
import { SourcesSettings } from "./SourcesSettings.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
  setDisabledSources([]);
});

function stubSources() {
  stubFetchByUrl({
    "/api/search/sources": { sources: ["CoS", "PHB", "UATheMysticClass", "VGM", "XPHB"] },
    "/api/catalog/sources": {
      sources: [
        { source: "CoS", name: "Curse of Strahd", group: "adventure" },
        { source: "PHB", name: "Player's Handbook", group: "core" },
        { source: "VGM", name: "Volo's Guide to Monsters", group: "supplement" },
        { source: "XPHB", name: "Player's Handbook (2024)", group: "core" },
      ],
    },
  });
}

const filter = () => screen.getByRole("searchbox", { name: "Filter sources" });

describe("SourcesSettings", () => {
  it("lists each source with its title and toggles one at a time", async () => {
    setDisabledSources(["VGM"]);
    stubSources();
    renderWithClient(<SourcesSettings />);

    const phb = await screen.findByRole("switch", { name: "PHB Player's Handbook" });
    const vgm = screen.getByRole("switch", { name: "VGM Volo's Guide to Monsters" });
    expect(phb).toBeChecked();
    expect(screen.getByRole("switch", { name: "UATheMysticClass" })).toBeChecked();
    expect(vgm).not.toBeChecked();

    fireEvent.click(phb);
    fireEvent.click(vgm);

    expect(phb).not.toBeChecked();
    expect(vgm).toBeChecked();
    expect(getDisabledSources()).toEqual(["PHB"]);
  });

  it("puts each source under a group heading", async () => {
    stubSources();
    renderWithClient(<SourcesSettings />);

    await screen.findByRole("switch", { name: "PHB Player's Handbook" });
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Core rulebooks",
      "Supplements",
      "Adventures",
      "Playtest",
    ]);
    const core = screen.getByRole("region", { name: "Core rulebooks" });
    expect(within(core).getAllByRole("switch")).toHaveLength(2);
  });

  it("turns a whole group off and on, leaving every other source as it was", async () => {
    setDisabledSources(["VGM"]);
    stubSources();
    renderWithClient(<SourcesSettings />);
    await screen.findByRole("switch", { name: "PHB Player's Handbook" });

    const core = screen.getByRole("region", { name: "Core rulebooks" });
    fireEvent.click(within(core).getByRole("button", { name: "Turn all off" }));
    expect(getDisabledSources()).toEqual(["PHB", "VGM", "XPHB"]);

    fireEvent.click(within(core).getByRole("button", { name: "Turn all on" }));
    expect(getDisabledSources()).toEqual(["VGM"]);
  });

  it("narrows the list as you type and turns off only what the filter shows", async () => {
    stubSources();
    renderWithClient(<SourcesSettings />);
    await screen.findByRole("switch", { name: "PHB Player's Handbook" });

    fireEvent.change(filter(), { target: { value: "player" } });
    expect(screen.getAllByRole("switch")).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("2 sources match");
    expect(
      within(screen.getByRole("region", { name: "Core rulebooks" })).getByRole("button", {
        name: "Turn all off",
      }),
    ).toHaveAccessibleDescription("Core rulebooks 2 sources match");

    const matched = screen.getByText("2 sources match", { selector: "p[id]" })
      .parentElement as HTMLElement;
    fireEvent.click(within(matched).getByRole("button", { name: "Turn all off" }));
    expect(getDisabledSources()).toEqual(["PHB", "XPHB"]);
  });

  it("describes a group's bulk switches by that group's matches, not the page's", async () => {
    stubSources();
    renderWithClient(<SourcesSettings />);
    await screen.findByRole("switch", { name: "PHB Player's Handbook" });

    fireEvent.change(filter(), { target: { value: "o" } });
    expect(screen.getByRole("status")).toHaveTextContent("4 sources match");
    const core = screen.getByRole("region", { name: "Core rulebooks" });
    const off = within(core).getByRole("button", { name: "Turn all off" });
    expect(off).toHaveAccessibleDescription("Core rulebooks 2 sources match");

    fireEvent.click(off);
    expect(getDisabledSources()).toEqual(["PHB", "XPHB"]);
  });

  it("says so when the filter matches nothing", async () => {
    stubSources();
    renderWithClient(<SourcesSettings />);
    await screen.findByRole("switch", { name: "PHB Player's Handbook" });

    fireEvent.change(filter(), { target: { value: "zzz" } });
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent("No source matches “zzz”.");
  });

  const chip = (name: string) => screen.getByRole("button", { name });
  const headings = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

  it("offers a chip per group with sources, after All", async () => {
    stubSources();
    renderWithClient(<SourcesSettings />);
    await screen.findByRole("switch", { name: "PHB Player's Handbook" });

    const chips = within(screen.getByRole("group", { name: "Show groups" })).getAllByRole("button");
    expect(chips.map((c) => c.textContent)).toEqual([
      "All",
      "Core rulebooks",
      "Supplements",
      "Adventures",
      "Playtest",
    ]);
    expect(chip("All")).toHaveAttribute("aria-pressed", "true");
  });

  it("narrows the list to the chosen groups, combining several", async () => {
    stubSources();
    renderWithClient(<SourcesSettings />);
    await screen.findByRole("switch", { name: "PHB Player's Handbook" });

    fireEvent.click(chip("Core rulebooks"));
    expect(chip("All")).toHaveAttribute("aria-pressed", "false");
    expect(chip("Core rulebooks")).toHaveAttribute("aria-pressed", "true");
    expect(headings()).toEqual(["Core rulebooks"]);
    expect(screen.getByRole("status")).toHaveTextContent("2 sources match");

    fireEvent.click(chip("Adventures"));
    expect(headings()).toEqual(["Core rulebooks", "Adventures"]);
    expect(screen.getByRole("status")).toHaveTextContent("3 sources match");

    fireEvent.click(chip("Core rulebooks"));
    expect(headings()).toEqual(["Adventures"]);
  });

  it("clears the chosen groups when All is pressed", async () => {
    stubSources();
    renderWithClient(<SourcesSettings />);
    await screen.findByRole("switch", { name: "PHB Player's Handbook" });

    fireEvent.click(chip("Core rulebooks"));
    fireEvent.click(chip("Playtest"));
    fireEvent.click(chip("All"));

    expect(chip("All")).toHaveAttribute("aria-pressed", "true");
    expect(chip("Core rulebooks")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getAllByRole("switch")).toHaveLength(5);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("turns off only what the chips and the filter both show", async () => {
    stubSources();
    renderWithClient(<SourcesSettings />);
    await screen.findByRole("switch", { name: "PHB Player's Handbook" });

    fireEvent.click(chip("Core rulebooks"));
    fireEvent.click(chip("Supplements"));
    fireEvent.change(filter(), { target: { value: "o" } });
    expect(screen.getByRole("status")).toHaveTextContent("3 sources match");

    const matched = screen.getByText("3 sources match", { selector: "p[id]" })
      .parentElement as HTMLElement;
    fireEvent.click(within(matched).getByRole("button", { name: "Turn all off" }));
    expect(getDisabledSources()).toEqual(["PHB", "VGM", "XPHB"]);
  });

  it("says so when the filter matches nothing in the chosen groups", async () => {
    stubSources();
    renderWithClient(<SourcesSettings />);
    await screen.findByRole("switch", { name: "PHB Player's Handbook" });

    fireEvent.click(chip("Adventures"));
    fireEvent.change(filter(), { target: { value: "player" } });
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent(
      "No source in the chosen groups matches “player”.",
    );
  });

  it("says why every source sits under Other when the titles fail to load", async () => {
    stubFetchByUrl({ "/api/search/sources": { sources: ["PHB", "VGM"] } });
    renderWithClient(<SourcesSettings />);

    expect(
      await screen.findByText("Titles and groups did not load, so every source sits under Other."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Other",
    ]);
  });
});
