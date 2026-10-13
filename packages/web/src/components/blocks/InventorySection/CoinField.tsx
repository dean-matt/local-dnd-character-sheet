import type { CharacterDefinition } from "@dnd/character";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { InputField } from "../../InputField.tsx";
import { SaveFailure } from "../../SaveFailure.tsx";

type Coin = keyof CharacterDefinition["money"];

const AMOUNT = /^([+-]?)(\d{1,3}(,\d{3})*|\d+)$/;

/** A total replaces the coin's; a delta adds to it. */
type Change = { total: number } | { delta: number };

/** Refuses the edit before its write, so the total stays as it was. */
class Shortfall extends Error {}

function parse(text: string): Change | null {
  const match = AMOUNT.exec(text.trim());
  if (!match) return null;
  const amount = Number(match[2]?.replaceAll(",", ""));
  if (!Number.isSafeInteger(amount)) return null;
  if (match[1] === "") return { total: amount };
  return { delta: match[1] === "-" ? -amount : amount };
}

/**
 * One coin's total, which takes a new total or a signed amount to add or take. Enter or
 * leaving the field applies it. A signed amount and the shortfall check read the definition
 * the queued write starts from, not the rendered total, which lags a write still in flight.
 */
export function CoinField({
  characterId,
  coin,
  name,
  abbreviation,
  total,
  hint,
  messages,
}: {
  characterId: string;
  coin: Coin;
  name: string;
  abbreviation: string;
  total: number;
  /** The visible hint the card prints, which a malformed entry is refused with. */
  hint: string;
  messages: Element | null;
}) {
  const update = useUpdateCharacterDefinition(characterId);
  const [draft, setDraft] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [sent, setSent] = useState<Change>({ delta: 0 });
  const coins = (amount: number) => `${amount.toLocaleString("en-US")} ${abbreviation}`;
  const shown = total.toLocaleString("en-US");

  function apply(change: Change) {
    setSent(change);
    update.mutate((latest) => {
      const held = latest.money[coin];
      const next = "total" in change ? change.total : held + change.delta;
      if (next < 0)
        throw new Shortfall(`Short by ${coins(-next)}; the total stays ${coins(held)}.`);
      return { ...latest, money: { ...latest.money, [coin]: next } };
    });
  }

  function commit() {
    if (draft === null) return;
    const change = parse(draft);
    if (!change) {
      setRefusal(hint);
      return;
    }
    setRefusal(null);
    setDraft(null);
    // The rendered total lags a write in flight, so only a settled one proves a total unchanged.
    const unchanged =
      "total" in change ? change.total === total && !update.isPending : change.delta === 0;
    if (!unchanged) apply(change);
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

  const described =
    "total" in sent ? coins(sent.total) : `${sent.delta > 0 ? "+" : ""}${coins(sent.delta)}`;

  return (
    <form noValidate onSubmit={submit}>
      <InputField
        label={`${name} (${abbreviation})`}
        aria-label={`${name} (${abbreviation}), a total or a + or - amount`}
        type="text"
        enterKeyHint="done"
        value={draft ?? shown}
        // Typing replaces the total, as both a new total and a signed amount want.
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          setDraft(event.target.value);
          setRefusal(null);
          // Only a shortfall: a reset during a write in flight would detach its Saving
          // status and any failure's Retry.
          if (update.error instanceof Shortfall) update.reset();
        }}
        onBlur={commit}
        messageSlot={{ into: messages, name }}
        status={update.isPending ? "Saving…" : null}
        error={
          refusal ??
          (update.error instanceof Shortfall
            ? update.error.message
            : update.isError && (
                <SaveFailure
                  message={`Couldn't save ${described}: ${update.error.message}`}
                  onRetry={() => apply(sent)}
                />
              ))
        }
        className="w-[70px]"
      />
    </form>
  );
}
