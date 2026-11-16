import {
  type CharacterDerived,
  type CharacterRecord,
  type CharacterState,
  hitPointsWithin,
  modifierKey,
} from "@dnd/character";
import { X } from "lucide-react";
import { useAnnouncedStateWrite } from "../../../../../hooks/useAnnouncedStateWrite.ts";
import { PILL } from "../../../../../lib/chipStyles.ts";
import { targetLabel } from "../../../../../lib/modifierTarget.ts";
import { Announcer } from "../../../../Announcer.tsx";
import { Card } from "../../../../Card.tsx";
import { EmptyNote } from "../../../../EmptyNote.tsx";
import { signed } from "../../../signed.ts";
import { AddTemporaryModifier } from "./AddTemporaryModifier.tsx";

const LASTS = { short: "until a rest", long: "until a long rest" } as const;

/**
 * The Temporary Modifiers card: a chip per held modifier, naming it, the value it moves and
 * its amount, with a remove control, and the fields that add one. Each add or removal is one
 * state write, announced once it lands. The derived block shows each as its own term in the
 * value's breakdown.
 */
export function TemporaryModifiers({
  character,
  derived,
  state,
}: {
  character: CharacterRecord;
  derived: Pick<CharacterDerived, "skills" | "hitPointMaximum">;
  state: CharacterState;
}) {
  const replace = useAnnouncedStateWrite(character.id);
  const held = state.temporaryModifiers;

  return (
    <Card title="Temporary Modifiers">
      {held.length === 0 ? (
        <EmptyNote>No temporary modifiers.</EmptyNote>
      ) : (
        <ul className="flex flex-wrap gap-1">
          {held.map((modifier) => {
            const { name, amount, target, endsOn } = modifier;
            const text = `${name} ${signed(amount)} ${targetLabel(target)}`;
            return (
              <li key={modifierKey(modifier)} className={`${PILL} flex items-center gap-1`}>
                {text}
                {endsOn && <span className="text-muted">{LASTS[endsOn]}</span>}
                <button
                  type="button"
                  aria-label={`Remove ${text}`}
                  aria-disabled={replace.writing}
                  onClick={() =>
                    replace.write(
                      hitPointsWithin(character.definition, derived, {
                        ...state,
                        temporaryModifiers: held.filter((other) => other !== modifier),
                      }),
                      `${text} removed`,
                    )
                  }
                  className="text-muted hover:text-ink"
                >
                  <X size={12} aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <AddTemporaryModifier
        skills={derived.skills.map(({ ref }) => ref)}
        held={held}
        busy={replace.writing}
        onAdd={(modifier) =>
          replace.write(
            hitPointsWithin(character.definition, derived, {
              ...state,
              temporaryModifiers: [...held, modifier],
            }),
            `${modifier.name} ${signed(modifier.amount)} ${targetLabel(modifier.target)} added`,
          )
        }
      />
      {replace.error && (
        <p role="alert" className="mt-1 text-error text-row">
          Temporary modifiers were not changed: {replace.error.message}
        </p>
      )}
      <Announcer announced={replace.announced} />
    </Card>
  );
}
