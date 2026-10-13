import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSaveToast } from "../hooks/useSaveToast.ts";
import { SaveToasts } from "./SaveToasts.tsx";

function Problem({
  field = "Gold",
  message,
  retry,
}: {
  field?: string;
  message?: string;
  retry?: () => void;
}) {
  useSaveToast(field, message, retry);
  return null;
}

const regions = () => screen.getAllByRole("region", { name: "Save problems" });

describe("SaveToasts", () => {
  it("shows a field's problem until it clears, naming the field", () => {
    const { rerender } = render(
      <>
        <Problem message="disk full" />
        <SaveToasts />
      </>,
    );
    expect(screen.getByRole("region", { name: "Save problems" })).toHaveTextContent(
      "Gold: disk full",
    );
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();

    rerender(
      <>
        <Problem />
        <SaveToasts />
      </>,
    );
    expect(screen.getByRole("region", { name: "Save problems" })).toBeEmptyDOMElement();
  });

  it("retries through the field's latest handler, and goes when dismissed", () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender } = render(
      <>
        <Problem message="disk full" retry={first} />
        <SaveToasts />
      </>,
    );
    rerender(
      <>
        <Problem message="disk full" retry={latest} />
        <SaveToasts />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(latest).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss Gold" }));
    expect(screen.queryByText("Gold: disk full")).not.toBeInTheDocument();
  });

  it("goes with the field that raised it", () => {
    const { rerender } = render(
      <>
        <Problem message="disk full" />
        <SaveToasts />
      </>,
    );
    rerender(<SaveToasts />);

    expect(screen.queryByText("Gold: disk full")).not.toBeInTheDocument();
  });

  it("returns focus to where it came from when a dismissal leaves no toast", () => {
    render(
      <>
        <input aria-label="Gold (gp)" />
        <Problem message="disk full" />
        <SaveToasts />
      </>,
    );
    const field = screen.getByRole("textbox", { name: "Gold (gp)" });
    field.focus();
    const dismiss = screen.getByRole("button", { name: "Dismiss Gold" });
    dismiss.focus();

    fireEvent.click(dismiss);

    expect(field).toHaveFocus();
  });

  it("moves focus to the next toast when a dismissal leaves one", () => {
    render(
      <>
        <Problem message="disk full" />
        <Problem field="Silver" message="disk full" />
        <SaveToasts />
      </>,
    );
    const dismiss = screen.getByRole("button", { name: "Dismiss Gold" });
    dismiss.focus();

    fireEvent.click(dismiss);

    expect(screen.getByRole("button", { name: "Dismiss Silver" })).toHaveFocus();
  });

  it("draws only in the viewport mounted last, as a modal's is over the page's", () => {
    const { rerender } = render(
      <>
        <Problem message="disk full" />
        <SaveToasts />
        <SaveToasts />
      </>,
    );
    const [page, modal] = regions() as [HTMLElement, HTMLElement];
    expect(page).toBeEmptyDOMElement();
    expect(within(modal).getByText("Gold: disk full")).toBeInTheDocument();

    rerender(
      <>
        <Problem message="disk full" />
        <SaveToasts />
      </>,
    );
    expect(within(regions()[0] as HTMLElement).getByText("Gold: disk full")).toBeInTheDocument();
  });
});
