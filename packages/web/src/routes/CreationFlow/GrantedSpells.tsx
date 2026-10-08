import { refKey } from "@dnd/character";
import type { GrantedSpell } from "./useGrantedBy.ts";

const HEADING = "font-semibold text-label text-muted uppercase tracking-label";

/**
 * The spells the draft's rows give outright, grouped by the row that gives each, drawn in
 * the accent so they read apart from the picks. They are present without a pick, so none
 * can be removed here.
 */
export function GrantedSpells({ granted }: { granted: readonly GrantedSpell[] }) {
  const byGrantor = new Map<string, GrantedSpell[]>();
  for (const spell of granted) byGrantor.set(spell.by, [...(byGrantor.get(spell.by) ?? []), spell]);
  return [...byGrantor].map(([by, spells]) => (
    <section key={by} aria-label={`Granted by ${by}`} className="flex flex-col gap-1.5">
      <h2 className={HEADING}>Granted by {by}</h2>
      <ul className="flex flex-wrap gap-1.5">
        {spells.map(({ ref }) => (
          <li
            key={refKey(ref)}
            className="rounded-pill border border-accent-text bg-accent-tint px-2.5 py-1 text-accent-text text-row"
          >
            {ref.name}
          </li>
        ))}
      </ul>
    </section>
  ));
}
