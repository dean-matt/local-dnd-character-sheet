import {
  type CharacterDefinition,
  type CharacterRecord,
  noteSectionSchema,
  SECTION_LABEL,
} from "@dnd/character";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useHeldSave } from "../../hooks/useHeldSave.ts";
import { useUpdateCharacterDefinition } from "../../hooks/useUpdateCharacterDefinition.ts";
import { withDeparture } from "../../lib/departures.ts";
import { Card } from "../Card.tsx";
import { EmptyNote } from "../EmptyNote.tsx";
import { Field } from "../Field/Field.tsx";
import { RemoveButton } from "../RemoveButton.tsx";
import { SectionUnavailable } from "./SectionUnavailable.tsx";

type NoteSection = CharacterDefinition["notes"][number];

const titleSchema = noteSectionSchema.shape.title;
const textSchema = noteSectionSchema.shape.notes.element.shape.text;

const ADD =
  "flex cursor-pointer items-center gap-0.5 rounded-control p-1 font-semibold text-accent-text text-label normal-case tracking-normal hover:bg-subtle print:hidden";

/**
 * The player's notes in titled sections, each section and note added, edited and removed
 * in place and saved as it changes. Under them sits what the character holds against the
 * rules as printed, so a value creation let through reads as a choice rather than an error.
 */
export function NotesSection({ character }: { character: CharacterRecord | undefined }) {
  const write = useHeldSave(character?.id ?? "", "Notes");
  // A title or a note saves through its own field, which reports its own failure.
  const update = useUpdateCharacterDefinition(character?.id ?? "");
  const root = useRef<HTMLDivElement>(null);
  // What takes focus once it renders: a box just added appears only when its write lands.
  const [focus, setFocus] = useState<string>();

  useEffect(() => {
    if (focus === undefined) return;
    const target = root.current?.querySelector<HTMLElement>(focus);
    if (!target) return;
    target.focus();
    setFocus(undefined);
  });

  if (!character) return <SectionUnavailable page="Notes" />;
  const { notes: sections, departures } = character.definition;

  const writeSections = (key: string, edit: (latest: NoteSection[]) => NoteSection[]) =>
    write(key, (latest) => ({ ...latest, notes: edit(latest.notes) }));
  /** `key` names the note a write adds or removes, so each holds its own failure. */
  const inSection = (id: string, key: string, edit: (section: NoteSection) => NoteSection) =>
    writeSections(key, (latest) =>
      latest.map((section) => (section.id === id ? edit(section) : section)),
    );
  const saveField = (id: string, edit: (section: NoteSection) => NoteSection) =>
    update.mutateAsync((latest) => ({
      ...latest,
      notes: latest.notes.map((section) => (section.id === id ? edit(section) : section)),
    }));

  function addSection() {
    const id = crypto.randomUUID();
    setFocus(`[data-section="${id}"] input`);
    writeSections(id, (latest) => [...latest, { id, title: "New section", notes: [] }]);
  }

  function addNote(sectionId: string) {
    const id = crypto.randomUUID();
    setFocus(`[data-note="${id}"] textarea`);
    inSection(sectionId, id, (section) => ({
      ...section,
      notes: [...section.notes, { id, text: "" }],
    }));
  }

  return (
    <div ref={root} className="flex flex-col gap-3">
      <Card
        title="Notes"
        aside={
          <button type="button" data-add-section onClick={addSection} className={ADD}>
            <Plus aria-hidden="true" size={12} />
            Add section
          </button>
        }
      >
        {sections.length === 0 ? (
          <EmptyNote>No notes yet.</EmptyNote>
        ) : (
          <div className="flex flex-col gap-3">
            {sections.map((section) => {
              const name = section.title.trim() || "Untitled section";
              return (
                <section
                  key={section.id}
                  aria-label={name}
                  data-section={section.id}
                  className="flex flex-col gap-2 rounded-card border border-border p-2.5"
                >
                  <div className="flex items-center gap-1.5">
                    <div className="min-w-0 grow">
                      <Field
                        mode="edit"
                        label="Section title"
                        labelHidden
                        inputClassName="font-semibold"
                        current={section.title}
                        format={(title) => title}
                        parse={(raw) => raw}
                        schema={titleSchema}
                        onSave={async (title: string) => {
                          await saveField(section.id, (latest) => ({ ...latest, title }));
                        }}
                      />
                    </div>
                    <span className="flex print:hidden">
                      <RemoveButton
                        name={`section ${name}`}
                        busy={false}
                        onRemove={() => {
                          setFocus("[data-add-section]");
                          writeSections(section.id, (latest) =>
                            latest.filter((each) => each.id !== section.id),
                          );
                        }}
                      />
                    </span>
                  </div>
                  {section.notes.map((note, index) => (
                    <div
                      key={note.id}
                      data-note={note.id}
                      className="flex flex-col gap-1 rounded-control bg-subtle p-2"
                    >
                      <Field
                        mode="edit"
                        multiline
                        label={`Note ${index + 1}`}
                        labelHidden
                        placeholder="Write a note…"
                        current={note.text}
                        format={(text) => text}
                        parse={(raw) => raw}
                        schema={textSchema}
                        onSave={async (text: string) => {
                          await saveField(section.id, (latest) => ({
                            ...latest,
                            notes: latest.notes.map((each) =>
                              each.id === note.id ? { ...each, text } : each,
                            ),
                          }));
                        }}
                      />
                      <button
                        type="button"
                        aria-label={`Remove note ${index + 1}`}
                        onClick={() => {
                          setFocus(`[data-add-note="${section.id}"]`);
                          inSection(section.id, note.id, (latest) => ({
                            ...latest,
                            notes: latest.notes.filter((each) => each.id !== note.id),
                          }));
                        }}
                        className="cursor-pointer self-end text-muted text-row hover:text-ink print:hidden"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    data-add-note={section.id}
                    onClick={() => addNote(section.id)}
                    className={`${ADD} self-start`}
                  >
                    <Plus aria-hidden="true" size={12} />
                    Add note
                  </button>
                </section>
              );
            })}
          </div>
        )}
      </Card>
      {departures.length > 0 && (
        <Card title="Off the rules">
          <ul className="flex flex-col gap-1 text-body">
            {departures.map(({ field, note }) => {
              const label =
                SECTION_LABEL[field.split(".")[0] as keyof CharacterDefinition] ?? field;
              return (
                <li key={`${field}|${note}`} className="flex items-center gap-1.5">
                  <span>
                    <span className="font-semibold">{label}</span> — {note}
                  </span>
                  <span className="flex print:hidden">
                    <RemoveButton
                      name={`off the rules note ${label} — ${note}`}
                      busy={false}
                      onRemove={() => {
                        setFocus("[data-add-section]");
                        write(`departure|${field}`, (latest) => ({
                          ...latest,
                          departures: withDeparture(latest.departures, field),
                        }));
                      }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
