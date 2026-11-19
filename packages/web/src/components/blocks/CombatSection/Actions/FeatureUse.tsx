import type { FeatureGroup, LimitedUses } from "@dnd/catalog";
import {
  ACTION_TURN_MARK,
  type ActionType,
  type CharacterDerived,
  type CharacterRecord,
  type ConversionOption,
  conversionOptions,
  convertedState,
  TURN_LABELS,
  turnMarkSpent,
} from "@dnd/character";
import { useRef, useState } from "react";
import { useAnnouncedStateWrite } from "../../../../hooks/useAnnouncedStateWrite.ts";
import { useCharacterState } from "../../../../hooks/useCharacterState.ts";
import { useFeatureRestore } from "../../../../hooks/useFeatureRestore.ts";
import { Announcer } from "../../../Announcer.tsx";
import { ConvertDialog } from "./ConvertDialog.tsx";
import { featureResource } from "./featureResource.ts";
import { tradeWords } from "./tradeWords.ts";

const BUTTON =
  "h-6 rounded-control border border-border bg-surface px-2 font-semibold text-label hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

/**
 * A held feature's resource and its Use control. A Use spends the resource, if any, marks
 * the feature's action type spent on the Turn Economy, and lands what the feature restores,
 * as one announced state write, then logs what it rolled. A feature that trades between a
 * pool and spell slots offers Convert instead, whose pick lands with the spend and the mark in
 * the same one write. Nothing shows until state loads, since the count left is read from it.
 */
export function FeatureUse({
  character,
  derived,
  name,
  source,
  type,
  group,
  uses,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
  name: string;
  source: string;
  type: ActionType;
  group: Pick<FeatureGroup, "class">;
  uses: LimitedUses | undefined;
}) {
  const play = useCharacterState(character.id);
  const replace = useAnnouncedStateWrite(character.id);
  const restore = useFeatureRestore(character.id);
  const [converting, setConverting] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const mark = ACTION_TURN_MARK[type];
  if (!play.isSuccess) return null;

  const stored = play.data.state;
  const resource = featureResource(
    derived,
    stored,
    character.definition.edition,
    { name, source, uses },
    group,
  );
  if (!resource && !mark) return null;

  const blocked = resource?.blocked ?? null;
  const disabled = replace.writing || blocked !== null;
  const counted = resource?.total != null;
  const conversion = derived.featureConversions.find(
    ({ feature }) => feature.name === name && feature.source === source,
  );
  const spent = () => {
    const after = resource ? resource.spend(stored) : stored;
    return mark ? turnMarkSpent(after, mark) : after;
  };
  const usedWords = (trade?: string) => {
    const used = `${name} used${trade ? ` to ${trade}` : ""}`;
    return [
      resource?.total != null && resource.left != null
        ? `${used}: ${resource.left - 1} of ${resource.total} left`
        : used,
      ...(mark ? [`${TURN_LABELS[mark]} spent`] : []),
    ];
  };

  async function use() {
    if (disabled) return;
    const restored = restore(derived, { name, source }, spent());
    const parts = [...usedWords(), ...restored.text];
    if (await replace.write(restored.state, `${parts.join(". ")}.`)) restored.log();
  }

  function closeConvert() {
    setConverting(false);
    opener.current?.focus();
  }

  async function convert(option: ConversionOption) {
    if (!conversion || replace.writing) return;
    const after = convertedState(derived, spent(), conversion, option);
    const trade = tradeWords(option, conversion.pool).toLowerCase();
    if (await replace.write(after, `${usedWords(trade).join(". ")}.`)) closeConvert();
  }

  return (
    <span className="flex items-center gap-1.5">
      {resource && (
        <span className="text-row">
          {counted ? `${resource.left} / ${resource.total}` : "Unlimited"}
          {resource.rest && <span className="text-muted"> {resource.rest}</span>}
        </span>
      )}
      {conversion ? (
        <button
          ref={opener}
          type="button"
          aria-label={`Convert with ${name}`}
          title={blocked ?? "Convert"}
          aria-disabled={disabled}
          onClick={() => !disabled && setConverting(true)}
          className={BUTTON}
        >
          Convert
        </button>
      ) : (
        <button
          type="button"
          aria-label={`Use ${name}`}
          title={blocked ?? "Use"}
          aria-disabled={disabled}
          onClick={use}
          className={BUTTON}
        >
          Use
        </button>
      )}
      {conversion && converting && (
        <ConvertDialog
          name={name}
          pool={conversion.pool}
          options={conversionOptions(derived, stored, conversion)}
          busy={replace.writing}
          error={replace.error?.message}
          onConvert={convert}
          onClose={closeConvert}
        />
      )}
      {replace.error && !converting && (
        <span role="alert" className="text-error text-row">
          {name} was not changed: {replace.error.message}
        </span>
      )}
      <Announcer announced={replace.announced} />
    </span>
  );
}
