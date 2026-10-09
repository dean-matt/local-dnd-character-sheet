import type { CharacterDefinition } from "@dnd/character";
import { type FormEvent, useState } from "react";
import { useUpdateCharacterDefinition } from "../../../hooks/useUpdateCharacterDefinition.ts";
import { InputField } from "../../InputField.tsx";
import { SaveFailure } from "../../SaveFailure.tsx";

type Coin = keyof CharacterDefinition["money"];

const SIGNED = /^[+-]?\d[\d,]*$/;

/**
 * A field that adds a signed amount to one coin's total, or takes from it. Enter applies
 * it; a subtraction past the total is refused here, before any write.
 */
export function CoinAdjustment({
  characterId,
  coin,
  name,
  abbreviation,
  total,
  messages,
}: {
  characterId: string;
  coin: Coin;
  name: string;
  abbreviation: string;
  total: number;
  messages: Element | null;
}) {
  const update = useUpdateCharacterDefinition(characterId);
  const [draft, setDraft] = useState("");
  const [refusal, setRefusal] = useState<string | null>(null);
  const [sent, setSent] = useState(0);
  const coins = (amount: number) => `${amount.toLocaleString("en-US")} ${abbreviation}`;

  function apply(delta: number) {
    setSent(delta);
    update.mutate((latest) => ({
      ...latest,
      money: { ...latest.money, [coin]: latest.money[coin] + delta },
    }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    const delta = Number(text.replaceAll(",", ""));
    if (!SIGNED.test(text) || !Number.isSafeInteger(delta) || delta === 0) {
      setRefusal("Enter an amount such as +25 or -37.");
      return;
    }
    if (total + delta < 0) {
      setRefusal(`Short by ${coins(-delta - total)}; the total stays ${coins(total)}.`);
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
        }}
        messageSlot={{ into: messages, name }}
        status={update.isPending ? "Saving…" : null}
        error={
          refusal ??
          (update.isError && (
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
