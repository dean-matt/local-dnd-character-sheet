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
  if (theme === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }

  try {
    if (theme === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, theme);
    }
  } catch {
    // Storage can throw in private mode or with blocked site data. The
    // document attribute is set above regardless, so the theme still
    // applies for this session — it just doesn't survive a reload.
  }
}
