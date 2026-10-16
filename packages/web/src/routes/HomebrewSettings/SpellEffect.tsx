import { MultiSelect } from "../../components/MultiSelect.tsx";
import { DAMAGE_TYPE_NAMES } from "../../lib/defenseVocabulary.ts";
import { HomebrewRulesText } from "./HomebrewRulesText.tsx";
import {
  chosenIn,
  entriesOf,
  type HomebrewFormProps,
  listAt,
  paragraphsOf,
  withChosen,
  withField,
} from "./homebrewEntry.ts";
import { FORM_GRID, TEXT, WHOLE } from "./homebrewGrid.ts";
import { upcastName, upcastSection, upcastText } from "./spellUpcast.ts";

/** A homebrew spell's damage, rules text, and the text for casting it with a higher-level slot. */
export function SpellEffect({ entry, edition, onChange, errorFor }: HomebrewFormProps) {
  const set = (key: string, value: unknown) => onChange(withField(entry, key, value));
  const higher = listAt(entry, "entriesHigherLevel")[0];

  return (
    <div className={FORM_GRID}>
      <div className={TEXT}>
        <MultiSelect
          inForm
          label="Damage types"
          noun="damage types"
          options={DAMAGE_TYPE_NAMES}
          selected={chosenIn(listAt(entry, "damageInflict"))}
          onChange={(chosen) =>
            set("damageInflict", withChosen(listAt(entry, "damageInflict"), chosen))
          }
        />
      </div>
      <div className={WHOLE}>
        <HomebrewRulesText
          label="Rules text"
          text={paragraphsOf(entry.entries)}
          onText={(next) => set("entries", entriesOf(next))}
          error={errorFor("entries")}
        />
      </div>
      <div className={WHOLE}>
        <HomebrewRulesText
          label={entry.level === 0 ? "Cantrip upgrade" : "At higher levels"}
          text={upcastText(entry.entriesHigherLevel)}
          onText={(next) => {
            const paragraphs = entriesOf(next);
            set(
              "entriesHigherLevel",
              paragraphs && [upcastSection(higher, paragraphs, upcastName(edition, entry.level))],
            );
          }}
        />
      </div>
    </div>
  );
}
