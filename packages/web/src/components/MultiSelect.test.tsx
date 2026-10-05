import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { MultiSelect, type MultiSelectOption } from "./MultiSelect.tsx";

const SOURCES: MultiSelectOption[] = [
  { value: "PHB", label: "PHB · Player's Handbook", short: "PHB" },
  { value: "XGE", label: "XGE · Xanathar's Guide to Everything", short: "XGE" },
  { value: "TCE", label: "TCE · Tasha's Cauldron of Everything", short: "TCE" },
  ...Array.from({ length: 9 }, (_, i) => ({ value: `S${i}`, label: `Source ${i}` })),
];
const RARITIES: MultiSelectOption[] = [
  { value: "rare", label: "Rare" },
  { value: "very rare", label: "Very rare" },
  { value: "unknown (magic)", label: "Unknown (magic)" },
];

function Harness({ options, initial = [] }: { options: MultiSelectOption[]; initial?: string[] }) {
  const [selected, setSelected] = useState(initial);
  return (
    <MultiSelect
      label="Source"
      noun="sources"
      options={options}
      selected={selected}
      onChange={setSelected}
    />
  );
}

const button = () => screen.getByRole("button", { name: /^Source / });
const open = () => {
  fireEvent.click(button());
  return screen.getByRole("group", { name: "Sources to search" });
};

describe("MultiSelect", () => {
  it.each([
    [[], "All sources"],
    [["PHB"], "PHB"],
    [["PHB", "XGE"], "PHB, XGE"],
    [["PHB", "XGE", "TCE"], "3 sources"],
    [["S1"], "Source 1"],
  ])("sums up %j on the button as %s", (initial, text) => {
    render(<Harness options={SOURCES} initial={initial} />);
    expect(button()).toHaveAccessibleName(`Source ${text}`);
  });

  it("counts two names too long to join", () => {
    render(<Harness options={RARITIES} initial={["very rare", "unknown (magic)"]} />);
    expect(button()).toHaveAccessibleName("Source 2 sources");
  });

  it("opens a long list with a focused filter that narrows by value or label", () => {
    render(<Harness options={SOURCES} />);
    const list = open();
    const filter = within(list).getByRole("searchbox", { name: "Filter sources" });
    expect(filter).toHaveFocus();

    fireEvent.change(filter, { target: { value: "xge" } });
    expect(
      within(list)
        .getAllByRole("checkbox")
        .map((box) => box.closest("label")?.textContent),
    ).toEqual(["XGE · Xanathar's Guide to Everything"]);
    fireEvent.change(filter, { target: { value: "EVERYTHING" } });
    expect(within(list).getAllByRole("checkbox")).toHaveLength(2);
    fireEvent.change(filter, { target: { value: "zzz" } });
    expect(within(list).queryAllByRole("checkbox")).toHaveLength(0);
    expect(list).toHaveTextContent('No sources match "zzz".');
  });

  it("lists the values chosen before it opened first, and keeps a row in place when ticked", () => {
    render(<Harness options={SOURCES} initial={["TCE"]} />);
    const list = open();
    const names = () =>
      within(list)
        .getAllByRole("checkbox")
        .map((box) => box.closest("label")?.textContent);
    expect(names().slice(0, 3)).toEqual([
      "TCE · Tasha's Cauldron of Everything",
      "PHB · Player's Handbook",
      "XGE · Xanathar's Guide to Everything",
    ]);
    fireEvent.click(
      within(list).getByRole("checkbox", { name: "TCE · Tasha's Cauldron of Everything" }),
    );
    expect(names()[0]).toBe("TCE · Tasha's Cauldron of Everything");
  });

  it("leaves a short list without a filter", () => {
    render(<Harness options={RARITIES} />);
    expect(within(open()).queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("offers Clear beside the heading only while a value is chosen, and clears them all", () => {
    render(<Harness options={SOURCES} initial={["PHB", "XGE"]} />);
    const list = open();
    fireEvent.click(screen.getByRole("button", { name: "Clear sources" }));
    expect(button()).toHaveAccessibleName("Source All sources");
    expect(
      within(list).getByRole("checkbox", { name: "PHB · Player's Handbook" }),
    ).not.toBeChecked();
    expect(screen.queryByRole("button", { name: "Clear sources" })).not.toBeInTheDocument();
    expect(button()).toHaveFocus();
    expect(list).not.toContainElement(screen.queryByText("Clear"));
  });

  it("marks an option's hint with an icon and adds it to the row's name", () => {
    render(
      <Harness
        options={[
          { value: "spell", label: "Spells", hint: "adds level and school filters" },
          { value: "monster", label: "Monsters" },
        ]}
      />,
    );
    const list = open();
    const spells = within(list).getByRole("checkbox", {
      name: "Spells (adds level and school filters)",
    });
    expect(spells.closest("label")?.querySelector("[title]")).toHaveAttribute(
      "title",
      "adds level and school filters",
    );
    expect(
      within(list)
        .getByRole("checkbox", { name: "Monsters" })
        .closest("label")
        ?.querySelector("svg"),
    ).toBeNull();
  });

  it("moves through the shown checkboxes by arrow key, and closes on Escape to the button", () => {
    render(<Harness options={SOURCES} />);
    const list = open();
    const filter = within(list).getByRole("searchbox");
    fireEvent.change(filter, { target: { value: "every" } });
    const [xge, tce] = within(list).getAllByRole("checkbox");

    fireEvent.keyDown(filter, { key: "ArrowDown" });
    expect(xge).toHaveFocus();
    fireEvent.keyDown(xge as HTMLElement, { key: "ArrowDown" });
    expect(tce).toHaveFocus();
    fireEvent.keyDown(tce as HTMLElement, { key: "ArrowDown" });
    expect(xge).toHaveFocus();
    fireEvent.keyDown(xge as HTMLElement, { key: "ArrowUp" });
    expect(tce).toHaveFocus();

    fireEvent.keyDown(tce as HTMLElement, { key: "Escape" });
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(button()).toHaveFocus();
  });

  it("ticks a row clicked on its text and keeps the list open", () => {
    render(<Harness options={RARITIES} />);
    const list = open();
    // A press on a label's text moves focus to the list itself, not to the checkbox.
    act(() => list.focus());
    fireEvent.click(within(list).getByText("Very rare"));
    expect(within(list).getByRole("checkbox", { name: "Very rare" })).toBeChecked();
    expect(screen.getByRole("group", { name: "Sources to search" })).toBeInTheDocument();
    expect(button()).toHaveAccessibleName("Source Very rare");
  });

  it("closes when focus leaves it", () => {
    render(
      <>
        <Harness options={RARITIES} />
        <button type="button">Elsewhere</button>
      </>,
    );
    open();
    act(() => button().focus());
    act(() => screen.getByRole("button", { name: "Elsewhere" }).focus());
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });
});
