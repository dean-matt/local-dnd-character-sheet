import type { ReactNode } from "react";

function StateCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-surface p-4 text-muted text-row">
      {children}
    </div>
  );
}

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

export function ErrorState({ message = "Something went wrong." }: { message?: string }) {
  return (
    <StateCard>
      <p role="alert">{message}</p>
    </StateCard>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <StateCard>{children}</StateCard>;
}
