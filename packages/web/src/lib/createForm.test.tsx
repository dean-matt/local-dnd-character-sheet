import { characterDefinitionSchema } from "@dnd/character";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InputField } from "../components/InputField.tsx";
import { createForm } from "./createForm.ts";

const FLOW = "test-flow";
const KEY = `draft:${FLOW}`;
const ROGUE = { name: "Rogue", source: "XPHB" };

const { FormShell, useField } = createForm({
  schema: characterDefinitionSchema.pick({ name: true, levels: true }),
  flow: FLOW,
  defaultValues: { name: "", levels: [{ class: ROGUE }] },
});

function NameField() {
  return <InputField label="Name" {...useField("name")} />;
}

function LevelsError() {
  const { error } = useField("levels");
  return error ? <p role="alert">{error}</p> : null;
}

const form = (draftScope?: string, onSubmit = vi.fn()) => (
  <FormShell draftScope={draftScope} onSubmit={onSubmit}>
    {() => (
      <>
        <NameField />
        <LevelsError />
        <button type="submit">Create</button>
      </>
    )}
  </FormShell>
);

const nameInput = () => screen.getByRole("textbox", { name: "Name" });
const draftAt = (key: string) => JSON.parse(localStorage.getItem(key) ?? "null");

describe("createForm", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.useRealTimers());

  it("surfaces a schema error on the field useField binds", async () => {
    const onSubmit = vi.fn();
    render(form(undefined, onSubmit));

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(nameInput()).toHaveAttribute("aria-invalid", "true"));
    expect(nameInput()).toHaveAccessibleDescription(/.+/);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("surfaces a refinement across choices on the field it names", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        name: "Vex",
        levels: [
          { class: ROGUE, subclass: { name: "Thief", source: "XPHB" } },
          { class: ROGUE, subclass: { name: "Assassin", source: "XPHB" } },
        ],
      }),
    );
    const onSubmit = vi.fn();
    render(form(undefined, onSubmit));

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "a class names a subclass on more than one level",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("reads and writes a scoped instance's draft apart from the flow's", () => {
    vi.useFakeTimers();
    localStorage.setItem(KEY, JSON.stringify({ name: "Vex" }));
    localStorage.setItem(`${KEY}:pike`, JSON.stringify({ name: "Pike" }));
    render(form("pike"));

    expect(nameInput()).toHaveValue("Pike");
    fireEvent.change(nameInput(), { target: { value: "Pike Trickfoot" } });
    act(() => vi.advanceTimersByTime(300));

    expect(draftAt(`${KEY}:pike`)).toMatchObject({ name: "Pike Trickfoot" });
    expect(draftAt(KEY)).toEqual({ name: "Vex" });
  });

  it("loads the new scope's draft when the scope changes in place", () => {
    localStorage.setItem(`${KEY}:pike`, JSON.stringify({ name: "Pike" }));
    localStorage.setItem(`${KEY}:vex`, JSON.stringify({ name: "Vex" }));
    const { rerender } = render(form("pike"));

    rerender(form("vex"));

    expect(nameInput()).toHaveValue("Vex");
    expect(draftAt(`${KEY}:vex`)).toEqual({ name: "Vex" });
  });

  it("refuses a field outside a FormShell", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<NameField />)).toThrow('useField("name") ran outside a FormShell');
  });
});
