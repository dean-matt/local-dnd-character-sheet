import type { CharacterDefinition } from "@dnd/character";
import { type FormEvent, useState } from "react";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { InputField } from "../../InputField.tsx";
import { SaveFailure } from "../../SaveFailure.tsx";

type Coin = keyof CharacterDefinition["money"];

const SIGNED = /^[+-]?(\d{1,3}(,\d{3})*|\d+)$/;

/** Refuses the edit before its write, so the total stays as it was. */
class Shortfall extends Error {}

/**
 * A field that adds a signed amount to one coin's total, or takes from it. Enter applies
 * it. The shortfall check reads the definition the queued write starts from, not the
 * rendered total, which lags a write still in flight.
 */
export function CoinAdjustment({
  characterId,
  coin,
  name,
  abbreviation,
  messages,
}: {
  characterId: string;
  coin: Coin;
  name: string;
  abbreviation: string;
  messages: Element | null;
}) {
  const update = useUpdateCharacterDefinition(characterId);
  const [draft, setDraft] = useState("");
  const [refusal, setRefusal] = useState<string | null>(null);
  const [sent, setSent] = useState(0);
  const coins = (amount: number) => `${amount.toLocaleString("en-US")} ${abbreviation}`;

  function apply(delta: number) {
    setSent(delta);
    update.mutate((latest) => {
      const held = latest.money[coin];
      if (held + delta < 0)
        throw new Shortfall(`Short by ${coins(-delta - held)}; the total stays ${coins(held)}.`);
      return { ...latest, money: { ...latest.money, [coin]: held + delta } };
    });
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    const delta = Number(text.replaceAll(",", ""));
    if (!SIGNED.test(text) || !Number.isSafeInteger(delta) || delta === 0) {
      setRefusal("Enter an amount such as +25 or -37.");
      return;
    }
    setRefusal(null);
    apply(delta);
    setDraft("");
  }

  return (
    <form noValidate onSubmit={submit}>
      <InputField
        label={`Adjust ${name.toLowerCase()}, negative to remove`}
        labelHidden
        type="text"
        enterKeyHint="done"
        placeholder="±"
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setRefusal(null);
          update.reset();
        }}
        messageSlot={{ into: messages, name }}
        status={update.isPending ? "Saving…" : null}
        error={
          refusal ??
          (update.error instanceof Shortfall
            ? update.error.message
            : update.isError && (
                <SaveFailure
                  message={`Couldn't save ${sent > 0 ? "+" : ""}${coins(sent)}: ${update.error.message}`}
                  onRetry={() => apply(sent)}
                />
              ))
        }
        className="w-[70px]"
      />
    </form>
  );
}
