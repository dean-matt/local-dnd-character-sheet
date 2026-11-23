import { type ContentRef, type Mechanic, mechanicListSchema } from "@dnd/character";
import { useState } from "react";
import { useHomebrewFeatureEffect } from "../../../hooks/useHomebrewFeatureEffect.ts";
import { FormField } from "../../FormField.tsx";

const BUTTON =
  "min-h-11 rounded-control px-3.5 font-semibold text-row hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:text-muted";

/** The first problem with `text` as a mechanic list, or the list itself. */
function parseMechanics(text: string): { error: string } | { mechanics: Mechanic[] } {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { error: "Not valid JSON." };
  }
  const parsed = mechanicListSchema.safeParse(value);
  if (parsed.success) return { mechanics: parsed.data };
  const [issue] = parsed.error.issues;
  return { error: [issue?.path.join("."), issue?.message].filter(Boolean).join(": ") };
}

/** Creates, edits and deletes the homebrew effect a table rules for a catalog feature, as JSON. */
export function FeatureHomebrewEffect({ feature }: { feature: ContentRef }) {
  const { effect, loading, save, remove } = useHomebrewFeatureEffect(feature);
  const [draft, setDraft] = useState<string>();
  const [problem, setProblem] = useState<string>();
  if (loading) return null;
  const text = draft ?? (effect ? JSON.stringify(effect.mechanics, null, 2) : "");
  const busy = save.isPending || remove.isPending;
  const failure = problem ?? (save.error ?? remove.error)?.message;

  function submit() {
    const result = parseMechanics(text);
    if ("error" in result) return setProblem(result.error);
    setProblem(undefined);
    save.mutate(
      { name: feature.name, source: feature.source, mechanics: result.mechanics },
      { onSuccess: () => setDraft(undefined) },
    );
  }

  return (
    <section className="mt-3 flex flex-col gap-2">
      <h3 className="font-semibold text-label text-muted uppercase tracking-label">
        Homebrew effect
      </h3>
      <FormField label="Mechanics (JSON)" error={failure}>
        {(control) => (
          <textarea
            {...control}
            value={text}
            rows={8}
            spellCheck={false}
            onChange={(event) => setDraft(event.target.value)}
            className="resize-y rounded-control border border-border bg-surface px-2 py-1 font-mono text-row aria-invalid:border-error"
          />
        )}
      </FormField>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-disabled={busy}
          onClick={() => !busy && submit()}
          className={BUTTON}
        >
          Save effect
        </button>
        {effect && (
          <button
            type="button"
            aria-disabled={busy}
            onClick={() =>
              !busy && remove.mutate(effect.id, { onSuccess: () => setDraft(undefined) })
            }
            className={BUTTON}
          >
            Delete effect
          </button>
        )}
      </div>
    </section>
  );
}
