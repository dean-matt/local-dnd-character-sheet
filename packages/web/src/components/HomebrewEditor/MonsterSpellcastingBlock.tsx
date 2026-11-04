import { ABILITIES, ABILITY_LABEL, type CharacterRecord } from "@dnd/character";
import { useRef, useState } from "react";
import { levelLabel } from "../../lib/spellLevel.ts";
import { FormField } from "../FormField.tsx";
import { InputField } from "../InputField.tsx";
import { Select } from "../Select.tsx";
import { HomebrewCheckbox } from "./HomebrewCheckbox.tsx";
import { HomebrewRowRemove } from "./HomebrewRowRemove.tsx";
import { HomebrewRulesText } from "./HomebrewRulesText.tsx";
import { typedInteger } from "./homebrewEntry.ts";
import { ROW_BUTTON } from "./homebrewRows.ts";
import { MonsterSpellList } from "./MonsterSpellList.tsx";
import {
  holdsUnread,
  readSpellcasting,
  reads,
  SPELL_FREQUENCIES,
  type SpellcastingForm,
  type SpellFrequency,
  type SpellFrequencyKey,
  type SpellLevel,
  writeSpellcasting,
} from "./monsterSpellcasting.ts";

export interface MonsterSpellcastingBlockProps {
  /** The block's label, which each control's label starts with: `Spellcasting 1`. */
  label: string;
  /** The block as stored; the form reads it once on mount and writes each change over it. */
  block: Record<string, unknown>;
  edition: CharacterRecord["edition"];
  onBlock: (block: Record<string, unknown>) => void;
  /** The block as a remove button names it: `spellcasting block 1`. */
  name: string;
  onRemove: () => void;
}

type WithId<T> = T & { id: number };
type Form = Omit<SpellcastingForm, "frequencies" | "levels"> & {
  frequencies: WithId<SpellFrequency>[];
  levels: WithId<SpellLevel>[];
};

const ABILITY_OPTIONS = [
  { value: "", label: "None" },
  ...ABILITIES.map((ability) => ({ value: ability, label: ABILITY_LABEL[ability] })),
];

/** Where the stat block lists a block. The form offers the first two, and a stored other one beside them. */
const SHOWN_AS: Record<string, string> = {
  trait: "Trait",
  action: "Action",
  bonus: "Bonus action",
  reaction: "Reaction",
  legendary: "Legendary action",
};

const FREQUENCY_OPTIONS = Object.entries(SPELL_FREQUENCIES).map(([value, label]) => ({
  value,
  label,
}));

const LEVEL_OPTIONS = Array.from({ length: 10 }, (_, level) => ({
  value: String(level),
  label: levelLabel(level),
}));

/** Keys a block may carry that the form neither shows nor changes. */
const UNSHOWN = ["weekly", "yearly", "legendary", "recharge", "chargesItem", "hidden"];

const holdsUnshown = (block: Record<string, unknown>) =>
  UNSHOWN.some((key) => block[key] !== undefined) || holdsUnread(block);

const sub = "flex min-w-0 flex-col gap-2 border-border border-l-2 pl-2";

/**
 * One spellcasting block: its name, ability, where the stat block lists it, its header and
 * footer, and its spells at will, as rituals, by frequency and by level. A frequency or level
 * with no spells yet stays on screen but writes nothing.
 */
