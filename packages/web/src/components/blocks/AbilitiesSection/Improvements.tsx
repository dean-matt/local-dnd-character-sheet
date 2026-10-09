import {
  type CharacterRecord,
  type Improvement,
  improvementAt,
  withImprovement,
} from "@dnd/character";
import { useState } from "react";
import { useFeats } from "../../../hooks/useFeats.ts";
import { useImprovementGrants } from "../../../hooks/useImprovementGrants.ts";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { improvementText, isMade } from "../../../lib/improvementChoice.ts";
import { candidateAt } from "../../../lib/improvementFeats.ts";
import { grantTitle, type ImprovementGrant } from "../../../lib/improvementGrants.ts";
import { Card } from "../../Card.tsx";
import { ImprovementField } from "../../ImprovementField.tsx";
import { SaveFailure } from "../../SaveFailure.tsx";

/**
 * Each Ability Score Improvement and Epic Boon the character's classes grant, what was
 * taken there, and the control that changes it, each change saved at once as an undo
 * entry. An improvement nothing was taken at says so, as for a character stored before
 * improvements were recorded.
 */
export function Improvements({ character }: { character: CharacterRecord }) {
  const { definition } = character;
  const { grants } = useImprovementGrants(definition.levels);
  const feats = useFeats(definition.edition);
  const update = useUpdateCharacterDefinition(character.id);
  const [last, setLast] = useState<{ grant: ImprovementGrant; next: Improvement }>();
  if (grants.length === 0) return null;
  const catalog = feats.data?.items ?? [];
  const missing = grants.filter(
    (grant) => !isMade(improvementAt(definition, grant.level), catalog),
  ).length;

  function save(grant: ImprovementGrant, next: Improvement) {
    setLast({ grant, next });
    update.mutate((latest) => ({
      ...latest,
      ...withImprovement(latest, grant.level, grant.cls, next),
    }));
  }

  return (
    <Card title="Ability Score Improvements">
      {feats.isSuccess && missing > 0 && (
        <p className="mb-2 font-semibold text-accent-text text-body">
          {missing === 1 ? "1 improvement is" : `${missing} improvements are`} not chosen yet.
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {grants.map((grant) => {
          const improvement = improvementAt(definition, grant.level);
          return (
            <li key={grant.level} className="flex flex-col gap-1">
              <p className="text-body">
                <span className="font-semibold">{grantTitle(grant)}:</span>{" "}
                {improvement ? improvementText(improvement) || "nothing placed" : "not chosen"}
              </p>
              <ImprovementField
                name={`Level ${grant.level}`}
                improvement={improvement}
                feats={catalog}
                candidate={candidateAt(definition, grant)}
                onChange={(next) => save(grant, next)}
              />
            </li>
          );
        })}
      </ul>
      <p role="status" aria-live="polite" className="mt-1 text-muted text-row empty:mt-0">
        {update.isPending ? "Saving…" : ""}
      </p>
      {update.isError && last && (
        <p role="alert" className="mt-1 flex items-center gap-2 text-error text-row">
          <SaveFailure
            message={`Couldn't save level ${last.grant.level}: ${update.error.message}`}
            onRetry={() => save(last.grant, last.next)}
          />
        </p>
      )}
    </Card>
  );
}
