import type { FeatureGroup, LimitedUses } from "@dnd/catalog";
import {
  ACTION_TURN_MARK,
  type ActionType,
  actionAdded,
  actionAddedBy,
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
import {
  amountSpent,
  type FeatureResource,
  featureResource,
} from "../../../../lib/featureResource.ts";
import { choiceBlocked, chosenValue, restoreChoice } from "../../../../lib/restoreChoice.ts";
import { Announcer } from "../../../Announcer.tsx";
import { RestoreChoiceSelect } from "../../../RestoreChoiceSelect.tsx";
import { AmountInput } from "./AmountInput.tsx";
import { ConvertDialog } from "./ConvertDialog.tsx";
import { tradeWords } from "./tradeWords.ts";

const BUTTON =
  "h-6 rounded-control border border-border bg-surface px-2 font-semibold text-label hover:bg-subtle aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

/** `used`, with what is left of a counted resource after spending `amount` of it. */
function countLeft(resource: FeatureResource | null, amount: number, used: string) {
  return resource?.total != null && resource.left != null
    ? `${used}: ${resource.left - amount} of ${resource.total} left`
    : used;
}

/**
 * A held feature's resource and its Use control. A Use spends the resource, if any, marks
 * the feature's action type spent on the Turn Economy, adds an action to the turn where the
 * feature does, as Action Surge does, and lands what the feature restores,
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
  usesOf,
}: {
  character: CharacterRecord;
  derived: CharacterDerived;
  name: string;
  source: string;
  type: ActionType;
  group: Pick<FeatureGroup, "class">;
  uses: LimitedUses | undefined;
  usesOf?: (name: string) => LimitedUses | undefined;
}) {
  const play = useCharacterState(character.id);
  const replace = useAnnouncedStateWrite(character.id);
  const restore = useFeatureRestore(character.id);
  const [converting, setConverting] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
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
    usesOf,
  );
  if (!resource && !mark) return null;

  const amount = amountSpent(resource, chosen);
  const choice = restoreChoice(derived, stored, { name, source });
  const count = chosenValue(choice, picked);

  const addsAction = derived.turn.addsAction.some(
    (feature) => feature.name === name && feature.source === source,
  );
  const blocked =
    resource?.blocked ??
    choiceBlocked(choice) ??
    (addsAction && actionAddedBy(stored, name) ? `${name} already used this turn` : null);
  const disabled = replace.writing || blocked !== null;
  const counted = resource?.total != null;
  const conversion = derived.featureConversions.find(
    ({ feature }) => feature.name === name && feature.source === source,
  );
  const spent = () => {
    const after = resource ? resource.spend(stored, amount) : stored;
    const marked = mark ? turnMarkSpent(after, mark) : after;
    return addsAction ? actionAdded(marked, name) : marked;
  };
  const usedWords = (trade?: string) => {
    const used = `${name} used${trade ? ` to ${trade}` : ""}`;
    return [
      countLeft(resource, amount, used),
      ...(mark ? [`${TURN_LABELS[mark]} spent`] : []),
      ...(addsAction ? ["Action added to the turn"] : []),
    ];
  };

  async function use() {
    if (disabled) return;
    const restored = restore(derived, { name, source }, spent(), count);
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
      <AmountInput name={name} resource={resource} amount={amount} onChange={setChosen} />
      <RestoreChoiceSelect name={name} choice={choice} value={count} onChange={setPicked} />
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
