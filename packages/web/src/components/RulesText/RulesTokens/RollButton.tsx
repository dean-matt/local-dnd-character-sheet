import { useRollAndRecord } from "../../../hooks/useRollAndRecord.ts";

/**
 * Rolls its notation and records the roll; the character layout shows it in the roll log.
 * The status region exists before the first roll so a reader speaks the one failure that
 * has no entry to show: a roll that could not be recorded.
 */
export function RollButton({
  characterId,
  notation,
  display,
}: {
  characterId: string;
  notation: string;
  display: string;
}) {
  const { roll, failed } = useRollAndRecord(characterId);

  return (
    <span data-notation={notation} data-rollable="true">
      <button
        type="button"
        onClick={() => roll(notation, display)}
        aria-label={`Roll ${display}`}
        className="cursor-pointer underline decoration-dotted underline-offset-2"
      >
        {display}
      </button>
      <span role="status" className="text-error empty:hidden">
        {failed && " not logged"}
      </span>
    </span>
  );
}
