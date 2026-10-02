import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InputField } from "./InputField.tsx";

describe("InputField", () => {
  it("passes the input type through", () => {
    render(<InputField label="Level" type="number" />);

    expect(screen.getByRole("spinbutton", { name: "Level" })).toBeInTheDocument();
  });

  it("announces a status while the field is valid", () => {
    render(<InputField label="Name" status="Saving…" />);

    expect(screen.getByRole("status")).toHaveTextContent("Saving…");
  });
});
