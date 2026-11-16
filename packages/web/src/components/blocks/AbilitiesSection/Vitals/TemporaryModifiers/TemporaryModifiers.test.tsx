import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderVitals } from "../renderVitals.tsx";

const card = () => within(screen.getByRole("region", { name: "Temporary Modifiers" }));
const announced = () =>
  card()
    .getAllByRole("status")
    .find((region) => region.className === "sr-only");

const curse = { name: "Curse", target: { kind: "armorClass" as const }, amount: -1, endsOn: null };

afterEach(() => vi.unstubAllGlobals());

async function fill(name: string, amount: string) {
  fireEvent.change(await screen.findByRole("textbox", { name: "Modifier name" }), {
    target: { value: name },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Modifier amount" }), {
    target: { value: amount },
  });
}

function pick(field: string, option: string) {
  fireEvent.click(card().getByRole("combobox", { name: field }));
  fireEvent.click(screen.getByRole("option", { name: option }));
}

describe("Temporary Modifiers", () => {
  it("says none are held", async () => {
    renderVitals({});
    expect(await screen.findByText("No temporary modifiers.")).toBeInTheDocument();
  });

  it("adds a named, signed modifier in one write and announces it", async () => {
    const { writes } = renderVitals({});
    await fill("Curse", "-1");
    fireEvent.click(card().getByRole("button", { name: "Add modifier" }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.temporaryModifiers).toEqual([curse]);
    expect(await card().findByText("Curse -1 Armor class")).toBeInTheDocument();
    expect(announced()).toHaveTextContent("Curse -1 Armor class added");
    expect(screen.getByRole("textbox", { name: "Modifier name" })).toHaveValue("");
  });

  it("adds from the keyboard, to a saving throw, ending on a long rest", async () => {
    const { writes } = renderVitals({});
    await fill("Bless", "+2");
    pick("Applies to", "Dexterity saving throw");
    pick("Lasts", "Ends on a long rest");
    fireEvent.submit(screen.getByRole("textbox", { name: "Modifier amount" }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.temporaryModifiers).toEqual([
      { name: "Bless", target: { kind: "save", ability: "dex" }, amount: 2, endsOn: "long" },
    ]);
  });

  it("refuses a blank name, an amount that is not a whole number, and 0, writing nothing", async () => {
    const { writes } = renderVitals({});
    await fill("", "-1");
    fireEvent.click(card().getByRole("button", { name: "Add modifier" }));
    expect(await screen.findByText("Enter a name.")).toBeInTheDocument();

    await fill("Curse", "0");
    fireEvent.click(card().getByRole("button", { name: "Add modifier" }));
    expect(
      await screen.findByText("The amount is a whole number other than 0."),
    ).toBeInTheDocument();

    await fill("Curse", "1.5");
    fireEvent.click(card().getByRole("button", { name: "Add modifier" }));
    expect(writes).toHaveLength(0);
  });

  it("refuses the name a maximum reduction carries", async () => {
    const { writes } = renderVitals({});
    await fill("Maximum reduction", "-2");
    fireEvent.click(card().getByRole("button", { name: "Add modifier" }));

    expect(
      await screen.findByText("Maximum reduction is reserved. Choose another name."),
    ).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("refuses a modifier of the same name on the same value", async () => {
    const { writes } = renderVitals({ temporaryModifiers: [curse] });
    await fill("curse", "-2");
    fireEvent.click(card().getByRole("button", { name: "Add modifier" }));

    expect(await screen.findByText("curse already modifies Armor class.")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("lists a held modifier with when it ends, and removes it in one write, announced", async () => {
    const { writes } = renderVitals({
      temporaryModifiers: [{ ...curse, endsOn: "short" }],
    });
    expect(await screen.findByText("until a rest")).toBeInTheDocument();
    fireEvent.click(card().getByRole("button", { name: "Remove Curse -1 Armor class" }));

    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]?.temporaryModifiers).toEqual([]);
    expect(announced()).toHaveTextContent("Curse -1 Armor class removed");
  });

  it("names a write that failed and keeps the modifier held", async () => {
    renderVitals({ temporaryModifiers: [curse] }, { fail: true });
    fireEvent.click(await screen.findByRole("button", { name: "Remove Curse -1 Armor class" }));

    expect(await screen.findByText(/Temporary modifiers were not changed/)).toBeInTheDocument();
    expect(card().getByRole("alert")).toHaveTextContent(
      "Temporary modifiers were not changed: Disk full, write 1",
    );
    expect(card().getByText("Curse -1 Armor class")).toBeInTheDocument();
  });
});
