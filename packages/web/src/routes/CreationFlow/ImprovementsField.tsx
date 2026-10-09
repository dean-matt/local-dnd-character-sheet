import { type CharacterDefinition, improvementAt, withImprovement } from "@dnd/character";
import { useFormContext, useWatch } from "react-hook-form";
import { ImprovementField } from "../../components/ImprovementField.tsx";
import { useFeats } from "../../hooks/useFeats.ts";
import { useImprovementGrants } from "../../hooks/useImprovementGrants.ts";
import { isMade } from "../../lib/improvementChoice.ts";
import { candidateAt } from "../../lib/improvementFeats.ts";
import { grantTitle } from "../../lib/improvementGrants.ts";

const OPTS = { shouldDirty: true } as const;

/**
 * A choice for each Ability Score Improvement and Epic Boon the classes grant by the
 * character's level, each marked until it is made.
 */
export function ImprovementsField() {
  const { setValue, getValues } = useFormContext<CharacterDefinition>();
  const [levels = [], edition = "one", feats = [], abilityIncreases = [], abilityScores = {}] =
    useWatch<
      CharacterDefinition,
      ["levels", "edition", "feats", "abilityIncreases", "abilityScores"]
    >({ name: ["levels", "edition", "feats", "abilityIncreases", "abilityScores"] });
  const { grants } = useImprovementGrants(levels);
  const catalog = useFeats(edition).data?.items ?? [];
  if (grants.length === 0) return null;
  const draft = { edition, levels, feats, abilityIncreases, abilityScores };

  return (
    <section aria-labelledby="ability-improvements" className="flex flex-col gap-3">
      <h2
        id="ability-improvements"
        className="font-semibold text-label text-muted uppercase tracking-label"
      >
        Ability Score Improvements
      </h2>
      {grants.map((grant) => {
        const improvement = improvementAt(draft, grant.level);
        const made = isMade(improvement, catalog);
        return (
          <div key={grant.level} className="flex flex-col gap-1">
            <h3
              className={`text-body ${made ? "font-semibold" : "font-semibold text-accent-text"}`}
            >
              {grantTitle(grant)}
              {!made && " — choose"}
            </h3>
            <ImprovementField
              name={`Level ${grant.level}`}
              improvement={improvement}
              feats={catalog}
              candidate={candidateAt(draft, grant)}
              onChange={(next) => {
                const held = {
                  feats: getValues("feats") ?? [],
                  abilityIncreases: getValues("abilityIncreases") ?? [],
                };
                const after = withImprovement(held, grant.level, grant.cls, next);
                setValue("feats", after.feats, OPTS);
                setValue("abilityIncreases", after.abilityIncreases, OPTS);
              }}
            />
          </div>
        );
      })}
    </section>
  );
}
