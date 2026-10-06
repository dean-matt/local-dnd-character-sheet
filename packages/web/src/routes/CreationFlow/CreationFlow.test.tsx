import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { characterRecord } from "../../test/records.ts";
import { stubFetch } from "../../test/stubFetch.ts";
import { CreationFlow } from "./CreationFlow.tsx";

const KEY = "draft:creation";
const vex = characterRecord("7", "Vex");

function Location() {
  return <p data-testid="location">{useLocation().pathname}</p>;
}

function renderFlow(path = "/characters/new") {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/characters/new/:step?" element={<CreationFlow />} />
          <Route path="*" element={null} />
        </Routes>
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const location = () => screen.getByTestId("location").textContent;
const rail = () => screen.getByRole("navigation", { name: "Creation steps" });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

describe("CreationFlow", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("opens on the first step and walks forward and back, the rail marking where you are", async () => {
    renderFlow();

    expect(await screen.findByRole("heading", { level: 1, name: "Identity" })).toBeVisible();
    expect(screen.getByText("Step 1 of 5")).toBeVisible();
    expect(within(rail()).getByRole("link", { name: /Identity/ })).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();

    click("Next: Class →");
    expect(await screen.findByRole("heading", { level: 1, name: "Class" })).toBeVisible();
    expect(location()).toBe("/characters/new/class");

    click("Back");
    expect(await screen.findByRole("heading", { level: 1, name: "Identity" })).toBeVisible();
  });

  it("jumps to any step from the rail, and ends on Finish", async () => {
    renderFlow();

    fireEvent.click(within(rail()).getByRole("link", { name: /Spells/ }));

    expect(await screen.findByText("Step 5 of 5")).toBeVisible();
    expect(screen.getByRole("button", { name: "Finish →" })).toHaveAttribute("type", "submit");
    expect(screen.queryByRole("button", { name: /^Next/ })).not.toBeInTheDocument();
  });

  it("refuses an unfinished character at Finish, naming each fault and the step that holds it", async () => {
    const fetchMock = stubFetch(new Response(null, { status: 500 }));
    renderFlow("/characters/new/spells");

    click("Finish →");

    const faults = await screen.findByRole("alert");
    expect(within(faults).getByText(/A character needs a name\./)).toBeVisible();
    const [toIdentity] = within(faults).getAllByRole("link", { name: "Go to Identity" });
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.click(toIdentity as HTMLElement);
    expect(await screen.findByRole("heading", { level: 1, name: "Identity" })).toBeVisible();
  });

  it("creates the character the draft holds, opens its sheet and clears the draft", async () => {
    localStorage.setItem(KEY, JSON.stringify(vex.definition));
    const fetchMock = stubFetch(new Response(JSON.stringify(vex), { status: 201 }));
    renderFlow("/characters/new/spells");

    click("Finish →");

    await waitFor(() => expect(location()).toBe("/characters/7"));
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe("/api/characters");
    expect(JSON.parse(init.body)).toEqual(vex.definition);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("keeps the draft and says why when the write fails", async () => {
    localStorage.setItem(KEY, JSON.stringify(vex.definition));
    stubFetch(new Response(JSON.stringify({ error: "the disk is full" }), { status: 500 }));
    renderFlow("/characters/new/spells");

    click("Finish →");

    expect(await screen.findByText("the disk is full")).toBeVisible();
    expect(location()).toBe("/characters/new/spells");
    expect(JSON.parse(localStorage.getItem(KEY) ?? "null")).toEqual(vex.definition);
  });

  it("shows a departure from the rules on the step that sets the value", async () => {
    const departure = { field: "abilityScores.str", note: "20 at level 1, past point buy" };
    localStorage.setItem(KEY, JSON.stringify({ ...vex.definition, departures: [departure] }));
    renderFlow("/characters/new/identity");

    await screen.findByRole("heading", { level: 1, name: "Identity" });
    expect(screen.queryByRole("region", { name: "Off the rules" })).not.toBeInTheDocument();

    fireEvent.click(within(rail()).getByRole("link", { name: /Ability Scores/ }));
    const offBook = await screen.findByRole("region", { name: "Off the rules" });
    expect(within(offBook).getByText(departure.note)).toBeVisible();
  });

  it("says so when the draft holds what no character can store", async () => {
    localStorage.setItem(KEY, JSON.stringify({ ...vex.definition, retired: true }));
    const fetchMock = stubFetch(new Response(null, { status: 500 }));
    renderFlow("/characters/new/spells");

    click("Finish →");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The draft holds something a character cannot store.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("discards the draft on Cancel and returns to the list", async () => {
    localStorage.setItem(KEY, JSON.stringify({ name: "Vex" }));
    renderFlow();

    click("Cancel");

    await waitFor(() => expect(location()).toBe("/characters"));
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
