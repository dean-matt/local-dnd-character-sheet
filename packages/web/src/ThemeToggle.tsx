import { useCallback, useState } from "react";
import { getStoredTheme, setStoredTheme, type ThemePreference } from "./theme.ts";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePreference>(getStoredTheme);

  const choose = useCallback((value: ThemePreference) => {
    setStoredTheme(value);
    setTheme(value);
  }, []);

  return (
    <fieldset className="flex items-center gap-2 border-0 p-0">
      <legend className="text-muted text-row uppercase tracking-wide">Theme</legend>
      <div className="flex gap-1 rounded-full border border-border bg-surface p-1">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={theme === option.value}
            onClick={() => choose(option.value)}
            className="rounded-full px-3 py-1 text-row aria-pressed:bg-accent aria-pressed:text-white"
          >
            {option.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
