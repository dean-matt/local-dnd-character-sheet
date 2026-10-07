import type { CharacterDefinition } from "@dnd/character";
import { useFormContext } from "react-hook-form";
import { DepartureMark } from "./DepartureMark.tsx";
import { NO_GRANTS } from "./grants.ts";
import { holdsTool, TOOLS_FIELD, toolsNeeded } from "./toolPicks.ts";
import { useToolTally } from "./useToolTally.ts";

const HEADING = "font-semibold text-label text-muted uppercase tracking-label";

const byName = (a: string, b: string) => a.localeCompare(b);

/**
 * A checkbox list for each tool pick the class and the background offer. A tool a grant
 * already covers shows checked and disabled; where the rules give a pick of any tool in
 * place of one gained twice, a list of every tool offers it. The count each list allows is a note rather
 * than a fence: a pick past it is kept, and `CreationTools` notes it as a departure, as it
 * does a tool no list offers, such as one a changed class left behind, which stays listed
 * here so it can be cleared.
 */
export function ToolChoicesField() {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  const found = useToolTally();
  if (found === undefined) return null;
  const { granted, offers, held, tally } = found;
  const replacement = offers.some((offer) => offer.by === "Replacement");
  if (offers.length === 0 && tally.outside.length === 0) return null;
  const grantedBy = (name: string) => granted.find((grant) => holdsTool([grant.name], name))?.by;
  const toggle = (name: string) => {
    const current = getValues("proficiencies") ?? NO_GRANTS;
    setValue(
      "proficiencies",
      {
        ...current,
        tools: holdsTool(held, name)
          ? current.tools.filter((tool) => !holdsTool([name], tool.name))
          : [...current.tools, { name, level: "proficient" }],
      },
      { shouldDirty: true },
    );
  };

  const checkbox = (name: string) => {
    const by = grantedBy(name);
    return (
      <label
        key={name}
        className={`flex items-center gap-2 py-0.5 text-body ${by ? "text-muted" : "text-ink"}`}
      >
        <input
          type="checkbox"
          checked={by !== undefined || holdsTool(held, name)}
          disabled={by !== undefined}
          onChange={() => toggle(name)}
        />
        {by ? `${name} — ` : name}
        {by && <span className="text-row">granted by {by}</span>}
      </label>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {offers.map((offer, index) => {
        const taken = tally.picked[index]?.length ?? 0;
        const wanted = toolsNeeded(offer, granted);
        const replaces = offer.by === "Replacement";
        return (
          <fieldset key={`${offer.by}-${offer.kind ?? index}`} className="flex flex-col gap-1">
            <legend className={HEADING}>
              {replaces
                ? "Any tool, in place of a duplicate"
                : `Tools from ${offer.by}: ${offer.name}`}
              {offer.kind && ` (${offer.kind})`}
            </legend>
            <p
              aria-live="polite"
              className={`mt-1 text-row ${taken === wanted ? "text-muted" : "font-semibold text-accent-text"}`}
            >
              Choose {offer.count} — {taken} selected
              {!replaces &&
                wanted < offer.count &&
                `, all the list has left once the grants are counted${replacement ? ", so any tool below makes up the rest" : ""}`}
            </p>
            {replaces && <p className="text-muted text-row">In place of {offer.name}.</p>}
            {[...offer.options].sort(byName).map(checkbox)}
          </fieldset>
        );
      })}
      {tally.outside.length > 0 && (
        <fieldset className="flex flex-col gap-1">
          <legend className={HEADING}>Other tools</legend>
          <p className="mt-1 text-muted text-row">
            Neither the class nor the background offers these.
          </p>
          {[...tally.outside].sort(byName).map(checkbox)}
        </fieldset>
      )}
      <DepartureMark field={TOOLS_FIELD} />
    </div>
  );
}
