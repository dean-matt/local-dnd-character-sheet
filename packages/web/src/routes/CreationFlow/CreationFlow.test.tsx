import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, Link, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { characterRecord } from "../../test/records.ts";
import { CreationFlow } from "./CreationFlow.tsx";
import type { CreationStep } from "./creationSteps.ts";

const KEY = "draft:creation";
const vex = characterRecord("7", "Vex");

/**
 * Mounts the flow beside a stand-in list, reached first so browser Back has somewhere to
 * go. `step` marks the flow's entry as a reload of that step would find it.
 */
let router: ReturnType<typeof createMemoryRouter>;

function renderFlow(step?: CreationStep["slug"]) {
  router = createMemoryRouter(
    [
      { path: "/characters/new", element: <CreationFlow /> },
      { path: "/characters", element: <Link to="/characters/new">New Character</Link> },
      { path: "*", element: null },
    ],
    {
      initialEntries: ["/characters", { pathname: "/characters/new", state: step && { step } }],
    },
  );
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
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

const location = () => router.state.location.pathname;
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
    expect(screen.getByText("New character · Step 1 of 5")).toBeVisible();
    expect(within(rail()).getByRole("link", { name: /Identity/ })).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();

    click("Next: Class →");
    expect(await screen.findByRole("heading", { level: 1, name: "Class" })).toBeVisible();
    expect(location()).toBe("/characters/new");

    click("Back");
    expect(await screen.findByRole("heading", { level: 1, name: "Identity" })).toBeVisible();
  });

  it("jumps to any step from the rail, and ends on Finish", async () => {
    renderFlow();

    fireEvent.click(within(rail()).getByRole("link", { name: /Spells/ }));

    expect(await screen.findByText("New character · Step 5 of 5")).toBeVisible();
    expect(screen.getByRole("button", { name: "Finish →" })).toHaveAttribute("type", "submit");
    expect(screen.queryByRole("button", { name: /^Next/ })).not.toBeInTheDocument();
  });

  it("refuses an unfinished character at Finish, naming each fault and the step that holds it", async () => {
    const fetchMock = stubApi();
    renderFlow("spells");

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
    renderFlow("spells");

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
    renderFlow("spells");

    click("Finish →");

    expect(await screen.findByText("the disk is full")).toBeVisible();
    expect(location()).toBe("/characters/new");
    expect(JSON.parse(localStorage.getItem(KEY) ?? "null")).toEqual(vex.definition);
  });

  it("shows a departure from the rules on the step that sets the value", async () => {
    const departure = { field: "abilityScores.str", note: "20 at level 1, past point buy" };
    localStorage.setItem(KEY, JSON.stringify({ ...vex.definition, departures: [departure] }));
    renderFlow("identity");

    await screen.findByRole("heading", { level: 1, name: "Identity" });
    expect(screen.queryByRole("region", { name: "Off the rules" })).not.toBeInTheDocument();

    fireEvent.click(within(rail()).getByRole("link", { name: /Ability Scores/ }));
    const offBook = await screen.findByRole("region", { name: "Off the rules" });
    expect(within(offBook).getByText(departure.note)).toBeVisible();
  });

  it("says so when the draft holds what no character can store", async () => {
    localStorage.setItem(KEY, JSON.stringify({ ...vex.definition, retired: true }));
    const fetchMock = stubApi();
    renderFlow("spells");

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
    renderFlow("class");

    const identity = within(rail()).getByRole("link", { name: /Identity/ });
    await waitFor(() => expect(identity).toHaveTextContent("Identity, done"));
    expect(within(rail()).getByRole("link", { name: /Class/ })).not.toHaveTextContent("done");

    fireEvent.click(identity);
    fireEvent.change(await screen.findByRole("textbox", { name: "Name" }), {
      target: { value: "" },
    });
    await waitFor(() => expect(identity).not.toHaveTextContent("done"));
  });

  it("marks Class done until a level reaches the subclass with none chosen", async () => {
    const warlock = { name: "Warlock", source: "XPHB" };
    const gains = { classFeature: "Warlock Subclass|Warlock|XPHB|3", gainSubclassFeature: true };
    stubApi(undefined, {
      "/api/classes/Warlock/XPHB": {
        ...warlock,
        edition: "one",
        hitDie: 8,
        json: { ...warlock, classFeatures: [gains] },
      },
      "/api/classes/Warlock/XPHB/subclasses?edition=one&limit=200": page([
        {
          name: "Fiend Patron",
          source: "XPHB",
          shortName: "Fiend",
          className: "Warlock",
          classSource: "XPHB",
          edition: "one",
          json: { name: "Fiend Patron", source: "XPHB" },
        },
      ]),
    });
    localStorage.setItem(KEY, JSON.stringify(vex.definition));
    renderFlow("class");

    const step = within(rail()).getByRole("link", { name: /Class/ });
    await waitFor(() => expect(step).toHaveTextContent("Class, done"));

    fireEvent.change(screen.getByRole("spinbutton", { name: "Level" }), {
      target: { value: "3" },
    });
    await waitFor(() => expect(step).not.toHaveTextContent("done"));

    click("Fiend Patron");
    await waitFor(() => expect(step).toHaveTextContent("Class, done"));
  });

  it("discards the draft on leaving, so New Character opens empty", async () => {
    renderFlow();
    const name = await screen.findByRole("textbox", { name: "Name" });
    fireEvent.change(name, { target: { value: "Vex" } });

    await act(() => router.navigate("/characters"));
    expect(localStorage.getItem(KEY)).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "New Character" }));

    expect(await screen.findByRole("textbox", { name: "Name" })).toHaveValue("");
    expect(screen.getByText("New character · Step 1 of 5")).toBeVisible();
  });

  it("starts empty over a draft a full-page departure left behind", async () => {
    localStorage.setItem(KEY, JSON.stringify({ name: "Vex" }));
    renderFlow();

    expect(await screen.findByRole("textbox", { name: "Name" })).toHaveValue("");
  });

  it("keeps the draft and the step across a reload", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const { unmount } = renderFlow();
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Vex" },
    });
    click("Next: Class →");
    fireEvent(window, new Event("pagehide"));
    const entry = router.state.location;
    const draft = localStorage.getItem(KEY);
    vi.useRealTimers();

    // A reload unloads the page without unmounting it, so the unmount's discard is undone.
    unmount();
    localStorage.setItem(KEY, draft ?? "");
    router = createMemoryRouter([{ path: "/characters/new", element: <CreationFlow /> }], {
      initialEntries: [entry],
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { level: 1, name: "Class" })).toBeVisible();
    fireEvent.click(within(rail()).getByRole("link", { name: /Identity/ }));
    expect(await screen.findByRole("textbox", { name: "Name" })).toHaveValue("Vex");
  });

  it("leaves the flow on browser Back rather than stepping back through it", async () => {
    renderFlow();
    click("Next: Class →");
    click("Next: Ability Scores →");
    await screen.findByRole("heading", { level: 1, name: "Ability Scores" });

    await act(() => router.navigate(-1));

    expect(location()).toBe("/characters");
  });

  it("collapses the rail to step numbers that keep their names, with nothing above them, sharing the sidebar's choice", () => {
    localStorage.setItem("sidebar-collapsed", "true");
    renderFlow("identity");

    const toggle = screen.getByRole("button", { name: "Expand sidebar" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(rail().previousElementSibling).toBeNull();
    expect(rail().firstElementChild?.tagName).toBe("OL");
    expect(within(rail()).getByRole("link", { name: "Class" })).toHaveTextContent("2");

    fireEvent.click(toggle);

    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(rail().previousElementSibling).toBeNull();
    expect(rail().firstElementChild?.tagName).toBe("OL");
    expect(localStorage.getItem("sidebar-collapsed")).toBe("false");
  });

  it("pins Cancel, Back and Next in a footer below the step's content, which scrolls alone", () => {
    renderFlow("identity");

    const footer = screen.getByRole("button", { name: "Cancel" }).parentElement;
    expect(footer).toHaveAttribute("data-creation-footer");
    expect(footer).toHaveClass("tall:sticky", "bottom-0", "bg-canvas");
    expect(within(footer as HTMLElement).getByRole("button", { name: "Back" })).toBeVisible();
    expect(within(footer as HTMLElement).getByRole("button", { name: /^Next/ })).toBeVisible();
    expect(footer?.previousElementSibling).toContainElement(
      screen.getByRole("heading", { level: 1, name: "Identity" }),
    );
    expect(footer?.nextElementSibling).toBeNull();
  });

  it("discards the draft on Cancel and returns to the list", async () => {
    localStorage.setItem(KEY, JSON.stringify({ name: "Vex" }));
    renderFlow("identity");

    expect(screen.getByRole("button", { name: "Cancel" }).closest("aside")).toBeNull();
    click("Cancel");

    await waitFor(() => expect(location()).toBe("/characters"));
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
