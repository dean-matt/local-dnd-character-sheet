import {
  type CharacterDerived,
  type CharacterRecord,
  type ContentRef,
  derivedValue,
  effectsOnRoll,
  refKey,
} from "@dnd/character";
import { useHeldWriteError } from "../../../hooks/useHeldWriteError.ts";
import { useSaveToast } from "../../../hooks/useSaveToast.ts";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { ProficiencyRow } from "./ProficiencyRow.tsx";
import { nextLevel } from "./proficiencyMark.ts";

/**
 * The edition's skills, alphabetically, each ring stepping its skill's proficiency and
 * saving it at once as an undo entry. A skill stepped to none leaves
 * `proficiencies.skills`, which lists only the skills a character holds.
 */
export function CatalogSkills({
  character,
  derived,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
}) {
  const update = useUpdateCharacterDefinition(character.id);
  const failure = useHeldWriteError(update);
  const skillLevel = new Map(
    character.definition.proficiencies.skills.map((skill) => [refKey(skill.ref), skill.level]),
  );
  useSaveToast(
    "Skill proficiency",
    failure ? `Couldn't save: ${failure.message}` : undefined,
    () => update.variables && update.mutate(update.variables),
  );
  const rollEffects = derivedValue(derived.rollEffects);
  const skills = [...derived.skills].sort((a, b) => a.ref.name.localeCompare(b.ref.name));

  function cycle(ref: ContentRef) {
    const key = refKey(ref);
    update.mutate((latest) => {
      const held = latest.proficiencies.skills;
      const current = held.find((skill) => refKey(skill.ref) === key);
      const level = nextLevel(current?.level ?? "none");
      const others = held.filter((skill) => skill !== current);
      const kept = level === "none" ? others : [...others, { ref, level }];
      return { ...latest, proficiencies: { ...latest.proficiencies, skills: kept } };
    });
  }

  return (
    <ul className="grid gap-x-5 gap-y-0.5 sm:grid-cols-2">
      {skills.map((skill) => {
        const key = refKey(skill.ref);
        return (
          <ProficiencyRow
            key={key}
            level={skillLevel.get(key) ?? "none"}
            name={skill.ref.name}
            ability={skill.ability}
            modifier={skill.modifier}
            title={skill.ref.name}
            rules={{ tag: "skill", name: skill.ref.name, source: skill.ref.source }}
            effects={effectsOnRoll(rollEffects, {
              roll: "skill",
              skill: skill.ref.name,
              ability: skill.ability,
            })}
            onCycleLevel={() => cycle(skill.ref)}
          />
        );
      })}
    </ul>
  );
}
