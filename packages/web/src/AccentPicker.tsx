import { useId, useState } from "react";
import { ACCENT_PRESETS, deriveAccent, getStoredAccent, setStoredAccent } from "./accent.ts";

export function AccentPicker() {
  const [accent, setAccent] = useState(getStoredAccent);
  const [custom, setCustom] = useState(accent);
  const [refusal, setRefusal] = useState<string>();
  const inputId = useId();
  const refusalId = useId();

  const choose = (color: string) => {
    const normalized = color.toLowerCase();
    setCustom(normalized);
    const result = deriveAccent(normalized);
    if ("refusal" in result) {
      setRefusal(result.refusal);
      return;
    }
    setRefusal(undefined);
    setStoredAccent(result.accent);
    setAccent(normalized);
  };

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-2.5 p-0 font-semibold text-label text-muted uppercase tracking-label">
        Accent color
      </legend>
      <div className="flex items-center gap-2">
        {ACCENT_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            aria-label={`${preset.name} accent`}
            title={preset.name}
            aria-pressed={accent === preset.color}
            onClick={() => choose(preset.color)}
            style={{ backgroundColor: preset.color }}
            className="size-6.5 rounded-full border-2 border-border aria-pressed:border-ink"
          />
        ))}
        <label htmlFor={inputId} className="sr-only">
          Custom accent color
        </label>
        <input
          id={inputId}
          type="color"
          value={custom}
          title="Custom color"
          aria-invalid={refusal !== undefined}
          aria-describedby={refusalId}
          onChange={(event) => choose(event.target.value)}
          className="size-6.5 cursor-pointer rounded-full border border-border bg-transparent p-0"
        />
      </div>
      <p id={refusalId} role="status" className="mt-1.5 text-label text-muted empty:hidden">
        {refusal}
      </p>
    </fieldset>
  );
}
