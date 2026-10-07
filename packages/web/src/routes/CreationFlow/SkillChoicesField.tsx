import { type CharacterDefinition, type ContentRef, refKey } from "@dnd/character";
import { useFormContext } from "react-hook-form";
import { ChipList } from "../../components/ChipList.tsx";
import { NO_GRANTS } from "./grants.ts";
import { needed } from "./skillPicks.ts";
import { useSkillTally } from "./useSkillTally.ts";

const HEADING = "font-semibold text-label text-muted uppercase tracking-label";

const byName = (a: ContentRef, b: ContentRef) => a.name.localeCompare(b.name);

/**
 * The skills the race and background grant, and a checkbox list for each pick the class
 * and the background offer. A skill a grant already covers shows checked and disabled, so
 * it cannot be picked twice and wasted; where the rules give a pick of any skill in place
 * of one gained twice, a list of every skill offers it. The count each list allows is a
 * note rather than a fence: a pick past it is kept, and `CreationSkills` notes it as a
 * departure, as it does a skill no list offers any more, such as one a changed class left
 * behind, which stays listed here so it can be cleared.
 */
export function SkillChoicesField() {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  const found = useSkillTally();
  if (found === undefined) return null;
  const { granted, offers, skills, tally } = found;
  const replacement = offers.some((offer) => offer.by === "Replacement");
  const grantedBy = new Map(granted.map((grant) => [refKey(grant.ref), grant.by]));
  const held = new Set(skills.map((skill) => refKey(skill.ref)));
  const toggle = (ref: ContentRef) => {
    const current = getValues("proficiencies") ?? NO_GRANTS;
    const key = refKey(ref);
    setValue(
      "proficiencies",
      {
        ...current,
        skills: held.has(key)
          ? current.skills.filter((skill) => refKey(skill.ref) !== key)
          : [...current.skills, { ref, level: "proficient" }],
      },
      { shouldDirty: true },
    );
  };

  const checkbox = (ref: ContentRef) => {
    const by = grantedBy.get(refKey(ref));
    return (
      <label
        key={refKey(ref)}
        className={`flex items-center gap-2 py-0.5 text-body ${by ? "text-muted" : "text-ink"}`}
      >
        <input
          type="checkbox"
          checked={by !== undefined || held.has(refKey(ref))}
          disabled={by !== undefined}
          onChange={() => toggle(ref)}
        />
        {by ? `${ref.name} — ` : ref.name}
        {by && <span className="text-row">granted by {by}</span>}
      </label>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {granted.length > 0 && (
        <section aria-labelledby="granted-skills" className="flex flex-col gap-1.5">
          <h2 id="granted-skills" className={HEADING}>
            Granted skills
          </h2>
          <ChipList labels={granted.map((grant) => `${grant.ref.name} (${grant.by})`)} />
        </section>
      )}
      {offers.map((offer, index) => {
        const taken = tally.picked[index]?.length ?? 0;
        const wanted = needed(offer, granted);
        const replaces = offer.by === "Replacement";
        return (
          <fieldset key={offer.by} className="flex flex-col gap-1">
            <legend className={HEADING}>
              {replaces ? "Any skill, in place of a duplicate" : `From ${offer.by}: ${offer.name}`}
            </legend>
            <p
              aria-live="polite"
              className={`mt-1 text-row ${taken === wanted ? "text-muted" : "font-semibold text-accent-text"}`}
            >
              Choose {offer.count} — {taken} selected
              {!replaces &&
                wanted < offer.count &&
                `, all the list has left once the grants are counted${replacement ? ", so any skill below makes up the rest" : ""}`}
            </p>
            {replaces && <p className="text-muted text-row">In place of {offer.name}.</p>}
            {[...offer.options].sort(byName).map(checkbox)}
          </fieldset>
        );
      })}
      {tally.outside.length > 0 && (
        <fieldset className="flex flex-col gap-1">
          <legend className={HEADING}>Other skills</legend>
          <p className="mt-1 text-muted text-row">
            Neither the class nor the background offers these.
          </p>
          {[...tally.outside].sort(byName).map(checkbox)}
        </fieldset>
      )}
    </div>
  );
}
