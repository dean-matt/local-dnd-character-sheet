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
const announced = (region: HTMLElement) => region.querySelector("[aria-live]")?.textContent;
const expectEmpty = (region: HTMLElement) => {
  expect(region.childElementCount).toBe(1);
  expect(region.querySelector("[aria-live]")).toBeEmptyDOMElement();
};

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
    expect(screen.queryByRole("button", { name: /^Retry / })).not.toBeInTheDocument();

    rerender(
      <>
        <Problem />
        <SaveToasts />
      </>,
    );
    expectEmpty(screen.getByRole("region", { name: "Save problems" }));
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

    fireEvent.click(screen.getByRole("button", { name: /^Retry / }));
    expect(latest).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss Gold" }));
    expect(screen.queryByText("Gold: disk full")).not.toBeInTheDocument();
  });

  it("stays, without Retry, when a field with a failed write unmounts", () => {
    const { rerender } = render(
      <>
        <Problem message="disk full" retry={() => {}} />
        <SaveToasts />
      </>,
    );
    rerender(<SaveToasts />);

    expect(screen.getByText("Gold: disk full")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry Gold" })).not.toBeInTheDocument();
  });

  it("goes with the field that raised refused text", () => {
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
    expectEmpty(page);
    expect(within(modal).getByText("Gold: disk full")).toBeInTheDocument();

    rerender(
      <>
        <Problem message="disk full" />
        <SaveToasts />
      </>,
    );
    expect(within(regions()[0] as HTMLElement).getByText("Gold: disk full")).toBeInTheDocument();
  });

  it("announces a toast once, however often a modal opens and closes over it", () => {
    const { rerender } = render(
      <>
        <Problem message="disk full" />
        <SaveToasts />
      </>,
    );
    expect(announced(regions()[0] as HTMLElement)).toBe("Gold: disk full");

    rerender(
      <>
        <Problem message="disk full" />
        <SaveToasts />
        <SaveToasts />
        <Problem field="Silver" message="disk full" retry={() => {}} />
      </>,
    );
    const modal = regions()[1] as HTMLElement;
    expect(modal).toHaveTextContent("Gold: disk full");
    expect(announced(modal)).toBe("Silver: disk fullRetry");

    rerender(
      <>
        <Problem message="disk full" />
        <SaveToasts />
      </>,
    );
    const page = regions()[0] as HTMLElement;
    expect(page).toHaveTextContent("Gold: disk full");
    expect(page).toHaveTextContent("Silver: disk full");
    expect(announced(page)).toBe("");
    expect(within(page).getByRole("button", { name: "Dismiss Silver" })).toBeInTheDocument();

    rerender(
      <>
        <Problem message="disk full" />
        <SaveToasts />
        <Problem field="Copper" message="disk full" />
      </>,
    );
    expect(announced(regions()[0] as HTMLElement)).toBe("Copper: disk full");
  });
});
