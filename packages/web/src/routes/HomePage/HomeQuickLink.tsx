import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";

export interface HomeQuickLinkProps {
  to: string;
  icon: LucideIcon;
  label: string;
  description: string;
}

export function HomeQuickLink({ to, icon: Icon, label, description }: HomeQuickLinkProps) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3.5 rounded-card border border-border bg-surface px-4.5 py-4 hover:bg-subtle"
    >
      <span
        aria-hidden="true"
        className="flex size-10 shrink-0 items-center justify-center rounded-card bg-subtle text-accent-text"
      >
        <Icon size={20} />
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-ink text-title">{label}</span>
        <span className="block text-muted text-row">{description}</span>
      </span>
    </Link>
  );
}
