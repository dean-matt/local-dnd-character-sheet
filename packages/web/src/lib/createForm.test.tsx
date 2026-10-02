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

function renderForm(onSubmit = vi.fn(), onCancel = vi.fn()) {
  const { unmount } = render(
    <FormShell onSubmit={onSubmit} onCancel={onCancel}>
      {({ cancel }) => (
        <>
          <NameField />
          <LevelsError />
          <button type="button" onClick={cancel}>
            Cancel
          </button>
          <button type="submit">Create</button>
        </>
      )}
    </FormShell>,
  );
  return { onSubmit, onCancel, unmount };
}

const nameInput = () => screen.getByRole("textbox", { name: "Name" });
const typeName = (value: string) => fireEvent.change(nameInput(), { target: { value } });

describe("createForm", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.useRealTimers());

  it("validates against the character schema and surfaces the error on its field", async () => {
    const { onSubmit } = renderForm();

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
    const { onSubmit } = renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "a class names a subclass on more than one level",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the parsed values and clears the draft", async () => {
    localStorage.setItem(KEY, JSON.stringify({ name: "Vex" }));
    const { onSubmit } = renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ name: "Vex", levels: [{ class: ROGUE }] }),
    );
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("types a button without a type as type=button, including one rendered later", async () => {
    localStorage.setItem(KEY, JSON.stringify({ name: "Vex" }));
    const onSubmit = vi.fn();
    const form = (extra: boolean) => (
      <FormShell onSubmit={onSubmit}>
        {() => (
          <>
            {/* biome-ignore lint/a11y/useButtonType: a typeless button is the case FormShell guards */}
            <button>Add a level</button>
            {/* biome-ignore lint/a11y/useButtonType: a typeless button is the case FormShell guards */}
            {extra && <button>Remove a level</button>}
            <button type="submit">Create</button>
          </>
        )}
      </FormShell>
    );
    const { rerender } = render(form(false));
    rerender(form(true));
    await act(() => Promise.resolve());

    for (const name of ["Add a level", "Remove a level"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveAttribute("type", "button");
      fireEvent.click(button);
    }
    await act(() => Promise.resolve());

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("keeps the draft until onSubmit resolves", async () => {
    localStorage.setItem(KEY, JSON.stringify({ name: "Vex" }));
    let resolve = () => {};
    const onSubmit = vi.fn(() => new Promise<void>((done) => (resolve = done)));
    renderForm(onSubmit);

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(localStorage.getItem(KEY)).not.toBeNull();

    await act(async () => resolve());
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("writes the draft on a debounce and rehydrates it on mount", () => {
    vi.useFakeTimers();
    const { unmount } = renderForm();

    typeName("Vex");
    expect(localStorage.getItem(KEY)).toBeNull();
    act(() => vi.advanceTimersByTime(300));
    expect(JSON.parse(localStorage.getItem(KEY) ?? "null")).toMatchObject({ name: "Vex" });

    unmount();
    renderForm();
    expect(nameInput()).toHaveValue("Vex");
  });

  it("writes a pending draft when the form unmounts before the debounce", () => {
    vi.useFakeTimers();
    const { unmount } = renderForm();

    typeName("Vex");
    unmount();

    expect(JSON.parse(localStorage.getItem(KEY) ?? "null")).toMatchObject({ name: "Vex" });
  });

  it("writes a pending draft on pagehide, before the debounce", () => {
    vi.useFakeTimers();
    renderForm();

    typeName("Vex");
    fireEvent(window, new Event("pagehide"));

    expect(JSON.parse(localStorage.getItem(KEY) ?? "null")).toMatchObject({ name: "Vex" });
  });

  it("keys a scoped instance's draft apart from the flow's", () => {
    localStorage.setItem(KEY, JSON.stringify({ name: "Vex" }));
    localStorage.setItem(`${KEY}:pike`, JSON.stringify({ name: "Pike" }));
    render(
      <FormShell draftScope="pike" onSubmit={vi.fn()}>
        {() => <NameField />}
      </FormShell>,
    );

    expect(nameInput()).toHaveValue("Pike");
  });

  it("discards the draft and a pending write on cancel", () => {
    vi.useFakeTimers();
    localStorage.setItem(KEY, JSON.stringify({ name: "Vex" }));
    const { onCancel } = renderForm();

    typeName("Vexahlia");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    act(() => vi.advanceTimersByTime(300));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("starts from the defaults over an unreadable draft", () => {
    localStorage.setItem(KEY, "{not json");
    renderForm();

    expect(nameInput()).toHaveValue("");
  });

  it("refuses a field outside its FormShell", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<NameField />)).toThrow('useField("name") ran outside a FormShell');
  });
});
