export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

function isThemeOverride(value: string | null): value is "light" | "dark" {
  return value === "light" || value === "dark";
}

export function getStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isThemeOverride(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function setStoredTheme(theme: ThemePreference): void {
  try {
    if (theme === "system") {
      localStorage.removeItem(STORAGE_KEY);
      delete document.documentElement.dataset.theme;
    } else {
      localStorage.setItem(STORAGE_KEY, theme);
      document.documentElement.dataset.theme = theme;
    }
  } catch {
    // Storage can throw in private mode or with blocked site data; the
    // preference then doesn't persist across reloads.
  }
}
