import { Info } from "lucide-react";
import { Link } from "react-router";
import { Popover } from "../Popover.tsx";
import type { ClassDieHold } from "./useClassDieHold.ts";

const LABEL = "Why Save is unavailable";

/** The info button beside an unavailable Save, naming and linking each character that holds the class. */
export function ClassDieHoldNote({ hold: { name, hitDie, characters } }: { hold: ClassDieHold }) {
  return (
    <Popover
      trigger={<Info aria-hidden="true" size={14} className="block text-accent-text" />}
      triggerLabel={LABEL}
      label={LABEL}
    >
      <p>
        {name} is held by {characters.length === 1 ? "this character" : "these characters"}, so its
        hit die stays d{hitDie}. Keep d{hitDie}, or add a class with another name for the new die.
      </p>
      <ul className="mt-1 list-disc pl-5">
        {characters.map(({ id, name: held }) => (
          <li key={id}>
            <Link to={`/characters/${id}`} className="text-accent-text underline">
              {held}
            </Link>
          </li>
        ))}
      </ul>
    </Popover>
  );
}
