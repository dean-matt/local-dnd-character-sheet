import { characterDefinitionSchema, characterDerivedSchema } from "@dnd/character";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { saveToasts } from "../../test/saveToasts.ts";
import { SaveToasts } from "../SaveToasts.tsx";
import { Field } from "./Field.tsx";

/** The real schema a hit point maximum field validates against, not a stand-in. */
const schema = characterDerivedSchema.shape.hitPointMaximum.shape.computed;
const parse = (raw: string) => Number(raw);
const format = (value: number) => String(value);
const DEBOUNCE_MS = 10;

const withToasts = (ui: ReactElement) =>
  render(
    <>
      {ui}
      <SaveToasts />
    </>,
  );

describe("Field, read mode", () => {
  it("shows the manual value over the computed one", () => {
    render(
      <Field mode="read" label="Hit points" value={{ computed: 8, manual: 11 }} format={format} />,
    );

    expect(screen.getByText("Hit points")).toBeInTheDocument();
    expect(screen.getByText("Hit points").nextElementSibling).toHaveTextContent(/^11/);
  });

  it("marks an overridden value and names the computed one it replaced", () => {
    render(
      <Field mode="read" label="Hit points" value={{ computed: 8, manual: 11 }} format={format} />,
    );

    expect(screen.getByText(", overridden from 8")).toHaveClass("sr-only");
    expect(screen.getByTitle("Overridden; computed 8")).toBeInTheDocument();
  });

  it("marks nothing when there is no override", () => {
    render(
      <Field
        mode="read"
        label="Hit points"
        value={{ computed: 8, manual: null }}
        format={format}
      />,
    );

    expect(screen.queryByText(/overridden/)).not.toBeInTheDocument();
  });

  it("marks an override on a field whose label is hidden, too", () => {
    render(
      <Field
        mode="read"
        label="Modifier"
        value={{ computed: 1, manual: 3 }}
        format={format}
        labelHidden
      />,
    );

    expect(screen.getByText(", overridden from 1")).toBeInTheDocument();
  });

  it("falls back to the computed value when there is no override", () => {
    render(
      <Field
        mode="read"
        label="Hit points"
        value={{ computed: 8, manual: null }}
        format={format}
      />,
    );

    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("renders no input", () => {
    render(
      <Field
        mode="read"
        label="Hit points"
        value={{ computed: 8, manual: null }}
        format={format}
      />,
    );

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("keeps the label for a screen reader when labelHidden hides it visually", () => {
    render(
      <Field
        mode="read"
        label="Name"
        value={{ computed: "Vex", manual: null }}
        format={(value: string) => value}
        labelHidden
      />,
    );

    const label = screen.getByText("Name");
    expect(label).toHaveClass("sr-only");
    expect(screen.getByText("Vex")).toBeInTheDocument();
  });
});

describe("Field, edit mode", () => {
  it("commits the typed value after the debounce elapses, writing manual only", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <Field
        mode="edit"
        label="Hit points"
        value={{ computed: 8, manual: null }}
        format={format}
        schema={schema}
        parse={parse}
        onSave={onSave}
        debounceMs={DEBOUNCE_MS}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Hit points" }), {
      target: { value: "12" },
    });

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(12));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("commits on blur without waiting for the debounce", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <Field
        mode="edit"
        label="Hit points"
        value={{ computed: 8, manual: null }}
        format={format}
        schema={schema}
        parse={parse}
        onSave={onSave}
        debounceMs={100_000}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Hit points" });
    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.blur(input);

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(12));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("does not save on blur when the field was never edited", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <Field
        mode="edit"
        label="Hit points"
        value={{ computed: 8, manual: null }}
        format={format}
        schema={schema}
        parse={parse}
        onSave={onSave}
        debounceMs={DEBOUNCE_MS}
      />,
    );

    fireEvent.blur(screen.getByRole("textbox", { name: "Hit points" }));

    await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS * 3));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("keeps a queued save behind one already in flight, in order", async () => {
    let resolveFirst = () => {};
    const first = new Promise<void>((resolve) => {
      resolveFirst = resolve;
    });
    const onSave = vi
      .fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValueOnce(undefined);

    render(
      <Field
        mode="edit"
        label="Hit points"
        value={{ computed: 8, manual: null }}
        format={format}
        schema={schema}
        parse={parse}
        onSave={onSave}
        debounceMs={DEBOUNCE_MS}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Hit points" });
    fireEvent.change(input, { target: { value: "9" } });
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.blur(input);

    await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS * 3));
    expect(onSave).toHaveBeenCalledTimes(1);

    resolveFirst();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave).toHaveBeenNthCalledWith(1, 9);
    expect(onSave).toHaveBeenNthCalledWith(2, 12);
  });

  it("clears the override by writing null rather than a parsed empty value", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <Field
        mode="edit"
        label="Hit points"
        value={{ computed: 8, manual: 12 }}
        format={format}
        schema={schema}
        parse={parse}
        onSave={onSave}
        debounceMs={DEBOUNCE_MS}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Hit points" }), {
      target: { value: "" },
    });

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
  });

  it("keeps the typed text, outlines it and toasts a retry when the save fails", async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error("network down"));
    withToasts(
      <Field
        mode="edit"
        label="Hit points"
        value={{ computed: 8, manual: null }}
        format={format}
        schema={schema}
        parse={parse}
        onSave={onSave}
        debounceMs={DEBOUNCE_MS}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Hit points" });
    fireEvent.change(input, { target: { value: "12" } });

    expect(await saveToasts().findByText("Hit points: network down")).toBeInTheDocument();
    expect(input).toHaveValue("12");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    onSave.mockResolvedValueOnce(undefined);
    fireEvent.click(saveToasts().getByRole("button", { name: /^Retry / }));

    await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "false"));
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave).toHaveBeenLastCalledWith(12);
    expect(saveToasts().queryByText(/network down/)).not.toBeInTheDocument();
  });

  it("retries a failed save when the user edits back to the same value, without clicking retry", async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(undefined);
    render(
      <Field
        mode="edit"
        label="Hit points"
        value={{ computed: 8, manual: null }}
        format={format}
        schema={schema}
        parse={parse}
        onSave={onSave}
        debounceMs={DEBOUNCE_MS}
      />,
    );

    const input = screen.getByRole("textbox", { name: "Hit points" });
    fireEvent.change(input, { target: { value: "12" } });
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "true"));

    // A detour through another value, landing back on the one that failed —
    // never a click on Retry.
    fireEvent.change(input, { target: { value: "13" } });
    fireEvent.change(input, { target: { value: "12" } });

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave).toHaveBeenLastCalledWith(12);
    await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "false"));
  });

  it("surfaces a schema validation failure without calling onSave", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    withToasts(
      <Field
        mode="edit"
        label="Hit points"
        value={{ computed: 8, manual: null }}
        format={format}
        schema={schema}
        parse={parse}
        onSave={onSave}
        debounceMs={DEBOUNCE_MS}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Hit points" }), {
      target: { value: "0" },
    });

    expect(await saveToasts().findByText(/^Hit points: /)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Hit points" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(onSave).not.toHaveBeenCalled();
    expect(saveToasts().queryByRole("button", { name: /^Retry / })).not.toBeInTheDocument();
  });

  it("surfaces a parse failure without calling onSave", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    withToasts(
      <Field
        mode="edit"
        label="Hit points"
        value={{ computed: 8, manual: null }}
        format={format}
        schema={schema}
        parse={(raw) => {
          if (Number.isNaN(Number(raw))) throw new Error("not a number");
          return Number(raw);
        }}
        onSave={onSave}
        debounceMs={DEBOUNCE_MS}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Hit points" }), {
      target: { value: "abc" },
    });

    expect(await saveToasts().findByText(/^Hit points: /)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Hit points" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(onSave).not.toHaveBeenCalled();
    expect(saveToasts().queryByRole("button", { name: /^Retry / })).not.toBeInTheDocument();
  });
});

