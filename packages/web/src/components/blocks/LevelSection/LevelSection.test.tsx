import type { CharacterDefinition, CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider, skipToken, useQuery } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { characterKey } from "../../../hooks/characterKeys.ts";
import { identityRecord } from "../../../test/records.ts";
import { saveToasts } from "../../../test/saveToasts.ts";
import { SaveToasts } from "../../SaveToasts.tsx";
import { LevelSection } from "./LevelSection.tsx";

/** Reads the character from the cache, as the sheet does, so a write's response reaches it. */
function Seeded({ id }: { id: string }) {
  const { data } = useQuery<CharacterRecord>({ queryKey: characterKey(id), queryFn: skipToken });
  return <LevelSection character={data} />;
}

/** `identityRecord`'s Vex, a level 3 character, with `edit` laid over the definition. */
function record(edit: Partial<CharacterDefinition> = {}): CharacterRecord {
  const base = identityRecord();
  return { ...base, definition: { ...base.definition, ...edit } };
}

function renderSeeded(character = record()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(characterKey(character.id), character);
  render(
    <QueryClientProvider client={client}>
      <Seeded id={character.id} />
      <SaveToasts />
    </QueryClientProvider>,
  );
  return client;
}

const card = () => screen.getByRole("region", { name: "Level" });
const adjust = () => screen.getByRole("spinbutton", { name: /Adjust experience points/ });
const applyButton = () => screen.getByRole("button", { name: "Apply" });
const sentBody = (fetchMock: Mock) => JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body));

function applyXp(amount: string) {
  fireEvent.change(adjust(), { target: { value: amount } });
  fireEvent.click(applyButton());
}

const FIGHTER = { name: "Fighter", source: "XPHB" };
const NO_GRANTS = { level: 1, resources: [], spellSlots: [], optionalFeatures: [], features: [] };
let classGrants: unknown;
let writes: Mock;

/** Answers the class and feat reads `Improvements` makes, and hands every other call to `writes`. */
beforeEach(() => {
  classGrants = NO_GRANTS;
  writes = vi.fn();
  vi.stubGlobal("fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = String(url);
    if (path.startsWith("/api/classes/")) return new Response(JSON.stringify(classGrants));
    if (path.startsWith("/api/feats?"))
      return new Response(JSON.stringify({ items: [], total: 0 }));
    return writes(url, init);
  });
});

function stubWrite(response: Response) {
  writes.mockResolvedValue(response);
  return writes;
}

afterEach(() => vi.unstubAllGlobals());

