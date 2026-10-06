import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormField } from "./FormField.tsx";

describe("FormField", () => {
  it("labels whatever control its render prop returns", () => {
    render(
      <FormField label="Alignment">
        {(control) => (
          <select {...control}>
            <option>Neutral</option>
          </select>
        )}
      </FormField>,
    );

    expect(screen.getByRole("combobox", { name: "Alignment" })).toBeInTheDocument();
  });

  it("describes an invalid control by its error and marks it invalid", () => {
    render(
      <FormField label="Alignment" error="Pick an alignment.">
        {(control) => <select {...control} />}
      </FormField>,
    );

    const select = screen.getByRole("combobox", { name: "Alignment" });
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAccessibleDescription("Pick an alignment.");
    expect(screen.getByRole("alert")).toHaveTextContent("Pick an alignment.");
    expect(screen.getByRole("alert")).toHaveClass("text-error");
  });

  it("leaves a valid control undescribed and keeps an empty live region mounted", () => {
    render(<FormField label="Alignment">{(control) => <select {...control} />}</FormField>);

    const select = screen.getByRole("combobox", { name: "Alignment" });
    expect(select).toHaveAttribute("aria-invalid", "false");
    expect(select).not.toHaveAttribute("aria-describedby");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reads a falsy error as no error", () => {
    render(
      <FormField label="Alignment" status="Saved" error={false}>
        {(control) => <select {...control} />}
      </FormField>,
    );

    const select = screen.getByRole("combobox", { name: "Alignment" });
    expect(select).toHaveAttribute("aria-invalid", "false");
    expect(select).not.toHaveAttribute("aria-describedby");
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("silences the status while an error stands", () => {
    render(
      <FormField label="Alignment" status="Saved" error="Pick an alignment.">
        {(control) => <select {...control} />}
      </FormField>,
    );

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(screen.getByRole("alert")).toHaveTextContent("Pick an alignment.");
  });

  it("puts its messages in the caller's slot, each naming the field", () => {
    const slot = document.body.appendChild(document.createElement("div"));
    const { rerender } = render(
      <FormField
        label="Strength score"
        status="Saved"
        messageSlot={{ into: slot, name: "Strength" }}
      >
        {(control) => <input {...control} />}
      </FormField>,
    );

    expect(slot).toContainElement(screen.getByRole("status"));
    expect(screen.getByRole("status")).toHaveTextContent("Strength: Saved");

    rerender(
      <FormField
        label="Strength score"
        error="Too high."
        messageSlot={{ into: slot, name: "Strength" }}
      >
        {(control) => <input {...control} />}
      </FormField>,
    );

    expect(slot).toContainElement(screen.getByRole("alert"));
    expect(screen.getByRole("textbox", { name: "Strength score" })).toHaveAccessibleDescription(
      "Strength: Too high.",
    );
    slot.remove();
  });
});
