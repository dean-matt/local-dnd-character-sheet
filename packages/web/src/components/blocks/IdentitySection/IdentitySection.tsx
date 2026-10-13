/**
 * The Identity page: the name, alignment and appearance edit in place and save themselves; race,
 * class, background and the proficiency lists are catalog picks and stay read-only here. It
 * shows as unavailable until the character loads, as the Level and Notes pages beside it do.
 */
import {
  type CharacterRecord,
  characterDefinitionSchema,
  displayName,
  raceSummary,
  totalLevel,
} from "@dnd/character";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { Card } from "../../Card.tsx";
import { ChipList } from "../../ChipList.tsx";
import { Field } from "../../Field/Field.tsx";
import { classChips } from "../classChips.ts";
import { SectionUnavailable } from "../SectionUnavailable.tsx";
import { AlignmentCard } from "./AlignmentCard.tsx";
import { AppearanceCard } from "./AppearanceCard.tsx";
import { ProficiencyGroup } from "./ProficiencyGroup.tsx";

/** A tool held at `none` grants nothing, so it earns no chip. */
const TOOL_SUFFIX = { none: undefined, half: " (half)", proficient: "", expertise: " (expertise)" };

export function IdentitySection({ character }: { character: CharacterRecord | undefined }) {
  const update = useUpdateCharacterDefinition(character?.id ?? "");
  if (!character) return <SectionUnavailable page="Identity" />;
  const { definition } = character;
  const { background, proficiencies } = definition;
  const tools = proficiencies.tools.flatMap(({ name, level }) => {
    const suffix = TOOL_SUFFIX[level];
    return suffix === undefined ? [] : [`${name}${suffix}`];
  });
  return (
    // Proficiencies spans two rows at lg so Appearance, two columns wide, rises beside it
    // rather than under its full height.
    <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Card title="Name">
        <Field
          mode="edit"
          label="Name"
          labelHidden
          current={definition.name}
          format={(name) => name}
          parse={(raw) => raw.trim()}
          schema={characterDefinitionSchema.shape.name}
          onSave={async (name: string) => {
            await update.mutateAsync((latest) => ({ ...latest, name }));
          }}
        />
      </Card>
      <Card title="Race">
        <ChipList labels={[raceSummary(definition)]} />
      </Card>
      <Card title="Class">
        <div className="flex flex-col gap-1">
          <ChipList labels={classChips(definition)} />
          <p className="text-label text-muted">Total level: {totalLevel(definition)}</p>
        </div>
      </Card>
      <Card title="Background">
        <ChipList labels={[displayName(background)]} />
      </Card>
      <AlignmentCard character={character} />
      <Card title="Languages">
        <ChipList labels={proficiencies.languages.map((ref) => ref.name)} empty="No languages." />
      </Card>
      <div className="lg:row-span-2">
        <Card title="Proficiencies">
          {/* Armor and weapons are categories, and `Light` names one of each, so each keeps a heading. */}
          <div className="flex flex-col gap-2">
            <ProficiencyGroup heading="Armor">
              <ChipList labels={proficiencies.armor} empty="No armor." />
            </ProficiencyGroup>
            <ProficiencyGroup heading="Weapons">
              <ChipList labels={proficiencies.weapons} empty="No weapons." />
            </ProficiencyGroup>
            <ProficiencyGroup heading="Tools">
              <ChipList labels={tools} empty="No tools." />
            </ProficiencyGroup>
          </div>
        </Card>
      </div>
      <div className="lg:col-span-2">
        <AppearanceCard
          appearance={definition.appearance}
          onSave={async (edit) => {
            await update.mutateAsync((latest) => ({
              ...latest,
              appearance: edit(latest.appearance),
            }));
          }}
        />
      </div>
    </div>
  );
}
