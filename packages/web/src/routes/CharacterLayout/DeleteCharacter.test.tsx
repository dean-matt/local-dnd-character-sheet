import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord, presetPageRecords } from "../../test/records.ts";
import { DeleteCharacter } from "./DeleteCharacter.tsx";

function stubDelete(status: number) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "DELETE") {
      return status === 204
        ? new Response(null, { status })
        : new Response(JSON.stringify({ error: "Could not back up characters.db" }), { status });
    }
    return String(input) === "/api/characters/1/pages"
      ? new Response(JSON.stringify(presetPageRecords()), { status: 200 })
      : new Response(JSON.stringify({ error: "nothing here" }), { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const deletes = (fetchMock: ReturnType<typeof stubDelete>) =>
  fetchMock.mock.calls.filter(([, init]) => init?.method === "DELETE");

function renderDelete(name = "Vex") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(["characters"], [characterRecord("1", name)]);
  const router = createMemoryRouter(
    [
      {
        path: "/characters/:id",
        element: <DeleteCharacter character={characterRecord("1", name)} />,
      },
      { path: "/characters", element: <p>list</p> },
    ],
    { initialEntries: ["/characters/1"] },
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

describe("DeleteCharacter", () => {
  it("names what goes with the character and that undo cannot bring it back", async () => {
    stubDelete(204);
    renderDelete();

    fireEvent.click(screen.getByRole("button", { name: "Delete character" }));

    const dialog = screen.getByRole("dialog", { name: "Delete Vex?" });
    expect(dialog).toHaveTextContent(/its play state, .*its roll log and its undo history/);
    expect(dialog).toHaveTextContent("Undo cannot bring it back");
    expect(dialog).toHaveTextContent("data/backups/");
    await waitFor(() =>
      expect(dialog).toHaveTextContent(`all ${presetPageRecords().length} of its pages`),
    );
  });

  it("deletes nothing until the name is typed back", () => {
    const fetchMock = stubDelete(204);
    renderDelete();
    fireEvent.click(screen.getByRole("button", { name: "Delete character" }));

    const confirm = screen.getByRole("button", { name: "Delete" });
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(confirm);
    fireEvent.change(screen.getByLabelText("Type Vex to confirm"), { target: { value: "Ve" } });
    fireEvent.click(confirm);

    expect(deletes(fetchMock)).toHaveLength(0);
  });

  it("asks for a whitespace name to be typed too, rather than taking an empty field", () => {
    stubDelete(204);
    renderDelete("  ");
    fireEvent.click(screen.getByRole("button", { name: "Delete character" }));

    expect(screen.getByRole("button", { name: "Delete" })).toHaveAttribute("aria-disabled", "true");
  });

  it("deletes once the name matches, then leaves for the list without the character", async () => {
    const fetchMock = stubDelete(204);
    const { router, queryClient } = renderDelete();
    fireEvent.click(screen.getByRole("button", { name: "Delete character" }));

    fireEvent.change(screen.getByLabelText("Type Vex to confirm"), { target: { value: "Vex" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await screen.findByText("list");
    expect(router.state.location.pathname).toBe("/characters");
    expect(deletes(fetchMock)).toHaveLength(1);
    expect(String(deletes(fetchMock)[0]?.[0])).toBe("/api/characters/1");
    expect(queryClient.getQueryData(["characters"])).toEqual([]);
  });

  it("stays open and says why when the delete fails", async () => {
    stubDelete(500);
    const { router } = renderDelete();
    fireEvent.click(screen.getByRole("button", { name: "Delete character" }));

    fireEvent.change(screen.getByLabelText("Type Vex to confirm"), { target: { value: "Vex" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Delete failed: Could not back up characters.db",
    );
    expect(screen.getByLabelText("Type Vex to confirm")).toHaveAttribute("aria-invalid", "false");
    expect(router.state.location.pathname).toBe("/characters/1");
  });
});
