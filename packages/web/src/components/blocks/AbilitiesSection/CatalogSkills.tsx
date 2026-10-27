import { HOMEBREW_SOURCE } from "@dnd/catalog";
import {
  type CharacterDerived,
  type CharacterRecord,
  type ContentRef,
  derivedValue,
  effectsOnRoll,
  flatSkillBonusSchema,
  grantedSkillLevels,
  heldSkillLevel,
  overrideKey,
  refKey,
} from "@dnd/character";
import { useEffect, useState } from "react";
import { useHeldSave } from "../../../hooks/useHeldSave.ts";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { Field } from "../../Field/Field.tsx";
import { ProficiencyRow } from "./ProficiencyRow.tsx";
import { nextLevel } from "./proficiencyMark.ts";
import { RemoveSkill } from "./RemoveSkill.tsx";

/** A signed run of digits, with an optional `.0`; `Number` alone would also take `1e3` and `0x10`. */
const wholeNumber = (raw: string) =>
  /^[+-]?\d+(\.0+)?$/.test(raw.trim()) ? Number(raw.trim()) : Number.NaN;

/**
 * The edition's skills, alphabetically, each ring stepping its skill's proficiency and
 * saving it at once as an undo entry. A skill stepped to none leaves
 * `proficiencies.skills`, which lists only the skills a character holds. A ring shows the
 * higher of the stored level and what feats and worn items grant, and steps on from what it
 * shows, so a granted skill never reads lower than its grant makes it. Expertise stepped up
 * from a granted proficiency is stored `onGrant`, and stops counting if the grant goes.
 * A homebrew skill is listed only while the character holds it, so stepping it to none keeps
 * it; its row removes it instead. A flat one also edits its number there. `onRemoved` runs once
 * a removed skill's row is gone, since until then its modal holds the page inert.
 */
export function CatalogSkills({
  character,
  derived,
  onRemoved,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
  onRemoved: (name: string) => void;
}) {
  const write = useHeldSave(character.id, "Skill proficiency");
  // A flat number saves through its own field, which reports its own failure.
  const flats = useUpdateCharacterDefinition(character.id);
  const [removed, setRemoved] = useState<ContentRef>();
  const granted = grantedSkillLevels(derived);
  const stored = (key: string) =>
    character.definition.proficiencies.skills.find((skill) => refKey(skill.ref) === key);
  const shown = (key: string) => heldSkillLevel(stored(key), granted.get(key));
  const rollEffects = derivedValue(derived.rollEffects);
  const skills = derived.skills
    .filter((skill) => skill.ref.source !== HOMEBREW_SOURCE || stored(refKey(skill.ref)))
    .sort((a, b) => a.ref.name.localeCompare(b.ref.name));

  useEffect(() => {
    if (removed === undefined || stored(refKey(removed))) return;
    setRemoved(undefined);
    onRemoved(removed.name);
  });

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
        level === "none" && ref.source !== HOMEBREW_SOURCE
          ? others
          : [
              ...others,
              {
                ref,
                level,
                ...(current?.flat !== undefined && { flat: current.flat }),
                ...(onGrant && { onGrant: true as const }),
              },
            ];
      return { ...latest, proficiencies: { ...latest.proficiencies, skills: kept } };
    });
  }

  return (
    <ul className="grid gap-x-5 gap-y-0.5 sm:grid-cols-2">
      {skills.map((skill) => {
        const key = refKey(skill.ref);
        const homebrew = skill.ref.source === HOMEBREW_SOURCE;
        return (
          <ProficiencyRow
            key={key}
            level={shown(key)}
            name={skill.ref.name}
            ability={skill.ability ?? "flat"}
            modifier={skill.modifier}
            overrideKey={`${overrideKey("skills", skill, character.definition)}.modifier`}
            title={skill.ref.name}
            rules={
              homebrew
                ? undefined
                : { tag: "skill", name: skill.ref.name, source: skill.ref.source }
            }
            effects={effectsOnRoll(rollEffects, {
              roll: "skill",
              skill: skill.ref.name,
              ability: skill.ability,
            })}
            onCycleLevel={() => cycle(skill.ref)}
            detailFooter={
              homebrew && (
                <div className="flex flex-1 items-start justify-end gap-3">
                  {skill.ability === null && (
                    <div className="me-auto flex items-baseline gap-2">
                      <span aria-hidden="true" className="text-muted text-row">
                        Flat bonus
                      </span>
                      <Field
                        mode="edit"
                        label={`${skill.ref.name} flat bonus`}
                        labelHidden
                        inputClassName="w-12 text-right"
                        current={stored(key)?.flat ?? 0}
                        format={String}
                        parse={wholeNumber}
                        schema={flatSkillBonusSchema}
                        onSave={async (flat: number) => {
                          await flats.mutateAsync((latest) => ({
                            ...latest,
                            proficiencies: {
                              ...latest.proficiencies,
                              skills: latest.proficiencies.skills.map((each) =>
                                refKey(each.ref) === key ? { ...each, flat } : each,
                              ),
                            },
                          }));
                        }}
                      />
                    </div>
                  )}
                  <RemoveSkill
                    characterId={character.id}
                    name={skill.ref.name}
                    overridePrefix={`skills.${key}.`}
                    without={(latest) => ({
                      ...latest,
                      proficiencies: {
                        ...latest.proficiencies,
                        skills: latest.proficiencies.skills.filter(
                          (each) => refKey(each.ref) !== key,
                        ),
                      },
                    })}
                    onRemoved={() => setRemoved(skill.ref)}
                  />
                </div>
              )
            }
          />
        );
      })}
    </ul>
  );
}
