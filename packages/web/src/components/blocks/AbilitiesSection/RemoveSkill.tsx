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
      className="shrink-0 rounded-control bg-accent px-3.5 py-2 font-semibold text-row text-white hover:bg-accent-hover"
    >
      Remove {props.name}
    </button>
  );
}
