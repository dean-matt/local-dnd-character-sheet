import { characterDefinitionSchema } from "@dnd/character";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useFormContext } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FormShell } from "./FormShell.tsx";

const FLOW = "test-flow";
const KEY = `draft:${FLOW}`;
const SCHEMA = characterDefinitionSchema.pick({ name: true });

function NameInput() {
  return <input aria-label="Name" {...useFormContext().register("name")} />;
}

function renderShell(
  { onSubmit = vi.fn(), onCancel = vi.fn() } = {},
  extra: (cancel: () => void) => ReactNode = () => null,
) {
  const shell = (more: ReactNode = null) => (
    <FormShell
      schema={SCHEMA}
      flow={FLOW}
      defaultValues={{ name: "" }}
      onSubmit={onSubmit}
      onCancel={onCancel}
    >
      {({ cancel }) => (
        <>
          <NameInput />
          {extra(cancel)}
          {more}
          <button type="submit">Create</button>
        </>
      )}
    </FormShell>
  );
  const { unmount, rerender } = render(shell());
  return { onSubmit, onCancel, unmount, rerender: (more: ReactNode) => rerender(shell(more)) };
}

const nameInput = () => screen.getByRole("textbox", { name: "Name" });
const typeName = (value: string) => fireEvent.change(nameInput(), { target: { value } });
const storedDraft = () => JSON.parse(localStorage.getItem(KEY) ?? "null");

describe("FormShell", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.useRealTimers());

  it("submits the parsed values and clears the draft", async () => {
    localStorage.setItem(KEY, JSON.stringify({ name: "Vex" }));
    const { onSubmit } = renderShell();

    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: "Vex" }));
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("keeps the draft until onSubmit resolves", async () => {
    localStorage.setItem(KEY, JSON.stringify({ name: "Vex" }));
    let resolve = () => {};
    const onSubmit = vi.fn(() => new Promise<void>((done) => (resolve = done)));
    renderShell({ onSubmit });

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(localStorage.getItem(KEY)).not.toBeNull();

    await act(async () => resolve());
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("types a button without a type as type=button, including one rendered later", async () => {
    localStorage.setItem(KEY, JSON.stringify({ name: "Vex" }));
    const { onSubmit, rerender } = renderShell(
      {},
      // biome-ignore lint/a11y/useButtonType: a typeless button is the case FormShell guards
      () => <button>Add a level</button>,
    );
    // biome-ignore lint/a11y/useButtonType: a typeless button is the case FormShell guards
    rerender(<button>Remove a level</button>);
    await act(() => Promise.resolve());

    for (const name of ["Add a level", "Remove a level"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveAttribute("type", "button");
      fireEvent.click(button);
    }
    await act(() => Promise.resolve());

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("writes the draft on a debounce and rehydrates it on mount", () => {
    vi.useFakeTimers();
    const { unmount } = renderShell();

    typeName("Vex");
    expect(localStorage.getItem(KEY)).toBeNull();
    act(() => vi.advanceTimersByTime(300));
    expect(storedDraft()).toEqual({ name: "Vex" });

    unmount();
    renderShell();
    expect(nameInput()).toHaveValue("Vex");
  });

  it("writes a pending draft when the form unmounts before the debounce", () => {
    vi.useFakeTimers();
    const { unmount } = renderShell();

    typeName("Vex");
    unmount();

    expect(storedDraft()).toEqual({ name: "Vex" });
  });

  it("writes a pending draft on pagehide, before the debounce", () => {
    vi.useFakeTimers();
    renderShell();

    typeName("Vex");
    fireEvent(window, new Event("pagehide"));

    expect(storedDraft()).toEqual({ name: "Vex" });
  });

  it("discards the draft and a pending write on cancel", () => {
    vi.useFakeTimers();
    localStorage.setItem(KEY, JSON.stringify({ name: "Vex" }));
    const { onCancel } = renderShell({}, (cancel) => (
      <button type="button" onClick={cancel}>
        Cancel
      </button>
    ));

    typeName("Vexahlia");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    act(() => vi.advanceTimersByTime(300));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("starts from the defaults over an unreadable draft", () => {
    localStorage.setItem(KEY, "{not json");
    renderShell();

    expect(nameInput()).toHaveValue("");
  });
});
