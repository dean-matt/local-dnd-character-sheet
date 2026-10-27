import { type ComponentProps, useContext } from "react";
import { InModal } from "../../inModalContext.ts";
import { ConfirmRemoveSkill } from "./ConfirmRemoveSkill.tsx";

/** The button in a skill's detail that opens the confirmation. */
export function RemoveSkill(props: ComponentProps<typeof ConfirmRemoveSkill>) {
  const modal = useContext(InModal);
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={() => modal?.open(<ConfirmRemoveSkill {...props} />)}
      className="shrink-0 rounded-control border border-error bg-surface px-3.5 py-2 font-semibold text-error text-row hover:bg-subtle"
    >
      Remove {props.name}
    </button>
  );
}
