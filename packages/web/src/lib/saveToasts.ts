/**
 * The save problems the sheet is showing as toasts, one per field, and the viewports that
 * can show them. A store outside React, so a field raises its toast without a provider
 * above it and every viewport reads the same list.
 *
 * Only the viewport registered last draws the list: a modal dialog makes the page behind it
 * inert, so a toast drawn there could not be reached or retried while the modal is open.
 * Each toast remembers the viewport that was drawing when it was raised, and only that
 * viewport announces it, so a modal opening or closing moves a toast without reading it out
 * again.
 */
export interface SaveToast {
  /** One per field, so a field's next problem replaces its last. */
  id: string;
  /** Names the field, such as `Gold`. */
  field: string;
  message: string;
  /** Present for a write that did not land, which a retry can; absent for refused text. */
  retry?: () => void;
}

interface ShownToast extends SaveToast {
  /** The viewport drawing when the toast was raised, the one that announces it. */
  raisedIn?: string;
}

interface State {
  toasts: ShownToast[];
  viewports: string[];
}

let state: State = { toasts: [], viewports: [] };
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  for (const listener of listeners) listener();
}

export function subscribeSaveToasts(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const saveToastState = () => state;

export function raiseSaveToast(toast: SaveToast) {
  const at = state.toasts.findIndex((each) => each.id === toast.id);
  const was = state.toasts[at];
  // A field raises its text again on unmount, as its modal closes; that is no new problem.
  const raisedIn =
    was && was.field === toast.field && was.message === toast.message
      ? was.raisedIn
      : state.viewports.at(-1);
  const shown = { ...toast, raisedIn };
  const toasts =
    at < 0 ? [...state.toasts, shown] : state.toasts.map((each, i) => (i === at ? shown : each));
  set({ ...state, toasts });
}

export function dropSaveToast(id: string) {
  if (!state.toasts.some((each) => each.id === id)) return;
  set({ ...state, toasts: state.toasts.filter((each) => each.id !== id) });
}

/** Empties the store between tests, where a failed write's toast outlives its field. */
export function clearSaveToasts() {
  set({ ...state, toasts: [] });
}

export function openSaveToastViewport(id: string) {
  // A toast raised before any viewport opened has not been announced yet.
  const toasts = state.toasts.map((each) =>
    each.raisedIn === undefined ? { ...each, raisedIn: id } : each,
  );
  set({ toasts, viewports: [...state.viewports, id] });
  // Every toast showing has been announced by now. Homed to the closing viewport, which no
  // open one matches, they move to the exposed viewport's quiet list instead of its live region.
  return () =>
    set({
      toasts: state.toasts.map((each) => ({ ...each, raisedIn: id })),
      viewports: state.viewports.filter((each) => each !== id),
    });
}
