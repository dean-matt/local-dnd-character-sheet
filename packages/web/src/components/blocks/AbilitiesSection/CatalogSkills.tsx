import {
  type CharacterDerived,
  type CharacterRecord,
  type ContentRef,
  derivedValue,
  effectsOnRoll,
  overrideKey,
  refKey,
} from "@dnd/character";
import { useHeldSave } from "../../../hooks/useHeldSave.ts";
import { ProficiencyRow } from "./ProficiencyRow.tsx";
import { higherLevel, nextLevel, type ProficiencyLevel } from "./proficiencyMark.ts";

/**
 * The edition's skills, alphabetically, each ring stepping its skill's proficiency and
 * saving it at once as an undo entry. A skill stepped to none leaves
 * `proficiencies.skills`, which lists only the skills a character holds. A ring shows the
 * higher of the stored level and what feats grant, and steps on from what it shows, so a
 * feat's skill never reads lower than the feat makes it.
 */
export function CatalogSkills({
  character,
  derived,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
}) {
  const write = useHeldSave(character.id, "Skill proficiency");
  const granted = new Map(
    derivedValue(derived.featGrants).skills.map((skill) => [refKey(skill.ref), skill.level]),
  );
  const shown = (key: string, stored: ProficiencyLevel = "none") =>
    higherLevel(stored, granted.get(key) ?? "none");
  const skillLevel = new Map(
    character.definition.proficiencies.skills.map((skill) => [
      refKey(skill.ref),
      shown(refKey(skill.ref), skill.level),
    ]),
  );
  const rollEffects = derivedValue(derived.rollEffects);
  const skills = [...derived.skills].sort((a, b) => a.ref.name.localeCompare(b.ref.name));

  function cycle(ref: ContentRef) {
    const key = refKey(ref);
    // A feat's expertise steps to none with nothing stored to remove, which changes nothing.
    if (!skillLevel.has(key) && nextLevel(shown(key)) === "none") return;
    write(key, (latest) => {
      const held = latest.proficiencies.skills;
      const current = held.find((skill) => refKey(skill.ref) === key);
      const level = nextLevel(shown(key, current?.level));
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
            level={skillLevel.get(key) ?? shown(key)}
            name={skill.ref.name}
            ability={skill.ability}
            modifier={skill.modifier}
            overrideKey={`${overrideKey("skills", skill, character.definition)}.modifier`}
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
