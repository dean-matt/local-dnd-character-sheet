import { render, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { warlockRecord } from "../../../test/records.ts";
import { PrintTitle } from "./PrintTitle.tsx";

describe("PrintTitle", () => {
  it("carries the name and subtitle with no avatar", () => {
    const { container } = render(<PrintTitle character={warlockRecord()} />);

    expect(within(container).getByText("Vex")).toBeInTheDocument();
    expect(within(container).getByText(/^Half-Elf Warlock 3/)).toBeInTheDocument();
    expect(container.querySelector("[aria-hidden]")).toBeNull();
  });
});
