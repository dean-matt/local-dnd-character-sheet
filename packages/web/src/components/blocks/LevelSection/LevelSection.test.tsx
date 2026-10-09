import type { CharacterDefinition, CharacterRecord } from "@dnd/character";
import { QueryClient, QueryClientProvider, skipToken, useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../hooks/characterKeys.ts";
import { identityRecord } from "../../../test/records.ts";
import { stubFetch } from "../../../test/stubFetch.ts";
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
    </QueryClientProvider>,
  );
}

const card = () => screen.getByRole("region", { name: "Level" });
const adjust = () => screen.getByRole("spinbutton", { name: /Adjust experience points/ });
const applyButton = () => screen.getByRole("button", { name: "Apply" });
const sentBody = (fetchMock: ReturnType<typeof stubFetch>) =>
  JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body));

function applyXp(amount: string) {
  fireEvent.change(adjust(), { target: { value: amount } });
  fireEvent.click(applyButton());
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

  it("shows the milestone copy and no experience in milestone mode", () => {
    renderSeeded(record({ leveling: "milestone", experience: 1500 }));

    expect(within(card()).getByText(/Milestone leveling — the DM says/)).toBeInTheDocument();
    expect(within(card()).queryByText("1,500 XP")).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("saves a picked leveling mode", async () => {
    const saved = record({ leveling: "milestone" });
    const fetchMock = stubFetch(new Response(JSON.stringify(saved)));
    renderSeeded();

    fireEvent.click(screen.getByRole("combobox", { name: "Leveling" }));
    fireEvent.click(screen.getByRole("option", { name: "Milestone" }));

    await waitFor(() => expect(within(card()).getByText(/Milestone leveling/)).toBeInTheDocument());
    expect(sentBody(fetchMock).leveling).toBe("milestone");
  });

  it("adds experience to the stored total and clears the field", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify(record({ experience: 1750 }))));
    renderSeeded(record({ experience: 1500 }));

    applyXp("250");

    expect(adjust()).toHaveValue(null);
    await waitFor(() => expect(within(card()).getByText("1,750 XP")).toBeInTheDocument());
    expect(sentBody(fetchMock).experience).toBe(1750);
  });

  it("removes experience with a negative amount, never below zero", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify(record({ experience: 0 }))));
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
    const fetchMock = stubFetch(
      new Response(JSON.stringify({ error: "disk full" }), { status: 500 }),
    );
    renderSeeded(record({ experience: 1500 }));

    applyXp("250");

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save +250 XP: disk full"),
    );
    expect(within(card()).getByText("1,500 XP")).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(record({ experience: 1750 }))));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(within(card()).getByText("1,750 XP")).toBeInTheDocument());
    expect(sentBody(fetchMock).experience).toBe(1750);
  });
});
