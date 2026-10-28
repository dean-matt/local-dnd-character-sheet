import type { SearchHit } from "@dnd/catalog";
import {
  type CharacterRecord,
  type OptionalFeatureEntitlement,
  optionalFeatureTallies,
} from "@dnd/character";
import { QueryClient, QueryClientProvider, skipToken, useQuery } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../hooks/characterKeys.ts";
import { warlockRecord } from "../../../test/records.ts";
import { OptionalFeaturePicks } from "./OptionalFeaturePicks.tsx";

const WARLOCK = { name: "Warlock", source: "XPHB" };
const ADEPT = { name: "Eldritch Adept", source: "TCE" };
const FROM_WARLOCK = { kind: "class", ref: WARLOCK } as const;
const FROM_ADEPT = { kind: "feat", ref: ADEPT } as const;

const ENTITLEMENTS: OptionalFeatureEntitlement[] = [
  { featureType: "EI", known: 1, grantedBy: FROM_WARLOCK, edition: "one" },
  { featureType: "EI", known: 1, grantedBy: FROM_ADEPT, edition: "classic" },
];

const invocation = (name: string, grantedBy: OptionalFeatureEntitlement["grantedBy"]) => ({
  ref: { name, source: "XPHB" },
  featureType: "EI",
  grantedBy,
});

const hit = (name: string, prerequisites: object[] = []): SearchHit => ({
  type: "optfeature",
  name,
  source: "XPHB",
  edition: "one",
  optionalFeature: {
    prerequisites: prerequisites.map((part) => ({
      spells: [],
      options: [],
      unjudged: [],
      ...part,
    })),
  },
});

const HITS = [
  hit("Agonizing Blast"),
  hit("Thirsting Blade", [{ level: 5, className: "Warlock" }]),
  hit("Armor of Shadows"),
];

function holding(picks: ReturnType<typeof invocation>[]): CharacterRecord {
  const record = warlockRecord();
  return { ...record, definition: { ...record.definition, optionalFeatures: picks } };
}

/** Answers a search with `HITS`, a homebrew read with none, and a write with the record it sent. */
function stubApi() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("/api/search")) {
      return new Response(
        JSON.stringify({ items: HITS, total: HITS.length, limit: 20, offset: 0 }),
      );
    }
    const definition = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ ...warlockRecord(), definition }));
  });
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) =>
    String(input).startsWith("/api/homebrew/") ? new Response("[]") : fetchMock(input, init),
  );
  return fetchMock;
}

/** Reads the character from the cache, as the sheet does, so a write's response reaches it. */
function Seeded({ id }: { id: string }) {
  const { data } = useQuery<CharacterRecord>({ queryKey: characterKey(id), queryFn: skipToken });
  if (!data) return null;
  const tallies = optionalFeatureTallies(data.definition.optionalFeatures, ENTITLEMENTS);
  return <OptionalFeaturePicks character={data} tallies={tallies} />;
}

function renderSeeded(character: CharacterRecord) {
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

const written = async (fetchMock: ReturnType<typeof stubApi>) => {
  await waitFor(() =>
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PUT")).toBe(true),
  );
  const [, init] = fetchMock.mock.calls.find(([, each]) => each?.method === "PUT") ?? [];
  return JSON.parse(String(init?.body)).optionalFeatures;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OptionalFeaturePicks", () => {
  it("shows how many the character may pick, and what entitles them", () => {
    stubApi();
    renderSeeded(holding([invocation("Agonizing Blast", FROM_WARLOCK)]));

    expect(screen.getByText("Choose 2 — 1 selected")).toBeInTheDocument();
    expect(
      screen.getByText("Entitled to 1 from Warlock, 1 from Eldritch Adept."),
    ).toBeInTheDocument();
  });

  it("reports picks past the entitlement, with the entitlement beside them", () => {
    stubApi();
    renderSeeded(
      holding(
        ["Agonizing Blast", "Armor of Shadows", "Mask of Many Faces"].map((name) =>
          invocation(name, FROM_WARLOCK),
        ),
      ),
    );

    expect(
      screen.getByText("3 chosen, 1 past the 2 entitled: 1 from Warlock, 1 from Eldritch Adept."),
    ).toBeInTheDocument();
  });

  it("lists an option whose prerequisite is unmet as unavailable, saying what it needs", async () => {
    const fetchMock = stubApi();
    renderSeeded(holding([invocation("Agonizing Blast", FROM_WARLOCK)]));

    fireEvent.focus(screen.getByRole("combobox", { name: "Add an eldritch invocation" }));

    const list = await screen.findByRole("listbox");
    await waitFor(() => expect(within(list).getAllByRole("option")).toHaveLength(3));
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "/api/search?edition=classic&limit=20&type=optfeature&featureType=EI",
    );
    const option = (name: string) => within(list).getByRole("option", { name: new RegExp(name) });
    expect(option("Thirsting Blade")).toHaveAttribute("aria-disabled", "true");
    expect(option("Thirsting Blade")).toHaveTextContent("Needs Warlock level 5");
    expect(option("Agonizing Blast")).toHaveTextContent("Chosen already");
    expect(option("Armor of Shadows")).not.toHaveAttribute("aria-disabled");
  });

  it("adds a pick under the type, spending the entitlement with picks to spare", async () => {
    const fetchMock = stubApi();
    renderSeeded(holding([invocation("Agonizing Blast", FROM_WARLOCK)]));

    fireEvent.focus(screen.getByRole("combobox", { name: "Add an eldritch invocation" }));
    fireEvent.click(await screen.findByRole("option", { name: /Armor of Shadows/ }));

    expect(await written(fetchMock)).toEqual([
      invocation("Agonizing Blast", FROM_WARLOCK),
      invocation("Armor of Shadows", FROM_ADEPT),
    ]);
  });

  it("swaps a pick through the picker in its own grantor's edition, keeping what entitled it", async () => {
    const fetchMock = stubApi();
    renderSeeded(holding([invocation("Agonizing Blast", FROM_WARLOCK)]));

    fireEvent.click(screen.getByRole("button", { name: "Replace Agonizing Blast" }));
    const picker = screen.getByRole("combobox", { name: "Replace Agonizing Blast" });
    expect(picker).toHaveFocus();
    fireEvent.click(await screen.findByRole("option", { name: /Armor of Shadows/ }));

    expect(await written(fetchMock)).toEqual([invocation("Armor of Shadows", FROM_WARLOCK)]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("edition=one");
    expect(screen.getByRole("combobox", { name: "Add an eldritch invocation" })).toHaveFocus();
  });

  it("removes a pick", async () => {
    const fetchMock = stubApi();
    renderSeeded(holding([invocation("Agonizing Blast", FROM_WARLOCK)]));

    fireEvent.click(screen.getByRole("button", { name: "Remove Agonizing Blast" }));

    expect(await written(fetchMock)).toEqual([]);
  });
});
