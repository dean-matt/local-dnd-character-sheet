import { StateCard } from "./StateCard.tsx";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <StateCard>
      <div
        aria-hidden="true"
        className="mx-auto size-5 animate-spin rounded-full border-2 border-border border-t-muted"
      />
      <p role="status" aria-live="polite" className="sr-only">
        {label}
      </p>
    </StateCard>
  );
}
