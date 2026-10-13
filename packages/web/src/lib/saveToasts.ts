/**
 * The save problems the sheet is showing as toasts, one per field, and the viewports that
 * can show them. A store outside React, so a field raises its toast without a provider
 * above it and every viewport reads the same list.
 *
 * Only the viewport registered last draws the list: a modal dialog makes the page behind it
 * inert, so a toast drawn there could not be reached or retried while the modal is open.
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

interface State {
  toasts: SaveToast[];
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
  const toasts =
    at < 0 ? [...state.toasts, toast] : state.toasts.map((each, i) => (i === at ? toast : each));
  set({ ...state, toasts });
}

export function dropSaveToast(id: string) {
  if (!state.toasts.some((each) => each.id === id)) return;
  set({ ...state, toasts: state.toasts.filter((each) => each.id !== id) });
}

export function openSaveToastViewport(id: string) {
  set({ ...state, viewports: [...state.viewports, id] });
  return () => set({ ...state, viewports: state.viewports.filter((each) => each !== id) });
}
