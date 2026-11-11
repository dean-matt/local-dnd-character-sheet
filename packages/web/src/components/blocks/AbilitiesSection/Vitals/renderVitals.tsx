import type { CharacterDerived, CharacterRecord, CharacterState } from "@dnd/character";
import { vi } from "vitest";
import { characterRecord, derivedRecord, stateRecord } from "../../../../test/records.ts";
import { renderWithClient } from "../../../../test/renderWithClient.tsx";
import { Vitals } from "./Vitals.tsx";

const CONDITIONS = {
  items: ["Exhaustion", "Poisoned", "Prone", "Stunned"].map((name) => ({
    type: "condition",
    name,
    source: "XPHB",
    edition: "one",
  })),
  total: 4,
  limit: 100,
  offset: 0,
};

/** The spells needing concentration that `/search` answers, with each one's level for `/spells/lookup`. */
const CONCENTRATION_SPELLS = [
  { type: "spell", name: "Bless", source: "XPHB", edition: "one", level: 1 },
  { type: "spell", name: "Hold Person", source: "XPHB", edition: "one", level: 2 },
  { type: "spell", id: "hb1", name: "Hexing Ward", edition: "one", level: 9 },
];

const page = (items: object[]) => ({ items, total: items.length, limit: 20, offset: 0 });

function lookedUp(body: string) {
  const [ref] = JSON.parse(body).spells;
  const spell = CONCENTRATION_SPELLS.find((each) =>
    "homebrewId" in ref ? each.id === ref.homebrewId : each.name === ref.name,
  );
  return { spells: [spell ? { name: spell.name, level: spell.level } : null] };
}

function derived(defenses?: CharacterDerived["defenses"]): CharacterDerived {
  const record = derivedRecord();
  return {
    ...record,
    hitPointMaximum: { computed: 20, manual: null, terms: [] },
    defenses: defenses ?? record.defenses,
  };
}

/** Vex, with the `noInstantDeath` house rule as given. */
export function vex(noInstantDeath?: boolean): CharacterRecord {
  const character = characterRecord("1", "Vex");
  return {
    ...character,
    definition: { ...character.definition, houseRules: { noInstantDeath } },
  };
}

/**
 * Renders the Vitals cards, at a 20 hit point maximum, over a stand-in API that keeps what
 * each state write sends and answers later reads with it, as a reload would. `fail` answers
 * every write with a 500 whose error names the attempt, "Disk full, write 2". `hold` keeps
 * each write unanswered until `release`. A spell search answers Bless, Hold Person and the
 * homebrew Hexing Ward. `defenses` stands in for the derived block's. Returns the writes, in order, the spell search URLs, `release`, and
 * `reload`, which renders the cards again over a fresh cache.
 */
export function renderVitals(
  state: Partial<CharacterState>,
  {
    character = vex(),
    fail = false,
    hold = false,
    defenses,
  }: {
    character?: CharacterRecord;
    fail?: boolean;
    hold?: boolean;
    defenses?: CharacterDerived["defenses"];
  } = {},
) {
  let stored = { ...stateRecord(), state: { ...stateRecord().state, ...state } };
  const writes: CharacterState[] = [];
  const searches: string[] = [];
  let attempts = 0;
  let release = () => {};
  const held = hold ? new Promise<void>((resolve) => (release = resolve)) : Promise.resolve();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/search") && url.includes("type=spell")) {
        searches.push(url);
        return new Response(
          JSON.stringify(page(CONCENTRATION_SPELLS.map(({ level: _, ...hit }) => hit))),
        );
      }
      if (url.includes("/search")) return new Response(JSON.stringify(CONDITIONS));
      if (url.includes("/spells/lookup")) {
        return new Response(JSON.stringify(lookedUp(String(init?.body))));
      }
      if (init?.method === "PUT") {
        const attempt = ++attempts;
        await held;
        if (fail) {
          return new Response(JSON.stringify({ error: `Disk full, write ${attempt}` }), {
            status: 500,
          });
        }
        const written = JSON.parse(String(init.body));
        writes.push(written);
        stored = { ...stored, state: written };
      }
      return new Response(JSON.stringify(stored), { status: 200 });
    }),
  );
  const render = () =>
    renderWithClient(<Vitals character={character} derived={derived(defenses)} />);
  const view = render();
  return {
    writes,
    searches,
    release: () => release(),
    reload() {
      view.unmount();
      render();
    },
  };
}
