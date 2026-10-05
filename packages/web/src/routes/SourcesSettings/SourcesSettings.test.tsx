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
    expect(screen.getByText("2 sources match")).toBeInTheDocument();

    const matched = screen.getByText("2 sources match").parentElement as HTMLElement;
    fireEvent.click(within(matched).getByRole("button", { name: "Turn all off" }));
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
});
