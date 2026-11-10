import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord } from "../../../test/records.ts";
import { renderWithClient } from "../../../test/renderWithClient.tsx";
import { stubFetchByUrl } from "../../../test/stubFetch.ts";
import { RollLog } from "./RollLog.tsx";

afterEach(() => vi.unstubAllGlobals());

const roll = (id: number, characterId: string, characterName: string) => ({
  id,
  characterId,
  characterName,
  rolledAt: "2026-01-01T00:00:00.000Z",
  label: `${characterName} roll`,
  notation: "1d4",
  total: 3,
  dice: [],
  modifier: 0,
  critical: false,
});

describe("RollLog with no open character", () => {
  it("starts the Character facet at All characters", async () => {
    stubFetchByUrl({
      "/api/rolls": [roll(2, "2", "Mira"), roll(1, "1", "Vex")],
      "/api/characters": [characterRecord("1", "Vex"), characterRecord("2", "Mira")],
    });
    renderWithClient(<RollLog latest={null} />);
    expect(await screen.findAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Filter Roll Log" }));
    expect(screen.getByRole("combobox", { name: "Character" })).toHaveTextContent("All characters");
  });
});
