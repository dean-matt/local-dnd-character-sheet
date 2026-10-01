/**
 * The one component every read and edit view renders a value through, so turning
 * editing on later means passing `mode="edit"` rather than rewriting the view.
 *
 * A value is `manual ?? computed` — `packages/character`'s `Derived<T>` shape.
 * Read mode shows that value, marked where `manual` is set. Edit mode commits on a
 * debounce and on blur, writes `manual` only, and clearing the input reverts to
 * `computed` rather than a parsed empty value: `onSave` receives `null`, never a
 * zero or an empty string. A save's `saving`, `saved` and `failed` status renders
 * beside the field; `failed` keeps the user's text and offers a retry, so a failed
 * write never looks like it went through.
 *
 * Autosave has no confirm step, so the only way back from a bad edit is undo —
 * which is why undo ships alongside editing rather than waiting for play state.
 */
import { type Derived, derivedValue } from "@dnd/character";
import { EditableField, type EditableFieldProps } from "./EditableField.tsx";
import { OverrideMark } from "./OverrideMark.tsx";

interface ReadFieldProps<T> {
  mode: "read";
  label: string;
  value: Derived<T>;
  format: (value: T) => string;
  /** Keeps `label` for a screen reader while dropping it from the layout — a list row
   * whose surrounding context already says what the value is. */
  labelHidden?: boolean;
}

export type FieldProps<T> = ReadFieldProps<T> | EditableFieldProps<T>;

export function Field<T>(props: FieldProps<T>) {
  const current = derivedValue(props.value);

  if (props.mode === "read") {
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

  return <EditableField {...props} current={current} />;
}
