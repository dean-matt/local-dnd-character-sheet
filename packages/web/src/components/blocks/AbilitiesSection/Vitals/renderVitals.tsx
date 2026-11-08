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

function derived(): CharacterDerived {
  return { ...derivedRecord(), hitPointMaximum: { computed: 20, manual: null, terms: [] } };
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
 * each write unanswered until `release`. Returns the writes, in order, `release`, and
 * `reload`, which renders the cards again over a fresh cache.
 */
export function renderVitals(
  state: Partial<CharacterState>,
  { character = vex(), fail = false, hold = false } = {},
) {
  let stored = { ...stateRecord(), state: { ...stateRecord().state, ...state } };
  const writes: CharacterState[] = [];
  let attempts = 0;
  let release = () => {};
  const held = hold ? new Promise<void>((resolve) => (release = resolve)) : Promise.resolve();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/search")) return new Response(JSON.stringify(CONDITIONS));
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
  const render = () => renderWithClient(<Vitals character={character} derived={derived()} />);
  const view = render();
  return {
    writes,
    release: () => release(),
    reload() {
      view.unmount();
      render();
    },
  };
}
