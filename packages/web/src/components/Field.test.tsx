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
    expect(screen.getByText("11")).toBeInTheDocument();
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

    onSave.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saved"));
    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave).toHaveBeenLastCalledWith(12);
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
