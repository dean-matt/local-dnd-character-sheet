import { AdvantageFields } from "./AdvantageFields.tsx";
import { type HomebrewFormProps, listAt, withField } from "./homebrewEntry.ts";
import { FORM_GRID, WHOLE } from "./homebrewGrid.ts";
import { ItemAbilityFields } from "./ItemAbilityFields.tsx";
import { ItemSenseFields } from "./ItemSenseFields.tsx";
import { ItemSkillFields } from "./ItemSkillFields.tsx";
import { ItemSpeedFields } from "./ItemSpeedFields.tsx";
import { ItemSpellFields } from "./ItemSpellFields.tsx";

/** What a homebrew item does to the wearer's ability scores, speeds, senses, skills, rolls and spells. */
export function ItemEffects({ entry, onChange, errorFor }: HomebrewFormProps) {
  const set = (key: string, value: unknown) => onChange(withField(entry, key, value));
  return (
    <div className={FORM_GRID}>
      <div className={WHOLE}>
        <ItemAbilityFields
          ability={entry.ability}
          onChange={(next) => set("ability", next)}
          error={errorFor("ability")}
        />
      </div>
      <div className={WHOLE}>
        <ItemSpeedFields
          speed={entry.modifySpeed}
          onChange={(next) => set("modifySpeed", next)}
          error={errorFor("modifySpeed")}
        />
      </div>
      <div className={WHOLE}>
        <ItemSenseFields
          senses={listAt(entry, "senses")}
          onChange={(next) => set("senses", next.length > 0 ? next : undefined)}
          error={errorFor("senses")}
        />
      </div>
      <div className={WHOLE}>
        <ItemSkillFields
          proficiencies={entry.skillProficiencies}
          expertise={entry.expertise}
          onChange={set}
        />
      </div>
      <div className={WHOLE}>
        <AdvantageFields
          effects={listAt(entry, "advantage")}
          onChange={(next) => set("advantage", next.length > 0 ? next : undefined)}
          error={errorFor("advantage")}
        />
      </div>
      <div className={WHOLE}>
        {entry.attachedSpells === undefined || Array.isArray(entry.attachedSpells) ? (
          <ItemSpellFields
            spells={listAt(entry, "attachedSpells").filter(
              (spell): spell is string => typeof spell === "string",
            )}
            onChange={(next) => set("attachedSpells", next.length > 0 ? next : undefined)}
            error={errorFor("attachedSpells")}
          />
        ) : (
          <p className="text-muted text-row">
            This item groups its spells by how often they are cast. Edit them in JSON.
          </p>
        )}
      </div>
    </div>
  );
}
