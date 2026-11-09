import { useState } from "react";

type Result = { amount: number; calculation: string };

/**
 * A die spent in this dialog: it shows the hit points it regained, and its calculation in a
 * tooltip on hover and on focus that Escape dismisses without closing the dialog. The same text
 * names the die for a screen reader.
 */
export function CalculatedDie({ result, className }: { result: Result; className: string }) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const shown = (hover || focus) && !dismissed;
  return (
    <span className="relative">
      <span
        role="img"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: focus is how a keyboard reader reaches the tooltip.
        tabIndex={0}
        aria-label={result.calculation}
        className={`${className} focus-visible:outline-2 focus-visible:outline-offset-2`}
        onMouseEnter={() => {
          setDismissed(false);
          setHover(true);
        }}
        onMouseLeave={() => setHover(false)}
        onFocus={() => {
          setDismissed(false);
          setFocus(true);
        }}
        onBlur={() => setFocus(false)}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !shown) return;
          event.preventDefault();
          event.stopPropagation();
          setDismissed(true);
        }}
      >
        {result.amount}
      </span>
      {shown && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-full left-0 z-10 mb-1 w-max max-w-64 rounded-control bg-ink px-2 py-1 text-canvas text-row"
        >
          {result.calculation}
        </span>
      )}
    </span>
  );
}