describe("Field, edit mode, a value changed from outside", () => {
  const edit = (manual: number | null, onSave = vi.fn().mockResolvedValue(undefined)) => (
    <Field
      mode="edit"
      label="Hit points"
      value={{ computed: 8, manual }}
      format={format}
      schema={schema}
      parse={parse}
      onSave={onSave}
      debounceMs={100_000}
    />
  );

  it("shows the new value while the field holds no unsaved edit, as after an undo", () => {
    const { rerender } = render(edit(12));
    rerender(edit(15));

    expect(screen.getByRole("textbox", { name: "Hit points" })).toHaveValue("15");
  });

  it("keeps the user's unsaved text over it", () => {
    const { rerender } = render(edit(12));
    fireEvent.change(screen.getByRole("textbox", { name: "Hit points" }), {
      target: { value: "20" },
    });
    rerender(edit(15));

    expect(screen.getByRole("textbox", { name: "Hit points" })).toHaveValue("20");
  });
});

describe("Field, edit mode, a plain value", () => {
  it("keeps the text being typed when its own save reads back normalized", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const name = (current: string) => (
      <Field
        mode="edit"
        label="Name"
        current={current}
        format={(value: string) => value}
        parse={(raw) => raw.trim()}
        schema={characterDefinitionSchema.shape.name}
        onSave={onSave}
        debounceMs={DEBOUNCE_MS}
      />
    );
    const { rerender } = render(name("Ve"));
    const input = screen.getByRole("textbox", { name: "Name" });

    fireEvent.change(input, { target: { value: "Vex " } });
    await waitFor(() => expect(onSave).toHaveBeenCalledWith("Vex"));
    await act(async () => {});
    rerender(name("Vex"));

    expect(input).toHaveValue("Vex ");
  });

  it("refuses a name of spaces alone", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    withToasts(
      <Field
        mode="edit"
        label="Name"
        current="Vex"
        format={(value: string) => value}
        parse={(raw) => raw.trim()}
        schema={characterDefinitionSchema.shape.name}
        onSave={onSave}
        debounceMs={DEBOUNCE_MS}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "   " } });

    expect(await saveToasts().findByText("Name: A character needs a name.")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("Field, edit mode, a failed save's toast", () => {
  afterEach(() => vi.useRealTimers());

  const edit = (onSave: () => Promise<void>) =>
    withToasts(
      <Field
        mode="edit"
        label="Hit points"
        value={{ computed: 8, manual: null }}
        format={format}
        schema={schema}
        parse={parse}
        onSave={onSave}
        debounceMs={DEBOUNCE_MS}
      />,
    );
  const typeAndSettle = async (value: string) => {
    fireEvent.change(screen.getByRole("textbox", { name: "Hit points" }), { target: { value } });
    await act(() => vi.advanceTimersByTimeAsync(DEBOUNCE_MS));
  };

  it("stays until it is fixed", async () => {
    vi.useFakeTimers();
    edit(vi.fn().mockRejectedValue(new Error("network down")));

    await typeAndSettle("12");
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(saveToasts().getByText("Hit points: network down")).toBeInTheDocument();
  });

  it("comes back when the same failure repeats after a dismissal", async () => {
    edit(vi.fn().mockRejectedValue(new Error("network down")));
    const input = screen.getByRole("textbox", { name: "Hit points" });
    fireEvent.change(input, { target: { value: "12" } });
    fireEvent.click(await saveToasts().findByRole("button", { name: "Dismiss Hit points" }));

    fireEvent.blur(input);

    expect(await saveToasts().findByText("Hit points: network down")).toBeInTheDocument();
  });

  it("is raised, without Retry, for a write that fails after its field unmounts", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("network down"));
    const { rerender } = edit(onSave);
    fireEvent.change(screen.getByRole("textbox", { name: "Hit points" }), {
      target: { value: "12" },
    });

    rerender(<SaveToasts />);

    expect(await saveToasts().findByText("Hit points: network down")).toBeInTheDocument();
    expect(onSave).toHaveBeenCalledWith(12);
    expect(saveToasts().queryByRole("button", { name: /^Retry / })).not.toBeInTheDocument();
  });

  it("goes when dismissed, leaving the field outlined", async () => {
    edit(vi.fn().mockRejectedValue(new Error("network down")));
    fireEvent.change(screen.getByRole("textbox", { name: "Hit points" }), {
      target: { value: "12" },
    });

    fireEvent.click(await saveToasts().findByRole("button", { name: "Dismiss Hit points" }));

    expect(saveToasts().queryByText(/network down/)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Hit points" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});