describe("LevelSection", () => {
  it("shows the total level beside a chip per class", () => {
    renderSeeded();

    expect(within(card()).getByText("3")).toHaveClass("text-[32px]", "font-bold");
    expect(
      within(card())
        .queryAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Warlock 2 (Fiend Patron)", "Fighter 1"]);
  });

  it("follows the Level card with the improvements the classes grant", async () => {
    const asi = { name: "Ability Score Improvement", source: "XPHB", level: 4 };
    classGrants = { ...NO_GRANTS, level: 4, features: [{ ...asi, json: asi }] };
    renderSeeded(record({ levels: Array.from({ length: 4 }, () => ({ class: FIGHTER })) }));

    const improvements = await screen.findByRole("region", { name: "Ability Score Improvements" });
    expect(within(improvements).getByText("Level 4 · Fighter 4:")).toBeVisible();
    expect(card().compareDocumentPosition(improvements)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("shows no improvements card where no class grants one", async () => {
    const client = renderSeeded();

    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(
      screen.queryByRole("region", { name: "Ability Score Improvements" }),
    ).not.toBeInTheDocument();
  });

  it("measures experience toward the next level's threshold", () => {
    renderSeeded(record({ experience: 1500 }));

    expect(screen.getByRole("combobox", { name: "Leveling" })).toHaveTextContent("Experience");
    expect(within(card()).getByText("1,500 XP")).toBeInTheDocument();
    expect(within(card()).getByText("2,700 XP")).toBeInTheDocument();
    expect(within(card()).getByText("1,200 XP to Level 4")).toBeInTheDocument();
  });

  it("says a character at the threshold can level up, and leaves the level alone", () => {
    renderSeeded(record({ experience: 2700 }));

    expect(within(card()).getByText("Enough XP to level up.")).toBeInTheDocument();
    expect(within(card()).getByText("3")).toBeInTheDocument();
  });

  it("names no next threshold at level 20", () => {
    const fighter = { class: { name: "Fighter", source: "XPHB" } };
    renderSeeded(record({ levels: Array.from({ length: 20 }, () => fighter), experience: 400000 }));

    expect(within(card()).getByText("Max level")).toBeInTheDocument();
    expect(
      within(card()).getByText("Level 20 — no further experience needed."),
    ).toBeInTheDocument();
  });

  it("holds Level up until the next threshold, citing the experience caption", () => {
    renderSeeded(record({ experience: 1500 }));

    const button = within(card()).getByRole("button", { name: "Level up" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription("1,200 XP to Level 4");
  });

  it("offers Level up in milestone mode, and says why it stops at level 20", () => {
    const fighter = { class: FIGHTER };
    renderSeeded(record({ leveling: "milestone" }));
    expect(within(card()).getByRole("button", { name: "Level up" })).toHaveAttribute(
      "aria-disabled",
      "false",
    );

    cleanup();
    renderSeeded(
      record({ leveling: "milestone", levels: Array.from({ length: 20 }, () => fighter) }),
    );
    expect(within(card()).getByRole("button", { name: "Level up" })).toHaveAccessibleDescription(
      "Level 20 is the highest level.",
    );
  });

  it("shows the milestone copy and no experience in milestone mode", () => {
    renderSeeded(record({ leveling: "milestone", experience: 1500 }));

    expect(within(card()).getByText(/Milestone leveling — the DM says/)).toBeInTheDocument();
    expect(within(card()).queryByText("1,500 XP")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("saves a picked leveling mode", async () => {
    const saved = record({ leveling: "milestone" });
    const fetchMock = stubWrite(new Response(JSON.stringify(saved)));
    renderSeeded();

    fireEvent.click(screen.getByRole("combobox", { name: "Leveling" }));
    fireEvent.click(screen.getByRole("option", { name: "Milestone" }));

    await waitFor(() => expect(within(card()).getByText(/Milestone leveling/)).toBeInTheDocument());
    expect(sentBody(fetchMock).leveling).toBe("milestone");
  });

  it("adds experience to the stored total and clears the field", async () => {
    const fetchMock = stubWrite(new Response(JSON.stringify(record({ experience: 1750 }))));
    renderSeeded(record({ experience: 1500 }));

    applyXp("250");

    expect(adjust()).toHaveValue(null);
    await waitFor(() => expect(within(card()).getByText("1,750 XP")).toBeInTheDocument());
    expect(sentBody(fetchMock).experience).toBe(1750);
  });

  it("removes experience with a negative amount, never below zero", async () => {
    const fetchMock = stubWrite(new Response(JSON.stringify(record({ experience: 0 }))));
    renderSeeded(record({ experience: 100 }));

    applyXp("-300");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sentBody(fetchMock).experience).toBe(0);
  });

  it.each(["", "0", "1.5"])("offers no Apply for %j", (amount) => {
    renderSeeded();
    fireEvent.change(adjust(), { target: { value: amount } });
    expect(applyButton()).toBeDisabled();
  });

  it("keeps the total on a failed save and retries the same amount", async () => {
    const fetchMock = stubWrite(
      new Response(JSON.stringify({ error: "disk full" }), { status: 500 }),
    );
    renderSeeded(record({ experience: 1500 }));

    applyXp("250");

    expect(
      await saveToasts().findByText("Experience: Couldn't save +250 XP: disk full"),
    ).toBeInTheDocument();
    expect(adjust()).toHaveAttribute("aria-invalid", "true");
    expect(within(card()).getByText("1,500 XP")).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(record({ experience: 1750 }))));
    fireEvent.click(saveToasts().getByRole("button", { name: /^Retry / }));

    await waitFor(() => expect(within(card()).getByText("1,750 XP")).toBeInTheDocument());
    expect(sentBody(fetchMock).experience).toBe(1750);
  });
});
