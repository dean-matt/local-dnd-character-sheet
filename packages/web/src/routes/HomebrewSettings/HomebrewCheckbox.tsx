import { type ReactNode, useId } from "react";

export interface HomebrewCheckboxProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Marks the box invalid and describes it. */
  error?: ReactNode;
}

/** One checkbox with its label to its right, and its field's problem below. */
export function HomebrewCheckbox({ label, checked, onChange, error }: HomebrewCheckboxProps) {
  const errorId = `${useId()}-error`;
  return (
    <div className="flex flex-col">
      <label className="flex items-center gap-2 text-ink text-row">
        <input
          type="checkbox"
          checked={checked}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.checked)}
        />
        {label}
      </label>
      {error && (
        <span id={errorId} role="alert" className="mt-1 text-error text-row">
          {error}
        </span>
      )}
    </div>
  );
}
