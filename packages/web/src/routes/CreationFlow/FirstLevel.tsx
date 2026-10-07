import type { HitDie } from "@dnd/character";
import { InputField } from "../../components/InputField.tsx";

const MAXIMUM = "the die's maximum";

/**
 * 1st level takes the die's highest face under every method, so its cell holds the value
 * fixed and says why in visible text, since a hover-only note never reaches a touch screen.
 */
export function FirstLevel({ die, custom }: { die: HitDie; custom: boolean }) {
  return (
    <>
      {custom ? (
        <InputField
          label={`Level 1, ${MAXIMUM}`}
          labelHidden
          type="text"
          readOnly
          value={String(die)}
          className="w-full min-w-0 text-center text-muted"
        />
      ) : (
        <>
          {die}
          <span className="sr-only">, {MAXIMUM}</span>
        </>
      )}
      <span aria-hidden="true" title={MAXIMUM} className="block text-muted text-row">
        max
      </span>
    </>
  );
}
