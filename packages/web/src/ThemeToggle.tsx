import { useCallback, useId, useState } from "react";
import { getStoredTheme, setStoredTheme, type ThemePreference } from "./theme.ts";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePreference>(getStoredTheme);
  const hintId = useId();

  const choose = useCallback((value: ThemePreference) => {
    setStoredTheme(value);
    setTheme(value);
  }, []);

  return (
    <fieldset aria-describedby={hintId} className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-2.5 p-0 font-semibold text-label text-muted uppercase tracking-label">
        Theme
      </legend>
      <div className="flex gap-1.5 rounded-card bg-subtle p-1">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={theme === option.value}
            onClick={() => choose(option.value)}
            className="flex-1 rounded-control py-1.75 font-semibold text-body text-muted aria-pressed:bg-surface aria-pressed:text-ink"
          >
            {option.label}
          </button>
        ))}
      </div>
      <p id={hintId} className="mt-1.5 text-label text-muted">
        {theme === "system"
          ? "Follows your device’s light/dark setting."
          : "Overrides your device setting."}
      </p>
    </fieldset>
  );
}
