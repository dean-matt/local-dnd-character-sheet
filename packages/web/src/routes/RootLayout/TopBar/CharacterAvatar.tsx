import { avatarColor } from "../../../lib/avatarColor.ts";

export function CharacterAvatar({ id, name }: { id: string; name: string }) {
  return (
    <span
      className="flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
      style={{ background: avatarColor(id) }}
      aria-hidden
    >
      {name.charAt(0)}
    </span>
  );
}
