import { characterDerivedSchema } from "@dnd/character";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Field } from "./Field.tsx";

/** The real schema a hit point maximum field validates against, not a stand-in. */
const schema = characterDerivedSchema.shape.hitPointMaximum.shape.computed;
const parse = (raw: string) => Number(raw);
const format = (value: number) => String(value);
const DEBOUNCE_MS = 10;

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
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"));
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

  it("shows saving then saved", async () => {
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

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"));
  });

  it("keeps the typed text and offers a retry when the save fails", async () => {
    const onSave = vi.fn().mockRejectedValueOnce(new Error("network down"));
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

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("network down"));
    expect(input).toHaveValue("12");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", screen.getByRole("alert").id);

    onSave.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"));
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave).toHaveBeenLastCalledWith(12);
    expect(input).toHaveAttribute("aria-invalid", "false");
    expect(input).not.toHaveAttribute("aria-describedby");
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
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    // A detour through another value, landing back on the one that failed —
    // never a click on Retry.
    fireEvent.change(input, { target: { value: "13" } });
    fireEvent.change(input, { target: { value: "12" } });

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave).toHaveBeenLastCalledWith(12);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"));
  });

  it("surfaces a schema validation failure without calling onSave", async () => {
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
      target: { value: "0" },
    });

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(onSave).not.toHaveBeenCalled();
  });

  it("surfaces a parse failure without calling onSave", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
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

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(onSave).not.toHaveBeenCalled();
  });
});
