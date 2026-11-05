import type { CharacterDerived, CharacterRecord, CharacterState } from "@dnd/character";
import { vi } from "vitest";
import { characterRecord, derivedRecord, stateRecord } from "../../../../test/records.ts";
import { renderWithClient } from "../../../../test/renderWithClient.tsx";
import { Vitals } from "./Vitals.tsx";

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
 * every write with a 500. Returns the writes, in order, and `reload`, which renders the cards
 * again over a fresh cache.
 */
export function renderVitals(
  state: Partial<CharacterState>,
  { character = vex(), fail = false } = {},
) {
  let stored = { ...stateRecord(), state: { ...stateRecord().state, ...state } };
  const writes: CharacterState[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PUT") {
        if (fail) return new Response(JSON.stringify({ error: "Disk full" }), { status: 500 });
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
    reload() {
      view.unmount();
      render();
    },
  };
}
