/**
 * The Identity page: every card but Class, which level-up owns, edits in place and saves
 * itself. It shows as unavailable until the character loads, as the Level and Notes pages beside it do.
 */
import { type CharacterRecord, characterDefinitionSchema } from "@dnd/character";
import { useHomebrewNames } from "../../../hooks/useHomebrewNames.ts";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { Card } from "../../Card.tsx";
import { ChipList } from "../../ChipList.tsx";
import { Field } from "../../Field/Field.tsx";
import { classChips } from "../classChips.ts";
import { SectionUnavailable } from "../SectionUnavailable.tsx";
import { AlignmentCard } from "./AlignmentCard.tsx";
import { AppearanceCard } from "./AppearanceCard.tsx";
import { BackgroundCard } from "./BackgroundCard.tsx";
import { DeityCard } from "./DeityCard.tsx";
import { LanguagesCard } from "./LanguagesCard.tsx";
import { ProficienciesCard } from "./ProficienciesCard.tsx";
import { RaceCard } from "./RaceCard.tsx";

export function IdentitySection({ character }: { character: CharacterRecord | undefined }) {
  const update = useUpdateCharacterDefinition(character?.id ?? "");
  const names = useHomebrewNames();
  if (!character) return <SectionUnavailable page="Identity" />;
  const { definition } = character;
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
      <RaceCard character={character} />
      <Card title="Class">
        <ChipList labels={classChips(definition, names)} />
      </Card>
      <BackgroundCard character={character} />
      <AlignmentCard character={character} />
      <DeityCard character={character} />
      <LanguagesCard character={character} />
      <div className="lg:row-span-2">
        <ProficienciesCard character={character} />
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
