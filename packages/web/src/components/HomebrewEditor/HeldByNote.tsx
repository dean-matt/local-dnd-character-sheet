import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Popover } from "../Popover.tsx";

interface HeldByNoteProps {
  /** The info button's accessible name and the popover's label. */
  label: string;
  /** The characters holding the row, or `undefined` where they could not be read. */
  holders: readonly { id: string; name: string }[] | undefined;
  /** Shown above the linked holders. */
  message: string;
  /** Shown alone where the holders could not be read. */
  failure: ReactNode;
}

/** An info button whose popover names and links each character holding a homebrew row. */
export function HeldByNote({ label, holders, message, failure }: HeldByNoteProps) {
  return (
    <Popover
      trigger={<Info aria-hidden="true" size={14} className="block text-accent-text" />}
      triggerLabel={label}
      label={label}
    >
      {holders === undefined ? (
        failure
      ) : (
        <>
          <p>{message}</p>
          <ul className="mt-1 columns-3 gap-x-4 list-disc pl-5">
            {holders.map(({ id, name }) => (
              <li key={id}>
                <Link to={`/characters/${id}`} className="text-accent-text underline">
                  {name}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Popover>
  );
}
