import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AddedToast } from "./AddedToast.tsx";

const ADDED_TOAST_MS = 5000;

afterEach(() => {
  vi.useRealTimers();
});

describe("AddedToast", () => {
  it("shows the text and note, in the error colour on a failure", () => {
    render(
      <AddedToast outcome={{ text: "Nope.", note: "Why.", failed: true }} onDismiss={vi.fn()} />,
    );
    expect(screen.getByRole("status", { name: "Last addition" })).toHaveTextContent("Nope.Why.");
    expect(screen.getByText("Nope.")).toHaveClass("text-error");
  });

  it("goes after a few seconds, and on dismiss", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<AddedToast outcome={{ text: "Added." }} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(ADDED_TOAST_MS));
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it("restarts its timer when a later outcome replaces it", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { rerender } = render(<AddedToast outcome={{ text: "One." }} onDismiss={onDismiss} />);
    act(() => vi.advanceTimersByTime(ADDED_TOAST_MS - 1));
    rerender(<AddedToast outcome={{ text: "Two." }} onDismiss={onDismiss} />);
    act(() => vi.advanceTimersByTime(ADDED_TOAST_MS - 1));
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByText("Two.")).toBeInTheDocument();
  });
});
