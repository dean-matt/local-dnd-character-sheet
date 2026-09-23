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
      <p role="status" aria-live="polite">
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
