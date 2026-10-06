import { AccentPicker } from "../AccentPicker.tsx";
import { ThemeToggle } from "../ThemeToggle.tsx";

export function DisplaySettings() {
  return (
    <section aria-labelledby="display-settings" className="max-w-sm">
      <h1 id="display-settings" className="sr-only">
        Display
      </h1>
      <div className="flex flex-col gap-4.5 rounded-card border border-border bg-surface p-4">
        <ThemeToggle />
        <AccentPicker />
      </div>
    </section>
  );
}
