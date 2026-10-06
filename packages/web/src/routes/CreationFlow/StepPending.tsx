import { EmptyNote } from "../../components/EmptyNote.tsx";

/** A step whose choices are not built yet, said plainly rather than drawn as an empty page. */
export function StepPending() {
  return <EmptyNote>This step's choices are not built yet.</EmptyNote>;
}
