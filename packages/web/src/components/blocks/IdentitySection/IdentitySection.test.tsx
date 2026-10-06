import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../hooks/characterKeys.ts";
import { characterRecord, identityRecord } from "../../../test/records.ts";
import { stubFetch } from "../../../test/stubFetch.ts";
import { IdentitySection } from "./IdentitySection.tsx";

const chips = (card: string) =>
  within(screen.getByRole("region", { name: card }))
    .queryAllByRole("listitem")
    .map((item) => item.textContent);

/** Renders `ui` with the character in the detail cache, where an edit reads it from. */
function renderSeeded(ui: ReactElement, character = identityRecord()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(characterKey(character.id), character);
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => vi.unstubAllGlobals());

describe("IdentitySection", () => {
  it("shows race, each class and background as chips, with the total level", () => {
    renderSeeded(<IdentitySection character={identityRecord()} />);

    expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("Vex");
    expect(chips("Race")).toEqual(["Elf (High)"]);
    expect(chips("Class")).toEqual(["Warlock 2 (Fiend Patron)", "Fighter 1"]);
    expect(screen.getByRole("region", { name: "Class" })).toHaveTextContent("Total level: 3");
    expect(chips("Background")).toEqual(["Charlatan"]);
  });

  it("shows languages and each proficiency list apart, leaving out a tool held at none", () => {
    renderSeeded(<IdentitySection character={identityRecord()} />);

    expect(chips("Languages")).toEqual(["Common", "Elvish"]);
    expect(chips("Proficiencies")).toEqual([
      "Light",
      "Shield",
      "Simple",
      "Light",
      "Thieves' Tools (expertise)",
      "Herbalism Kit",
    ]);
  });

  it("says so where a list is empty", () => {
    renderSeeded(<IdentitySection character={characterRecord("1", "Vex")} />);

    expect(screen.getByRole("region", { name: "Languages" })).toHaveTextContent("No languages.");
    const proficiencies = screen.getByRole("region", { name: "Proficiencies" });
    expect(proficiencies).toHaveTextContent("No armor.");
    expect(proficiencies).toHaveTextContent("No weapons.");
    expect(proficiencies).toHaveTextContent("No tools.");
  });

  it("saves a renamed character and leaves the rest of the definition as it was", async () => {
    const fetchMock = stubFetch(
      new Response(JSON.stringify(characterRecord("1", "Nyx")), { status: 200 }),
    );
    renderSeeded(<IdentitySection character={identityRecord()} />);

    const name = screen.getByRole("textbox", { name: "Name" });
    fireEvent.change(name, { target: { value: "Nyx" } });
    fireEvent.blur(name);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/characters/1");
    expect(JSON.parse(String(init?.body))).toEqual({ ...identityRecord().definition, name: "Nyx" });
  });

  it("refuses an empty name on the field and keeps it unsaved", async () => {
    const fetchMock = stubFetch(new Response("{}"));
    renderSeeded(<IdentitySection character={identityRecord()} />);

    const name = screen.getByRole("textbox", { name: "Name" });
    fireEvent.change(name, { target: { value: "" } });
    fireEvent.blur(name);

    expect(await screen.findByRole("alert")).toHaveTextContent("A character needs a name.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows each appearance field, an unset one reading as not set", () => {
    const record = identityRecord();
    record.definition.appearance = { age: "24", eyes: "green" };
    renderSeeded(<IdentitySection character={record} />, record);

    const field = (label: string) => screen.getByRole("textbox", { name: label });
    expect(field("Age")).toHaveValue("24");
    expect(field("Eyes")).toHaveValue("green");
    for (const label of ["Height", "Weight", "Skin", "Hair"]) {
      expect(field(label)).toHaveValue("");
      expect(field(label)).toHaveAttribute("placeholder", "Not set");
    }
  });

  it("saves an appearance field, trimmed, beside the others", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify(identityRecord()), { status: 200 }));
    const record = identityRecord();
    record.definition.appearance = { age: "24" };
    renderSeeded(<IdentitySection character={record} />, record);

    const hair = screen.getByRole("textbox", { name: "Hair" });
    fireEvent.change(hair, { target: { value: " black " } });
    fireEvent.blur(hair);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.appearance).toEqual({ age: "24", hair: "black" });
  });

  it("clears an appearance field to unset rather than to an empty string", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify(identityRecord()), { status: 200 }));
    const record = identityRecord();
    record.definition.appearance = { age: "24", hair: "black" };
    renderSeeded(<IdentitySection character={record} />, record);

    const hair = screen.getByRole("textbox", { name: "Hair" });
    fireEvent.change(hair, { target: { value: "  " } });
    fireEvent.blur(hair);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(body.appearance).toEqual({ age: "24" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an appearance value an undo restores, and unsets one an undo removes", () => {
    const client = new QueryClient();
    const at = (appearance: Record<string, string>) => {
      const record = identityRecord();
      record.definition.appearance = appearance;
      return (
        <QueryClientProvider client={client}>
          <IdentitySection character={record} />
        </QueryClientProvider>
      );
    };
    const { rerender } = render(at({ hair: "black" }));
    rerender(at({ hair: "red", age: "24" }));
    expect(screen.getByRole("textbox", { name: "Hair" })).toHaveValue("red");
    expect(screen.getByRole("textbox", { name: "Age" })).toHaveValue("24");

    rerender(at({ hair: "red" }));
    expect(screen.getByRole("textbox", { name: "Age" })).toHaveValue("");
  });

  it("waits on the character", () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <IdentitySection character={undefined} />
      </QueryClientProvider>,
    );
    expect(screen.getByText("Identity isn't available yet.")).toBeInTheDocument();
  });
});
