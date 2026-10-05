/**
 * The one component behind every inline explanation on the sheet: the breakdown
 * behind a derived value, and the catalog reference popover a later change
 * builds on top of it. Both need the same interaction — reachable by pointer,
 * keyboard and touch, dismissible without losing the reader's place — so it
 * lives here rather than in either consumer.
 *
 * Content stays in the DOM right after the trigger rather than portalled, so Tab
 * order runs trigger then content with no focus trap to build or break. On the
 * page it sits absolutely beside the trigger, beneath the pinned chrome and the
 * search panel. Inside a modal it draws in the top layer instead, anchored to the
 * trigger by CSS anchor positioning, so the modal's scrolling body cannot clip it.
 * Nesting stops one level down: a term inside a breakdown may open its own
 * explanation, but a trigger inside *that* renders as plain text. Stacking a third
 * floating layer has no good place to return focus to on close, and nothing here
 * needs more than one level to explain a term.
 */
import {
  createContext,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { InModal } from "./inModalContext.ts";

const MAX_DEPTH = 1;
const HOVER_CLOSE_DELAY_MS = 150;

const DepthContext = createContext(0);

export interface PopoverProps {
  /** The inline text or value that opens the explanation. */
  trigger: ReactNode;
  /** The opened content's accessible name. */
  label: string;
  /** Names the trigger where its content alone (a bare number) says too little. */
  triggerLabel?: string;
  /** For a caller that hands focus back to the trigger, such as after a modal it opened. */
  triggerRef?: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
}

export function Popover({ trigger, label, triggerLabel, triggerRef, children }: PopoverProps) {
  const depth = useContext(DepthContext);
  const inModal = useContext(InModal) !== null;
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
  const anchorName = `--popover${id.replace(/[^\w-]/g, "")}`;
  const contentRef = useRef<HTMLSpanElement>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const ownTriggerRef = useRef<HTMLButtonElement>(null);
  const triggerButton = triggerRef ?? ownTriggerRef;
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Set just before `close()` refocuses the trigger, so the resulting `focus`
  // event does not reopen the popover through `onFocus` below.
  const returningFocus = useRef(false);

  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  // Set here rather than as a prop: jsdom has no showPopover, and hides a `popover` it
  // cannot show. A second run under StrictMode finds it already showing.
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!inModal || !open || !content || typeof content.showPopover !== "function") return;
    if (content.hasAttribute("popover")) return;
    content.setAttribute("popover", "manual");
    content.showPopover();
  }, [inModal, open]);

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
    triggerButton.current?.focus({ preventScroll: true });
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
        ref={triggerButton}
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-controls={open ? contentId : undefined}
        onFocus={handleTriggerFocus}
        onClick={handleActivate}
        style={{ anchorName }}
        className="underline decoration-dotted underline-offset-2 print:no-underline"
      >
        {trigger}
      </button>
      {open && (
        // biome-ignore lint/a11y/useSemanticElements: <fieldset> groups form controls; this groups prose and links.
        <span
          ref={contentRef}
          id={contentId}
          role="group"
          aria-label={label}
          style={
            inModal
              ? {
                  positionAnchor: anchorName,
                  positionArea: "bottom span-right",
                  positionTryFallbacks: "flip-block, flip-inline, flip-block flip-inline",
                  positionVisibility: "anchors-visible",
                }
              : undefined
          }
          className={`${inModal ? "inset-auto m-0" : "absolute top-full left-0 z-10"} mt-1 w-max max-w-xs rounded-card border border-border bg-surface p-2 text-ink text-row shadow-lg`}
        >
          <DepthContext.Provider value={depth + 1}>{children}</DepthContext.Provider>
        </span>
      )}
    </span>
  );
}
