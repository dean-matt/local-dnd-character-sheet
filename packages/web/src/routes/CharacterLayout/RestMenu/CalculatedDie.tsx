import { useId, useRef, useState } from "react";
import { useTopLayer } from "../../../hooks/useTopLayer.ts";
import {
  ANCHORED_CLASSES,
  anchoredStyle,
  anchorName as toAnchorName,
} from "../../../lib/anchoring.ts";

type Result = { amount: number; calculation: string };

/**
 * A die spent in this dialog: it shows the hit points it regained, and its calculation in a
 * tooltip on hover and on focus that Escape dismisses without closing the dialog. The tooltip
 * draws in the top layer, anchored above the die, so the dialog neither clips it nor grows to
 * hold it. The same text names the die for a screen reader.
 */
export function CalculatedDie({ result, className }: { result: Result; className: string }) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const shown = (hover || focus) && !dismissed;
  const anchorName = toAnchorName(useId());
  const tooltip = useRef<HTMLSpanElement>(null);
  useTopLayer(tooltip, shown);
  return (
    <>
      <span
        role="img"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: focus is how a keyboard reader reaches the tooltip.
        tabIndex={0}
        aria-label={result.calculation}
        style={{ anchorName }}
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
          ref={tooltip}
          aria-hidden="true"
          style={anchoredStyle(anchorName, "top span-right")}
          className={`${ANCHORED_CLASSES} pointer-events-none mb-1 w-max max-w-64 rounded-control border-0 bg-ink px-2 py-1 text-canvas text-row`}
        >
          {result.calculation}
        </span>
      )}
    </>
  );
}
