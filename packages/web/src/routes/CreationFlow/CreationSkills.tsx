import type { CharacterDefinition } from "@dnd/character";
import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { withDeparture } from "./departures.ts";
import { SKILLS_FIELD, skillDeparture } from "./skillPicks.ts";
import { useSkillTally } from "./useSkillTally.ts";

/**
 * Keeps the note on skills taken against the class's and background's lists in step with
 * them, on every step, so a class changed on Class notes the picks its list no longer
 * offers without a visit back to the step that made them.
 */
export function CreationSkills() {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  const found = useSkillTally();
  const ready = found !== undefined;
  const note = found && skillDeparture(found.offers, found.tally);

  useEffect(() => {
    if (!ready) return;
    const departures = getValues("departures");
    const next = withDeparture(departures, SKILLS_FIELD, note);
    if (JSON.stringify(next) !== JSON.stringify(departures ?? []))
      setValue("departures", next, { shouldDirty: true });
  }, [ready, note, getValues, setValue]);

  return null;
}
