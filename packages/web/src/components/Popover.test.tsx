import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Popover } from "./Popover.tsx";

describe("Popover", () => {
  it("renders the trigger with the content closed", () => {
    render(
      <Popover trigger="+3" label="Strength modifier">
        Base 16, modifier +3
      </Popover>,
    );

    expect(screen.getByRole("button", { name: "+3" })).toBeInTheDocument();
    expect(screen.queryByText("Base 16, modifier +3")).not.toBeInTheDocument();
  });

  it("opens on hover", () => {
    render(
      <Popover trigger="+3" label="Strength modifier">
        Base 16, modifier +3
      </Popover>,
    );

    fireEvent.mouseEnter(screen.getByRole("button", { name: "+3" }).parentElement as HTMLElement);

    expect(screen.getByText("Base 16, modifier +3")).toBeInTheDocument();
  });

  it("opens on focus", () => {
    render(
      <Popover trigger="+3" label="Strength modifier">
        Base 16, modifier +3
      </Popover>,
    );

    fireEvent.focus(screen.getByRole("button", { name: "+3" }));

    expect(screen.getByText("Base 16, modifier +3")).toBeInTheDocument();
  });

  it("opens on tap and closes on a second tap", () => {
    render(
      <Popover trigger="+3" label="Strength modifier">
        Base 16, modifier +3
      </Popover>,
    );
    const trigger = screen.getByRole("button", { name: "+3" });

    fireEvent.click(trigger);
    expect(screen.getByText("Base 16, modifier +3")).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByText("Base 16, modifier +3")).not.toBeInTheDocument();
  });

  it("stays open through the mouseenter a real tap fires just before its click", () => {
    render(
      <Popover trigger="+3" label="Strength modifier">
        Base 16, modifier +3
      </Popover>,
    );
    const trigger = screen.getByRole("button", { name: "+3" });

    fireEvent.mouseEnter(trigger.parentElement as HTMLElement);
    fireEvent.click(trigger);

    expect(screen.getByText("Base 16, modifier +3")).toBeInTheDocument();
  });

  it("marks the trigger expanded only while open", () => {
    render(
      <Popover trigger="+3" label="Strength modifier">
        Base 16, modifier +3
      </Popover>,
    );
    const trigger = screen.getByRole("button", { name: "+3" });

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", screen.getByRole("group").id);
  });

  it("closes on Escape and returns focus to the trigger without scrolling it into view", () => {
    let preventScrollArg: boolean | undefined;
    const original = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function focus(this: HTMLElement, options?: FocusOptions) {
      preventScrollArg = options?.preventScroll;
      return original.call(this, options);
    };

    try {
      render(
        <Popover trigger="+3" label="Strength modifier">
          Base 16, modifier +3
        </Popover>,
      );
      const trigger = screen.getByRole("button", { name: "+3" });
      fireEvent.click(trigger);
      const content = screen.getByRole("group");

      fireEvent.keyDown(content, { key: "Escape" });

      expect(screen.queryByText("Base 16, modifier +3")).not.toBeInTheDocument();
      expect(document.activeElement).toBe(trigger);
      expect(preventScrollArg).toBe(true);
    } finally {
      HTMLElement.prototype.focus = original;
    }
  });

  it("closes when focus moves outside both the trigger and the content", () => {
    render(
      <div>
        <Popover trigger="+3" label="Strength modifier">
          Base 16, modifier +3
        </Popover>
        <button type="button">Elsewhere</button>
      </div>,
    );
    const trigger = screen.getByRole("button", { name: "+3" });
    fireEvent.focus(trigger);
    expect(screen.getByText("Base 16, modifier +3")).toBeInTheDocument();

    fireEvent.blur(trigger, { relatedTarget: screen.getByRole("button", { name: "Elsewhere" }) });

    expect(screen.queryByText("Base 16, modifier +3")).not.toBeInTheDocument();
  });

  it("does not close when focus moves from the trigger into its own content", () => {
    render(
      <Popover trigger="+3" label="Strength modifier">
        <a href="https://example.test">Strength</a>
      </Popover>,
    );
    const trigger = screen.getByRole("button", { name: "+3" });
    fireEvent.focus(trigger);
    const link = screen.getByRole("link", { name: "Strength" });

    fireEvent.blur(trigger, { relatedTarget: link });

    expect(screen.getByRole("link", { name: "Strength" })).toBeInTheDocument();
  });

  it("closes on a pointer down outside, with no click required inside it", () => {
    render(
      <div>
        <Popover trigger="+3" label="Strength modifier">
          Base 16, modifier +3
        </Popover>
        <div data-testid="outside">Outside</div>
      </div>,
    );
    fireEvent.mouseEnter(screen.getByRole("button", { name: "+3" }).parentElement as HTMLElement);
    expect(screen.getByText("Base 16, modifier +3")).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByTestId("outside"));

    expect(screen.queryByText("Base 16, modifier +3")).not.toBeInTheDocument();
  });

  it("keeps content reachable, in document order right after the trigger", () => {
    render(
      <Popover trigger="+3" label="Strength modifier">
        <a href="https://example.test">Strength (Ability Score Improvement)</a>
      </Popover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "+3" }));

    const trigger = screen.getByRole("button", { name: "+3" });
    const link = screen.getByRole("link", { name: "Strength (Ability Score Improvement)" });
    const position = trigger.compareDocumentPosition(link);
    expect(Boolean(position & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it("does not intercept Tab, leaving focus to move on natively", () => {
    render(
      <Popover trigger="+3" label="Strength modifier">
        <a href="https://example.test">Strength</a>
      </Popover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "+3" }));
    const content = screen.getByRole("group");

    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    content.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(screen.getByText("Strength")).toBeInTheDocument();
  });

  it("allows one level of nesting, exactly one term explaining itself", () => {
    render(
      <Popover trigger="+3" label="Strength modifier">
        Base 16 (
        <Popover trigger="Ability Score Improvement" label="Ability Score Improvement">
          Gained at 4th level.
        </Popover>
        )
      </Popover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "+3" }));

    const nested = screen.getByRole("button", { name: "Ability Score Improvement" });
    fireEvent.click(nested);

    expect(screen.getByText("Gained at 4th level.")).toBeInTheDocument();
  });

  it("renders a trigger past the nesting depth as inert text rather than opening a third layer", () => {
    render(
      <Popover trigger="+3" label="Strength modifier">
        <Popover trigger="Ability Score Improvement" label="Ability Score Improvement">
          From{" "}
          <Popover trigger="Fighter" label="Fighter">
            Never opens.
          </Popover>
        </Popover>
      </Popover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "+3" }));
    fireEvent.click(screen.getByRole("button", { name: "Ability Score Improvement" }));

    expect(screen.queryByRole("button", { name: "Fighter" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Ability Score Improvement" }).textContent).toContain(
      "Fighter",
    );
    expect(screen.queryByText("Never opens.")).not.toBeInTheDocument();
  });
});
