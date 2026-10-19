import type { CharacterRecord } from "@dnd/character";
import { useState } from "react";
import { apiUrl } from "../lib/api.ts";
import { avatarColor } from "../lib/avatarColor.ts";

/**
 * A character's avatar: the uploaded portrait where one is set, otherwise the first letter
 * of the name on a color derived from the id. Decorative, since the name always sits beside
 * it. `className` sets the size and the letter's type.
 */
export function CharacterPortrait({
  character,
  className,
}: {
  character: Pick<CharacterRecord, "id" | "name" | "portraitUpdatedAt">;
  className: string;
}) {
  const version = character.portraitUpdatedAt;
  // Keyed on the version, so a newer upload gets its try after an older one failed to load.
  const [failed, setFailed] = useState<string | null>(null);
  const shape = `flex shrink-0 items-center justify-center rounded-full ${className}`;

  if (version && failed !== version) {
    return (
      <img
        aria-hidden="true"
        alt=""
        src={apiUrl(`/characters/${character.id}/portrait?v=${encodeURIComponent(version)}`)}
        onError={() => setFailed(version)}
        className={`${shape} object-cover`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${shape} font-semibold text-white`}
      style={{ background: avatarColor(character.id) }}
    >
      {[...character.name][0]?.toUpperCase()}
    </span>
  );
}
