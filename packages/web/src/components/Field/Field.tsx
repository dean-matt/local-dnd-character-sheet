/**
 * The one component every read and edit view renders a value through, so turning
 * editing on later means passing `mode="edit"` rather than rewriting the view.
 *
 * A value is `manual ?? computed` — `packages/character`'s `Derived<T>` shape.
 * Read mode shows that value, marked where `manual` is set. Edit mode commits on a
 * debounce, on blur and on unmount. A derived value writes `manual` only, and clearing the input
 * reverts to `computed` rather than a parsed empty value: `onSave` receives `null`,
 * never a zero or an empty string. A plain `current` value is the definition's own;
 * `EditableFieldProps` says how clearing one saves. The character header reports a save's progress.
 * A failed write outlines the field, keeps the user's text and raises a toast with a retry,
 * so it never looks like it went through. Text the parse or schema refuses is outlined and
 * toasted without a retry, which would only refuse it again.
 *
 * Autosave has no confirm step, so the only way back from a bad edit is undo —
 * which is why undo ships alongside editing rather than waiting for play state.
 */
import { type Derived, derivedValue } from "@dnd/character";
import { OverrideMark } from "../OverrideMark.tsx";
import { EditableField, type EditableFieldProps } from "./EditableField.tsx";

interface ReadFieldProps<T> {
  mode: "read";
  label: string;
  value: Derived<T>;
  format: (value: T) => string;
  /**
   * Keeps `label` for a screen reader while dropping it from the layout — a list row
   * whose surrounding context already says what the value is.
   */
  labelHidden?: boolean;
}

export type FieldProps<T> = ReadFieldProps<T> | EditableFieldProps<T>;

export function Field<T>(props: FieldProps<T>) {
  if (props.mode === "edit") return <EditableField {...props} />;
  const current = derivedValue(props.value);
  const override =
    props.value.manual === null ? null : (
      <OverrideMark computed={props.format(props.value.computed)} />
    );
  if (props.labelHidden) {
    return (
      <span className="font-medium">
        <span className="sr-only">{props.label}</span>
        {props.format(current)}
        {override}
      </span>
    );
  }
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted text-row">{props.label}</span>
      <span className="font-medium">
        {props.format(current)}
        {override}
      </span>
    </div>
  );
}