export function MonsterSpellcastingBlock({
  label,
  block,
  edition,
  onBlock,
  name,
  onRemove,
}: MonsterSpellcastingBlockProps) {
  const next = useRef(0);
  const [form, setForm] = useState<Form>(() => {
    const read = readSpellcasting(block);
    return {
      ...read,
      frequencies: read.frequencies.map((row) => ({ ...row, id: next.current++ })),
      levels: read.levels.map((row) => ({ ...row, id: next.current++ })),
    };
  });
  const write = (change: Partial<Form>) => {
    const changed = { ...form, ...change };
    setForm(changed);
    onBlock(writeSpellcasting(block, changed));
  };
  const frequency = (index: number, change: Partial<SpellFrequency>) =>
    write({
      frequencies: form.frequencies.map((row, at) => (at === index ? { ...row, ...change } : row)),
    });
  const level = (index: number, change: Partial<SpellLevel>) =>
    write({ levels: form.levels.map((row, at) => (at === index ? { ...row, ...change } : row)) });
  const select = (
    name: string,
    options: { value: string; label: string }[],
    value: string,
    onChange: (next: string) => void,
  ) => (
    <FormField label={name}>
      {(control) => <Select {...control} options={options} value={value} onChange={onChange} />}
    </FormField>
  );
  const asOptions = ["trait", "action", form.displayAs]
    .filter((value, at, all) => all.indexOf(value) === at)
    .map((value) => ({ value, label: SHOWN_AS[value] ?? value }));
  return (
    <>
      <div className="flex items-end gap-2">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 @2xl:grid-cols-4">
          {reads(block, "name") && (
            <div className="col-span-2">
              <InputField
                label={`${label} name`}
                value={form.name}
                placeholder="Spellcasting"
                onChange={(event) => write({ name: event.target.value })}
              />
            </div>
          )}
          {reads(block, "ability") &&
            select(`${label} ability`, ABILITY_OPTIONS, form.ability, (ability) =>
              write({ ability }),
            )}
          {reads(block, "displayAs") &&
            select(`${label} shows as`, asOptions, form.displayAs, (displayAs) =>
              write({ displayAs }),
            )}
        </div>
        <HomebrewRowRemove name={name} onRemove={onRemove} />
      </div>
      <HomebrewRulesText
        label={`${label} header`}
        text={form.header}
        onText={(header) => write({ header })}
        rows={3}
      />
      {reads(block, "will") && (
        <fieldset className={sub}>
          <legend className="mb-1 text-muted text-row">At will</legend>
          <MonsterSpellList
            label={`${label} at will`}
            spells={form.will}
            edition={edition}
            onSpells={(will) => write({ will })}
          />
        </fieldset>
      )}
      {reads(block, "ritual") && (
        <fieldset className={sub}>
          <legend className="mb-1 text-muted text-row">Rituals</legend>
          <MonsterSpellList
            label={`${label} rituals`}
            spells={form.ritual}
            edition={edition}
            onSpells={(ritual) => write({ ritual })}
          />
        </fieldset>
      )}
      {form.frequencies.map((row, index) => {
        const title = `${label} frequency ${index + 1}`;
        return (
          <fieldset key={row.id} className={sub}>
            <legend className="mb-1 text-muted text-row">{title}</legend>
            <div className="flex items-end gap-2">
              {select(`${title} kind`, FREQUENCY_OPTIONS, row.key, (key) =>
                frequency(index, { key: key as SpellFrequencyKey }),
              )}
              <div className="w-24">
                <InputField
                  label={`${title} uses`}
                  type="number"
                  min={1}
                  step={1}
                  value={row.uses ?? ""}
                  onChange={(event) => frequency(index, { uses: typedInteger(event.target.value) })}
                />
              </div>
              <div className="pb-2">
                <HomebrewCheckbox
                  label="Each"
                  name={`${title} each`}
                  checked={row.each}
                  onChange={(each) => frequency(index, { each })}
                />
              </div>
              <HomebrewRowRemove
                name={title}
                onRemove={() =>
                  write({ frequencies: form.frequencies.filter((_, at) => at !== index) })
                }
              />
            </div>
            <MonsterSpellList
              label={title}
              spells={row.spells}
              edition={edition}
              onSpells={(spells) => frequency(index, { spells })}
            />
          </fieldset>
        );
      })}
      {form.levels.map((row, index) => {
        const title = `${label} spell level ${index + 1}`;
        return (
          <fieldset key={row.id} className={sub}>
            <legend className="mb-1 text-muted text-row">{title}</legend>
            <div className="flex items-end gap-2">
              {select(`${title} level`, LEVEL_OPTIONS, String(row.level), (picked) =>
                level(index, { level: Number(picked) }),
              )}
              {row.level > 0 && (
                <div className="w-24">
                  <InputField
                    label={`${title} slots`}
                    type="number"
                    min={0}
                    step={1}
                    value={row.slots ?? ""}
                    onChange={(event) => level(index, { slots: typedInteger(event.target.value) })}
                  />
                </div>
              )}
              <HomebrewRowRemove
                name={title}
                onRemove={() => write({ levels: form.levels.filter((_, at) => at !== index) })}
              />
            </div>
            <MonsterSpellList
              label={title}
              spells={row.spells}
              edition={edition}
              onSpells={(spells) => level(index, { spells })}
            />
          </fieldset>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-label={`Add a frequency to ${label}`}
          onClick={() =>
            write({
              frequencies: [
                ...form.frequencies,
                { key: "daily", uses: 1, each: true, spells: [], id: next.current++ },
              ],
            })
          }
          className={ROW_BUTTON}
        >
          Add a frequency
        </button>
        <button
          type="button"
          aria-label={`Add a spell level to ${label}`}
          onClick={() => {
            const used = new Set(form.levels.map((row) => row.level));
            const free = LEVEL_OPTIONS.findIndex((_, at) => !used.has(at));
            write({
              levels: [
                ...form.levels,
                {
                  level: Math.max(free, 0),
                  slots: undefined,
                  spells: [],
                  stored: {},
                  id: next.current++,
                },
              ],
            });
          }}
          className={ROW_BUTTON}
        >
          Add a spell level
        </button>
      </div>
      <HomebrewRulesText
        label={`${label} footer`}
        text={form.footer}
        onText={(footer) => write({ footer })}
        rows={3}
      />
      {holdsUnshown(block) && (
        <p className="text-muted text-row">
          {label} also holds what the form cannot show, such as spells by week, year, legendary
          action, recharge or an item's charges, a list the stat block hides, or a count or level in
          another shape. Edit those in JSON.
        </p>
      )}
    </>
  );
}
