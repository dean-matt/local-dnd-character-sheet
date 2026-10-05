import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDisabledSources, setDisabledSources } from "../lib/disabledSources.ts";
import { renderWithClient } from "../test/renderWithClient.tsx";
import { stubFetchByUrl } from "../test/stubFetch.ts";
import { SourcesSettings } from "./SourcesSettings.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
  setDisabledSources([]);
});

describe("SourcesSettings", () => {
  it("lists each source with its title and toggles one at a time", async () => {
    setDisabledSources(["VGM"]);
    stubFetchByUrl({
      "/api/search/sources": { sources: ["PHB", "UATheMysticClass", "VGM"] },
      "/api/catalog/sources": {
        sources: [
          { source: "PHB", name: "Player's Handbook" },
          { source: "VGM", name: "Volo's Guide to Monsters" },
        ],
      },
    });
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
});
