import { averageHitPoints, type CharacterDefinition, HIT_DICE, type HitDie } from "@dnd/character";
import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { ChoicePills } from "./ChoicePills.tsx";
import { rerolled, rollHitDie } from "./classLevels.ts";
import { useClassCatalog } from "./useClassCatalog.ts";

type Method = "average" | "roll";

const METHODS = [
  { value: "average", label: "Average" },
  { value: "roll", label: "Roll" },
] as const;

/**
 * How hit points grow past 1st level: the class table's fixed value, or a roll of the hit
 * die, as the player chooses. Roll fills every level after the first that holds no roll,
 * including one a raised level or a class change adds; Reroll rolls them all again.
 * Constitution is set on a later step, so the total here stops short of it.
 */
export function HitPointsField() {
  const { setValue } = useFormContext<CharacterDefinition>();
  const { levels, hitDie } = useClassCatalog();
  const [method, setMethod] = useState<Method>(() =>
    levels.some((level) => level.rolled !== undefined) ? "roll" : "average",
  );
  const known = HIT_DICE.includes(hitDie as HitDie);
  const unrolled = levels.some((level, index) => index > 0 && level.rolled === undefined);

  useEffect(() => {
    if (method !== "roll" || !known || hitDie === undefined || !unrolled) return;
    setValue(
      "levels",
      levels.map((level, index) =>
        index === 0 || level.rolled !== undefined
          ? level
          : { ...level, rolled: rollHitDie(hitDie) },
      ),
      { shouldDirty: true },
    );
  }, [method, known, hitDie, unrolled, levels, setValue]);

  // The sheet counts no hit points on another die, so neither does this step.
  if (!known || levels.length === 0) return null;
  const die = hitDie as HitDie;
  const average = averageHitPoints(die);
  const faces = levels.map((level, index) => (index === 0 ? die : (level.rolled ?? average)));
  const total = faces.reduce((sum, face) => sum + face, 0);

  return (
    <section aria-labelledby="hit-points" className="flex flex-col gap-1">
      <h2 id="hit-points" className="font-semibold text-label text-muted uppercase tracking-label">
        Hit points
      </h2>
      <ChoicePills
        legend={`Each level after the first, on a d${die}`}
        options={METHODS}
        value={method}
        onChange={(value) => {
          setMethod(value as Method);
          if (value === "average") setValue("levels", rerolled(levels), { shouldDirty: true });
        }}
      />
      {method === "roll" && levels.length > 1 && (
        <button
          type="button"
          onClick={() =>
            setValue(
              "levels",
              rerolled(levels, () => rollHitDie(die)),
              { shouldDirty: true },
            )
          }
          className="mt-1 w-fit rounded-control border border-border bg-surface px-3 py-1 font-semibold text-body"
        >
          Reroll
        </button>
      )}
      <ol className="mt-2 flex flex-col gap-0.5 text-body">
        {faces.map((face, index) => (
          <li // biome-ignore lint/suspicious/noArrayIndexKey: a level is its position.
            key={index}
          >
            Level {index + 1}: {face}{" "}
            <span className="text-muted">
              {index === 0
                ? "(highest face)"
                : levels[index]?.rolled === undefined
                  ? "(average)"
                  : "(rolled)"}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-1 text-body">
        Total: <strong>{total}</strong>{" "}
        <span className="text-muted">plus your Constitution modifier at each level</span>
      </p>
    </section>
  );
}
