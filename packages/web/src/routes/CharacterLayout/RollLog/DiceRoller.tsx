import type { rollDice } from "@dnd/dice";
import { type FormEvent, useState } from "react";
import { InputField } from "../../../components/InputField.tsx";
import { useRollAndRecord } from "../../../hooks/useRollAndRecord.ts";

type Roll = ReturnType<typeof rollDice>;

const signed = (value: number) => (value < 0 ? `− ${-value}` : `+ ${value}`);

/**
 * Rolls any notation the dice parser reads, under an optional label, and records it to the
 * character's roll log. The result lists each die, a discarded one struck through, then the
 * modifier and the total; the roll log announces a recorded roll, and this form one it could not record.
 */
export function DiceRoller({ characterId }: { characterId: string }) {
  const { roll } = useRollAndRecord(characterId);
  const [notation, setNotation] = useState("");
  const [label, setLabel] = useState("");
  const [refused, setRefused] = useState("");
  const [result, setResult] = useState<{ rolled: Roll; label: string; logged: boolean } | null>(
    null,
  );
  const [messages, setMessages] = useState<HTMLDivElement | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (notation.trim() === "") return;
    setResult(null);
    const named = label.trim() || "Dice roll";
    const error = roll(notation, named, "dice", (rolled, logged) =>
      setResult({ rolled, label: named, logged }),
    );
    setRefused(error?.message ?? "");
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-1.5">
      <div className="flex items-start gap-1.5">
        <InputField
          label="Dice"
          placeholder="2d8+3"
          value={notation}
          onChange={(event) => {
            setNotation(event.target.value);
            setRefused("");
          }}
          error={refused}
          messageSlot={{ into: messages }}
          autoComplete="off"
          spellCheck={false}
          className="w-24 text-row"
        />
        <InputField
          label="Label (optional)"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          autoComplete="off"
          className="w-full min-w-0 text-row"
        />
        <button
          type="submit"
          disabled={notation.trim() === ""}
          className="mt-6 rounded-control bg-accent px-3 py-1 font-semibold text-row text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-subtle disabled:text-muted"
        >
          Roll
        </button>
      </div>
      {/* Below the row, so a refusal neither widens the Dice field nor narrows the Label. */}
      <div ref={setMessages} className="-mt-1.5 flex flex-col" />
      {result && (
        <p className="flex flex-wrap items-baseline gap-1 text-row">
          <span className="text-muted">{result.rolled.notation}:</span>
          {result.rolled.dice.map((die, index) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: a roll's dice never reorder.
              key={index}
              className={`rounded-control border border-border px-1.5 ${die.kept ? "" : "text-muted line-through"}`}
              title={`d${die.faces}${die.kept ? "" : ", discarded"}`}
            >
              {die.sign < 0 && "−"}
              {die.value}
            </span>
          ))}
          {result.rolled.modifier !== 0 && <span>{signed(result.rolled.modifier)}</span>}
          <span>
            = <strong className="text-title">{result.rolled.total}</strong>
          </span>
          {!result.logged && <span className="text-error">not logged</span>}
        </p>
      )}
      <p role="status" className="sr-only">
        {result && !result.logged
          ? `Rolled ${result.label}: ${result.rolled.total}, not logged`
          : ""}
      </p>
    </form>
  );
}
