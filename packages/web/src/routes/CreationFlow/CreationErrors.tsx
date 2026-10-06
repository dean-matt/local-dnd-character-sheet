import { type CharacterDefinition, SECTION_LABEL } from "@dnd/character";
import { type FieldErrors, useFormState } from "react-hook-form";
import { Link } from "react-router";
import { stepOf } from "./creationSteps.ts";

/** The first message anywhere under an error, which a nested field carries rather than its parent. */
function firstMessage(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if ("message" in error && typeof error.message === "string") return error.message;
  for (const [key, child] of Object.entries(error)) {
    if (key === "ref") continue;
    const message = firstMessage(child);
    if (message) return message;
  }
  return undefined;
}

/**
 * What stops Finish, once a Finish has failed: each part of the definition the schema
 * rejected, with a link to the step that sets it. Several steps can hold a fault while the
 * user stands on another, so the faults are gathered here rather than left on their steps.
 */
export function CreationErrors() {
  const { errors, submitCount } = useFormState<CharacterDefinition>();
  const keys = Object.keys(errors as FieldErrors);
  const faults = keys.filter((key): key is keyof CharacterDefinition => key in SECTION_LABEL);
  // A draft saved by an older build can hold a key the schema no longer has, which the
  // resolver files under no section; Cancel is the only way past it.
  const unplaced = keys.length > faults.length;
  if (submitCount === 0 || keys.length === 0) return null;
  return (
    <section
      role="alert"
      aria-labelledby="creation-errors"
      className="rounded-card border border-error bg-surface p-3.5"
    >
      <h2 id="creation-errors" className="font-semibold text-body text-error">
        The character is not finished yet
      </h2>
      <ul className="mt-2 flex flex-col gap-1 text-body">
        {faults.map((field) => {
          const step = stepOf(field);
          const message = firstMessage(errors[field]);
          return (
            <li key={field}>
              <span className="font-semibold">{SECTION_LABEL[field]}</span>
              {message && <> — {message}</>}
              {step && (
                <>
                  {" "}
                  <Link
                    to={`/characters/new/${step.slug}`}
                    className="font-semibold text-accent-text"
                  >
                    Go to {step.label}
                  </Link>
                </>
              )}
            </li>
          );
        })}
        {unplaced && (
          <li>
            The draft holds something a character cannot store. Cancel discards it and starts over.
          </li>
        )}
      </ul>
    </section>
  );
}
