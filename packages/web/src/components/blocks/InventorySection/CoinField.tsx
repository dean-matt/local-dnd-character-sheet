import type { CharacterDefinition } from "@dnd/character";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { InputField } from "../../InputField.tsx";
import { SaveFailure } from "../../SaveFailure.tsx";

type Coin = keyof CharacterDefinition["money"];

const NUMBER = String.raw`(?:\d{1,3}(?:,\d{3})+|\d+)`;
const SUM = new RegExp(`^[+-]?${NUMBER}(?:[+-]${NUMBER})*$`);
const TERM = /[+-]?[\d,]+/g;

/** The total a sum such as `20+10` or `-1,000+5` comes to, or null where it is no sum. */
function evaluate(text: string): number | null {
  // Spaces only around a sign, so "1 000" stays refused rather than read as 1000.
  const sum = text.trim().replace(/\s*([+-])\s*/g, "$1");
  if (!SUM.test(sum)) return null;
  let total = 0;
  for (const [term] of sum.matchAll(TERM)) {
    const amount = Number(term.replaceAll(",", ""));
    if (!Number.isSafeInteger(amount)) return null;
    total += amount;
  }
  return Number.isSafeInteger(total) ? total : null;
}

/**
 * One coin's total, which takes a number or a sum such as `20+10`, and may go below zero
 * for a debt. Enter or leaving the field applies it.
 */
export function CoinField({
  characterId,
  coin,
  name,
  abbreviation,
  total,
  hint,
  hintId,
  messages,
}: {
  characterId: string;
  coin: Coin;
  name: string;
  abbreviation: string;
  total: number;
  /** The card's hint, which a malformed entry is refused with. */
  hint: string;
  /** The element holding the hint, which describes the field. */
  hintId: string;
  messages: Element | null;
}) {
  const update = useUpdateCharacterDefinition(characterId);
  const [draft, setDraft] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [sent, setSent] = useState(total);
  // The cache updates only once a write settles, so a field showing the old total meanwhile
  // would have the next sum appended to it and overwrite the write still saving.
  const shown = (update.isPending ? sent : total).toLocaleString("en-US");

  function apply(next: number) {
    setSent(next);
    update.mutate((latest) => ({ ...latest, money: { ...latest.money, [coin]: next } }));
  }

  function commit() {
    if (draft === null) return;
    const next = evaluate(draft);
    if (next === null) {
      setRefusal(hint);
      return;
    }
    setRefusal(null);
    setDraft(null);
    // The rendered total lags a write in flight, so only a settled one proves a total unchanged.
    if (next !== total || update.isPending) apply(next);
  }

  // A field can unmount while focused, with no blur to commit its draft; committing it
  // here keeps the edit rather than dropping it. A refused entry drops silently, which
  // leaves the total as it was.
  const flush = useRef(commit);
  useEffect(() => {
    flush.current = commit;
  });
  useEffect(() => () => flush.current(), []);

  function submit(event: FormEvent) {
    event.preventDefault();
    commit();
  }

  return (
    <form noValidate onSubmit={submit}>
      <InputField
        label={`${name} (${abbreviation})`}
        // A refusal already repeats the hint.
        describedBy={refusal ? undefined : hintId}
        type="text"
        enterKeyHint="done"
        value={draft ?? shown}
        // Typing appends to the total, the way a player writes 20+10 over 20.
        onFocus={(event) => {
          const end = event.currentTarget.value.length;
          event.currentTarget.setSelectionRange(end, end);
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          setRefusal(null);
        }}
        onBlur={commit}
        messageSlot={{ into: messages, name }}
        status={update.isPending ? "Saving…" : null}
        error={
          refusal ??
          (update.isError && (
            <SaveFailure
              message={`Couldn't save ${sent.toLocaleString("en-US")} ${abbreviation}: ${update.error.message}`}
              onRetry={() => apply(sent)}
            />
          ))
        }
        className="w-[70px]"
      />
    </form>
  );
}
