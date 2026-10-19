import type { CharacterRecord } from "@dnd/character";
import { Camera } from "lucide-react";
import { useRef } from "react";
import { CharacterPortrait } from "../../components/CharacterPortrait.tsx";
import { useSaveToast } from "../../hooks/useSaveToast.ts";
import { useUploadPortrait } from "../../hooks/useUploadPortrait.ts";

/** The header's 32px avatar, with the camera badge that picks an image to upload for it. */
export function PortraitUpload({ character }: { character: CharacterRecord }) {
  const picker = useRef<HTMLInputElement>(null);
  const upload = useUploadPortrait(character.id);
  const label = character.portraitUpdatedAt ? "Change portrait" : "Upload portrait";

  useSaveToast(
    "Portrait",
    upload.error ? `Couldn't upload the image: ${upload.error.message}` : undefined,
    undefined,
    upload.error,
  );

  return (
    <div className="relative shrink-0">
      <CharacterPortrait character={character} className="size-8 text-sm" />
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-disabled={upload.isPending}
        onClick={() => {
          if (!upload.isPending) picker.current?.click();
        }}
        className="-right-0.75 -bottom-0.75 absolute flex size-3.5 items-center justify-center rounded-full border-[1.5px] border-surface bg-accent text-white before:absolute before:-inset-1.5 aria-disabled:cursor-wait"
      >
        <Camera size={8} strokeWidth={2.6} aria-hidden="true" />
      </button>
      <input
        ref={picker}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        aria-label="Portrait image"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) upload.mutate(file);
        }}
      />
    </div>
  );
}
