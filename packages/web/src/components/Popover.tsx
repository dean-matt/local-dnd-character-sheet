/**
 * The one component behind every inline explanation on the sheet: the breakdown
 * behind a derived value, and the catalog reference popover a later change
 * builds on top of it. Both need the same interaction — reachable by pointer,
 * keyboard and touch, dismissible without losing the reader's place — so it
 * lives here rather than in either consumer.
 *
 * Content stays in normal document flow, positioned absolutely beside the
 * trigger rather than portalled, so Tab order runs trigger then content with no
 * focus trap to build or break. Nesting stops one level down: a term inside a
 * breakdown may open its own explanation, but a trigger inside *that* renders as
 * plain text. Stacking a third floating layer has no good place to return focus
 * to on close, and nothing here needs more than one level to explain a term.
 */
import {
  createContext,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

const MAX_DEPTH = 1;
const HOVER_CLOSE_DELAY_MS = 150;

const DepthContext = createContext(0);

export interface PopoverProps {
  /** The inline text or value that opens the explanation. */
  trigger: ReactNode;
  /** The opened content's accessible name. */
  label: string;
  children: ReactNode;
}

export function Popover({ trigger, label, children }: PopoverProps) {
  const depth = useContext(DepthContext);
  // Hover and focus drive one flag, a click or tap the other, because a real
  // pointer always fires `mouseenter` before `click` — including the tap that
  // opens it on a touchscreen. A shared flag toggled on click would read as
  // already open and instantly close what the same tap had just opened, so a
  // click that finds the popover open only through hover or focus pins it
  // instead of closing it; a click that finds it already pinned is the
  // deliberate second activation, and closes it outright even if the pointer
  // is still hovering.
  const [transientOpen, setTransientOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = transientOpen || pinned;
  const id = useId();
  const contentId = `${id}-content`;
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Set just before `close()` refocuses the trigger, so the resulting `focus`
  // event does not reopen the popover through `onFocus` below.
  const returningFocus = useRef(false);

  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  // A pointer down anywhere outside the trigger and its content closes it —
  // the only way a mouse user dismisses one opened by hover, since it never
  // held focus to begin with.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        clearTimeout(hoverTimer.current);
        setTransientOpen(false);
        setPinned(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  if (depth > MAX_DEPTH) return <>{trigger}</>;

  function show() {
    clearTimeout(hoverTimer.current);
    setTransientOpen(true);
  }

  // Delayed rather than immediate, so a pointer crossing the gap between the
  // trigger and the content it opened does not close it mid-crossing.
  function scheduleHide() {
    hoverTimer.current = setTimeout(() => setTransientOpen(false), HOVER_CLOSE_DELAY_MS);
  }

  function hideNow() {
    clearTimeout(hoverTimer.current);
    setTransientOpen(false);
    setPinned(false);
  }

  function close() {
    hideNow();
    returningFocus.current = true;
    triggerRef.current?.focus({ preventScroll: true });
  }

  function handleTriggerFocus() {
    if (returningFocus.current) {
      returningFocus.current = false;
      return;
    }
    show();
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      close();
    }
  }

  function handleBlur(event: FocusEvent) {
    const next = event.relatedTarget as Node | null;
    if (!next || !wrapperRef.current?.contains(next)) hideNow();
  }

  function handleActivate() {
    if (pinned) hideNow();
    else setPinned(true);
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: an anchor for the real controls inside it, not a widget itself.
    <span
      ref={wrapperRef}
      className="relative inline-block"
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    >
      <button
        type="button"
        ref={triggerRef}
        aria-expanded={open}
        aria-controls={open ? contentId : undefined}
        onFocus={handleTriggerFocus}
        onClick={handleActivate}
        className="underline decoration-dotted underline-offset-2 print:no-underline"
      >
        {trigger}
      </button>
      {open && (
        // biome-ignore lint/a11y/useSemanticElements: <fieldset> groups form controls; this groups prose and links.
        <span
          id={contentId}
          role="group"
          aria-label={label}
          className="absolute top-full left-0 z-10 mt-1 w-max max-w-xs rounded-card border border-border bg-surface p-2 text-row shadow-lg"
        >
          <DepthContext.Provider value={depth + 1}>{children}</DepthContext.Provider>
        </span>
      )}
    </span>
  );
}
