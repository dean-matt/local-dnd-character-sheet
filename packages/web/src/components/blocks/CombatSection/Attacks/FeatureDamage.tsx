import { featureDamageDice, offerSlots, type SpellCastOption } from "@dnd/character";
import type { Attack } from "../../attack.ts";

type Entry = Attack["featureDamage"][number];

/** A slot option as the select keys it. */
const slotKey = ({ via, level }: SpellCastOption) => `${via}:${level}`;

const amount = (entry: Entry, slot?: SpellCastOption, versus = false) => {
  const dice = featureDamageDice(entry, slot?.level, versus);
  const bonus = entry.bonus === 0 ? "" : `${entry.bonus > 0 ? "+" : ""}${entry.bonus}`;
  return `+${dice === null ? entry.bonus : `${dice}${bonus}`}${entry.type ? ` ${entry.type}` : ""}`;
};

/**
 * The damage held features add to one row: a line per feature that always lands, a checkbox
 * per one the attack offers, and a note for a once-a-turn one already used. A feature that
 * spends a slot asks for the slot once taken and, where it names a kind of target, whether the
 * target is that kind.
 */
export function FeatureDamage({
  entries,
  rolling,
  taken,
  take,
  used,
  slots,
  slot,
  pickSlot,
  versus,
  setVersus,
}: {
  entries: readonly Entry[];
  rolling: boolean;
  taken: readonly string[];
  take: (source: string, on: boolean) => void;
  used: (entry: Entry) => boolean;
  slots: readonly SpellCastOption[];
  slot: SpellCastOption | undefined;
  pickSlot: (slot: SpellCastOption) => void;
  versus: boolean;
  setVersus: (on: boolean) => void;
}) {
  return entries.map((entry) => {
    const { source, offer } = entry;
    if (!offer)
      return (
        <p key={source} className="text-label">
          {amount(entry)} {source}
        </p>
      );
    if (!rolling) return null;
    if (used(entry))
      return (
        <p key={source} className="text-label text-muted">
          {source} used this turn
        </p>
      );
    const checked = taken.includes(source);
    const own = offerSlots(slots, offer);
    const noSlot = offer.slot !== null && own.length === 0;
    const at =
      own.find((option) => option.via === slot?.via && option.level === slot.level) ?? own[0];
    return (
      <div key={source} className="flex flex-col gap-0.5">
        <label className="flex items-center gap-1 text-label">
          <input
            type="checkbox"
            checked={checked && !noSlot}
            disabled={noSlot}
            aria-label={`${source} ${amount(entry, at, versus)}, ${offer.condition}`}
            onChange={(event) => take(source, event.target.checked)}
          />
          <span title={offer.condition}>
            {source} {amount(entry, at, versus)}
          </span>
        </label>
        {noSlot && (
          <p className="text-label text-muted">
            No {offer.slot?.pact ? "pact" : "spell"} slot left
          </p>
        )}
        {checked && offer.slot && at && (
          <>
            <label className="flex items-center gap-1 text-label">
              Slot
              <select
                value={slotKey(at)}
                onChange={(event) => {
                  const picked = own.find((option) => slotKey(option) === event.target.value);
                  if (picked) pickSlot(picked);
                }}
                className="min-h-6 min-w-0 rounded-control border border-border bg-surface"
              >
                {own.map((option) => (
                  <option key={slotKey(option)} value={slotKey(option)}>
                    Level {option.level}
                    {option.via === "pact" ? " pact" : ""} ({option.left} left)
                  </option>
                ))}
              </select>
            </label>
            {offer.slot.versus && (
              <label className="flex items-center gap-1 text-label">
                <input
                  type="checkbox"
                  checked={versus}
                  onChange={(event) => setVersus(event.target.checked)}
                />
                Against {offer.slot.versus}
              </label>
            )}
          </>
        )}
      </div>
    );
  });
}
