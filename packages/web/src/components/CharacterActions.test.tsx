import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord } from "../test/records.ts";
import { CharacterActions } from "./CharacterActions.tsx";

function stubImport(response: Response) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderActions() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: "/", element: <CharacterActions /> },
      { path: "/characters/:id", element: <p>sheet</p> },
    ],
    { initialEntries: ["/"] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router, queryClient };
}

function pick(contents: string, name = "Vex.json") {
  fireEvent.change(screen.getByLabelText("Character file"), {
    target: { files: [new File([contents], name, { type: "application/json" })] },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CharacterActions", () => {
  it("opens the file picker from Import", () => {
    renderActions();
    const click = vi.spyOn(screen.getByLabelText("Character file"), "click");

    fireEvent.click(screen.getByRole("button", { name: "Import" }));

    expect(click).toHaveBeenCalledOnce();
  });

  it("posts the picked file and opens the character it creates", async () => {
    const fetchMock = stubImport(
      new Response(JSON.stringify(characterRecord("7", "Vex")), { status: 201 }),
    );
    const { router, queryClient } = renderActions();

    pick('{"format":"local-dnd-character-sheet/character"}');

    await screen.findByText("sheet");
    expect(router.state.location.pathname).toBe("/characters/7");
    const [input, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(input)).toBe("/api/characters/import");
    expect(JSON.parse(String(init?.body))).toEqual({
      format: "local-dnd-character-sheet/character",
    });
    expect(queryClient.getQueryData(["characters", "7"])).toMatchObject({ name: "Vex" });
  });

  it("names the failing field the API refused, and stays put", async () => {
    stubImport(
      new Response(
        JSON.stringify({ error: "Not a character file this build can read. version: Invalid" }),
        { status: 422 },
      ),
    );
    const { router } = renderActions();

    pick("{}");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Import failed: Not a character file this build can read. version: Invalid",
    );
    expect(router.state.location.pathname).toBe("/");
  });

  it("refuses a file that is not JSON without asking the API", async () => {
    const fetchMock = stubImport(new Response(null, { status: 500 }));
    renderActions();

    pick("not json", "notes.txt");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Import failed: notes.txt is not a JSON file.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
