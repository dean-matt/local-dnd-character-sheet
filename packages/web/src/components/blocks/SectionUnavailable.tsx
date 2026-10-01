import { EmptyState } from "../../EmptyState.tsx";

export function SectionUnavailable({ page }: { page: string }) {
  return <EmptyState>{page} isn't available yet.</EmptyState>;
}
