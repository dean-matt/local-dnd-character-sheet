import {
  type CharacterDerived,
  type CharacterRecord,
  type ContentRef,
  derivedValue,
  effectsOnRoll,
  grantedSkillLevels,
  heldSkillLevel,
  overrideKey,
  refKey,
} from "@dnd/character";
import { useHeldSave } from "../../../hooks/useHeldSave.ts";
import { ProficiencyRow } from "./ProficiencyRow.tsx";
import { nextLevel } from "./proficiencyMark.ts";

/**
 * The edition's skills, alphabetically, each ring stepping its skill's proficiency and
 * saving it at once as an undo entry. A skill stepped to none leaves
 * `proficiencies.skills`, which lists only the skills a character holds. A ring shows the
 * higher of the stored level and what feats and worn items grant, and steps on from what it
 * shows, so a granted skill never reads lower than its grant makes it. Expertise stepped up
 * from a granted proficiency is stored `onGrant`, and stops counting if the grant goes.
 */
export function CatalogSkills({
  character,
  derived,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
}) {
  const write = useHeldSave(character.id, "Skill proficiency");
  const granted = grantedSkillLevels(derived);
  const stored = (key: string) =>
    character.definition.proficiencies.skills.find((skill) => refKey(skill.ref) === key);
  const shown = (key: string) => heldSkillLevel(stored(key), granted.get(key));
  const rollEffects = derivedValue(derived.rollEffects);
  const skills = [...derived.skills].sort((a, b) => a.ref.name.localeCompare(b.ref.name));

  function cycle(ref: ContentRef) {
    const key = refKey(ref);
    // A feat's expertise steps to none with nothing stored to remove, which changes nothing.
    if (!stored(key) && nextLevel(shown(key)) === "none") return;
    write(key, (latest) => {
      const held = latest.proficiencies.skills;
      const current = held.find((skill) => refKey(skill.ref) === key);
      const grant = granted.get(key);
      const level = nextLevel(heldSkillLevel(current, grant));
      // Expertise over proficiency a feat grants, rather than the player's own, goes with it.
      const ownBelow =
        !current || current.onGrant || current.level === "none" || current.level === "half";
      const onGrant = level === "expertise" && grant !== undefined && ownBelow;
      const others = held.filter((skill) => skill !== current);
      const kept =
        level === "none"
          ? others
          : [...others, { ref, level, ...(onGrant && { onGrant: true as const }) }];
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
            level={shown(key)}
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
