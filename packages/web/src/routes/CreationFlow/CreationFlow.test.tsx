import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { characterRecord } from "../../test/records.ts";
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

const page = (items: unknown[]) => ({ items, total: items.length, limit: 200, offset: 0 });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

/**
 * Stubs the API the flow reads: `write` answers the POST that creates the character, each
 * URL in `catalog` its own body, and any other list an empty page. A row read no URL names
 * is a 404.
 */
function stubApi(
  write = () => json({ error: "no write expected" }, 500),
  catalog: Record<string, unknown> = {},
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "POST") return write();
    if (url in catalog) return json(catalog[url]);
    if (/\/(search|backgrounds)\?|\/subraces\?/.test(url)) return json(page([]));
    return json({ error: `nothing at ${url}` }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const writes = (fetchMock: ReturnType<typeof stubApi>) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");

const location = () => screen.getByTestId("location").textContent;
const rail = () => screen.getByRole("navigation", { name: "Creation steps" });
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole("button", { name }));

describe("CreationFlow", () => {
  beforeEach(() => {
    localStorage.clear();
    stubApi();
  });
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
    const fetchMock = stubApi();
    renderFlow("/characters/new/spells");

    click("Finish →");

    const faults = await screen.findByRole("alert");
    expect(within(faults).getByText(/A character needs a name\./)).toBeVisible();
    const [toIdentity] = within(faults).getAllByRole("link", { name: "Go to Identity" });
    expect(writes(fetchMock)).toEqual([]);

    fireEvent.click(toIdentity as HTMLElement);
    expect(await screen.findByRole("heading", { level: 1, name: "Identity" })).toBeVisible();
  });

  it("creates the character the draft holds, opens its sheet and clears the draft", async () => {
    localStorage.setItem(KEY, JSON.stringify(vex.definition));
    const fetchMock = stubApi(() => json(vex, 201));
    renderFlow("/characters/new/spells");

    click("Finish →");

    await waitFor(() => expect(location()).toBe("/characters/7"));
    const [url, init] = writes(fetchMock)[0] ?? [];
    expect(url).toBe("/api/characters");
    expect(JSON.parse(String(init?.body))).toEqual(vex.definition);
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("keeps the draft and says why when the write fails", async () => {
    localStorage.setItem(KEY, JSON.stringify(vex.definition));
    stubApi(() => json({ error: "the disk is full" }, 500));
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
    const fetchMock = stubApi();
    renderFlow("/characters/new/spells");

    click("Finish →");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The draft holds something a character cannot store.",
    );
    expect(writes(fetchMock)).toEqual([]);
  });

  it("marks Identity done while its choices are complete, and not once an edit undoes one", async () => {
    const halfElf = { name: "Half-Elf", source: "XPHB" };
    stubApi(undefined, {
      "/api/races/Half-Elf/XPHB": {
        ...halfElf,
        edition: "one",
        json: { ...halfElf, size: ["M"], speed: 30 },
      },
    });
    localStorage.setItem(KEY, JSON.stringify(vex.definition));
    renderFlow("/characters/new/class");

    const identity = within(rail()).getByRole("link", { name: /Identity/ });
    await waitFor(() => expect(identity).toHaveTextContent("Identity, done"));
    expect(within(rail()).getByRole("link", { name: /Class/ })).not.toHaveTextContent("done");

    fireEvent.click(identity);
    fireEvent.change(await screen.findByRole("textbox", { name: "Name" }), {
      target: { value: "" },
    });
    await waitFor(() => expect(identity).not.toHaveTextContent("done"));
  });

  it("discards the draft on Cancel and returns to the list", async () => {
    localStorage.setItem(KEY, JSON.stringify({ name: "Vex" }));
    renderFlow();

    click("Cancel");

    await waitFor(() => expect(location()).toBe("/characters"));
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
