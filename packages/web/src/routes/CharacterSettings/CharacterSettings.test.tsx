import { defaultCharacterState, PRESET_PAGES } from "@dnd/character";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../hooks/characterKeys.ts";
import { characterRecord, presetPageRecords } from "../../test/records.ts";
import { CharacterSettings } from "./CharacterSettings.tsx";

function exportResponse(status: number) {
  return status === 500
    ? new Response(JSON.stringify({ error: "characters.db is locked" }), { status })
    : new Response(JSON.stringify(characterFile()), { status: 200 });
}

const GETS: Record<string, () => unknown> = {
  "/api/characters/1": () => characterRecord("1", "Vex"),
  "/api/characters/1/pages": presetPageRecords,
};

function stubFetch(status: number) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") {
      return status === 201
        ? new Response(JSON.stringify(characterRecord("2", "Vex (copy)")), { status })
        : new Response(JSON.stringify({ error: "disk full" }), { status });
    }
    if (init?.method === "DELETE") {
      return status === 204
        ? new Response(null, { status })
        : new Response(JSON.stringify({ error: "Could not back up characters.db" }), { status });
    }
    if (String(input) === "/api/characters/1/export") return exportResponse(status);
    const body = GETS[String(input)];
    return body
      ? new Response(JSON.stringify(body()), { status: 200 })
      : new Response(JSON.stringify({ error: "nothing here" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const characterFile = () => ({
  format: "local-dnd-character-sheet/character",
  version: 2,
  definition: characterRecord("1", "Vex").definition,
  state: defaultCharacterState(),
  pages: PRESET_PAGES,
});

const deletes = (fetchMock: ReturnType<typeof stubFetch>) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === "DELETE");

const press = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

const openDelete = () => press("Delete character");

function renderSettings(name = "Vex", portraitUpdatedAt: string | null = null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(["characters"], [characterRecord("1", name)]);
  queryClient.setQueryData(characterKey("1"), { ...characterRecord("1", name), portraitUpdatedAt });
  const router = createMemoryRouter(
    [
      { path: "/characters/:id/settings", element: <CharacterSettings /> },
      { path: "/characters/2", element: <p>copy</p> },
      { path: "/characters", element: <p>list</p> },
    ],
    { initialEntries: ["/characters/1/settings"] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CharacterSettings", () => {
  it("titles the page and lays out house rules, the portrait, the character file and the danger zone in order", () => {
    stubFetch(204);
    renderSettings();

    expect(
      screen.getByRole("heading", { level: 2, name: "Character settings" }),
    ).toBeInTheDocument();
    const sections = screen
      .getAllByRole("region")
      .map((region) => region.getAttribute("aria-labelledby"));
    const titles = sections.map((id) => document.getElementById(id ?? "")?.textContent);
    expect(titles).toEqual([
      "Character settings",
      "House rules",
      "Portrait",
      "Character file",
      "Danger zone",
    ]);
    const file = screen.getByRole("region", { name: "Character file" });
    expect(
      within(file)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Duplicate character", "Export character"]);
    expect(
      within(screen.getByRole("region", { name: "Danger zone" })).getByRole("button"),
    ).toHaveTextContent("Delete character");
  });

  it("removes the portrait, leaving the initial", async () => {
    const fetchMock = stubFetch(204);
    renderSettings("Vex", "2026-10-19T12:00:00.000Z");
    expect(screen.getByRole("region", { name: "Portrait" }).querySelector("img")).not.toBeNull();

    press("Remove portrait");

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Remove portrait" })).toBeNull(),
    );
    expect(deletes(fetchMock).map(([input]) => String(input))).toEqual([
      "/api/characters/1/portrait",
    ]);
    expect(screen.getByRole("region", { name: "Portrait" }).querySelector("img")).toBeNull();
  });

  it("says why when removing the portrait fails", async () => {
    stubFetch(500);
    renderSettings("Vex", "2026-10-19T12:00:00.000Z");

    press("Remove portrait");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Remove failed: Could not back up characters.db",
    );
  });

  it("returns focus to Delete character when the confirmation is cancelled", async () => {
    stubFetch(204);
    renderSettings();
    openDelete();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Delete character" })).toHaveFocus(),
    );
  });

  it("duplicates the character, then opens the copy", async () => {
    const fetchMock = stubFetch(201);
    const { router, queryClient } = renderSettings();

    press("Duplicate character");

    await screen.findByText("copy");
    expect(router.state.location.pathname).toBe("/characters/2");
    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts.map(([input]) => String(input))).toEqual(["/api/characters/1/duplicate"]);
    expect(queryClient.getQueryData(["characters", "2"])).toMatchObject({ name: "Vex (copy)" });
  });

  it("stays on the character and says why when the duplicate fails", async () => {
    stubFetch(500);
    const { router } = renderSettings();

    press("Duplicate character");

    expect(await screen.findByRole("alert")).toHaveTextContent("Duplicate failed: disk full");
    expect(router.state.location.pathname).toBe("/characters/1/settings");
  });

  it("downloads the character's file, named for the character", async () => {
    const fetchMock = stubFetch(204);
    const createObjectURL = vi.fn((_blob: Blob) => "blob:vex");
    vi.stubGlobal(
      "URL",
      class extends URL {
        static override createObjectURL = createObjectURL;
        static override revokeObjectURL = vi.fn();
      },
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderSettings();

    press("Export character");

    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    const link = click.mock.contexts[0] as HTMLAnchorElement;
    expect(link.download).toBe("Vex.json");
    expect(link.href).toBe("blob:vex");
    const blob = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(JSON.parse(await blob.text())).toEqual(characterFile());
    expect(fetchMock.mock.calls.map(([input]) => String(input))).toContain(
      "/api/characters/1/export",
    );
    click.mockRestore();
  });

  it("stays on the character and says why when the export fails", async () => {
    stubFetch(500);
    const { router } = renderSettings();

    press("Export character");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Export failed: characters.db is locked",
    );
    expect(router.state.location.pathname).toBe("/characters/1/settings");
  });

  it("names what goes with the character and that undo cannot bring it back", async () => {
    stubFetch(204);
    renderSettings();

    openDelete();

    const dialog = screen.getByRole("dialog", { name: "Delete Vex?" });
    expect(dialog).toHaveTextContent(/its play state, .*its roll log and its undo history/);
    expect(dialog).toHaveTextContent("Undo cannot bring it back");
    expect(dialog).toHaveTextContent("data/backups/");
    await waitFor(() =>
      expect(dialog).toHaveTextContent(`all ${presetPageRecords().length} of its pages`),
    );
  });

  it("deletes nothing until the name is typed back", () => {
    const fetchMock = stubFetch(204);
    renderSettings();
    openDelete();

    const confirm = screen.getByRole("button", { name: "Delete" });
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(confirm);
    fireEvent.change(screen.getByLabelText("Type Vex to confirm"), { target: { value: "Ve" } });
    fireEvent.click(confirm);

    expect(deletes(fetchMock)).toHaveLength(0);
  });

  it("asks for a whitespace name to be typed too, rather than taking an empty field", () => {
    stubFetch(204);
    renderSettings("  ");
    openDelete();

    expect(screen.getByRole("button", { name: "Delete" })).toHaveAttribute("aria-disabled", "true");
  });

  it("deletes once the name matches, then leaves for the list without the character", async () => {
    const fetchMock = stubFetch(204);
    const { router, queryClient } = renderSettings();
    openDelete();

    fireEvent.change(screen.getByLabelText("Type Vex to confirm"), { target: { value: "Vex" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await screen.findByText("list");
    expect(router.state.location.pathname).toBe("/characters");
    expect(deletes(fetchMock)).toHaveLength(1);
    expect(String(deletes(fetchMock)[0]?.[0])).toBe("/api/characters/1");
    expect(queryClient.getQueryData(["characters"])).toEqual([]);
  });

  it("stays open and says why when the delete fails", async () => {
    stubFetch(500);
    const { router } = renderSettings();
    openDelete();

    fireEvent.change(screen.getByLabelText("Type Vex to confirm"), { target: { value: "Vex" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Delete failed: Could not back up characters.db",
    );
    expect(screen.getByLabelText("Type Vex to confirm")).toHaveAttribute("aria-invalid", "false");
    expect(router.state.location.pathname).toBe("/characters/1/settings");
  });
});
