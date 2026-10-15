import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord } from "../../test/records.ts";
import { AddTo } from "./AddTo.tsx";

const fira = characterRecord("7", "Fira");
const ember = { kind: "item" as const, ref: { homebrewId: "3" }, label: "Ember (Homebrew)" };

function renderAt(path: string, characters: unknown[] = [fira]) {
  const writes: string[] = [];
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "PUT") writes.push(url);
    const body =
      url === "/api/characters"
        ? characters
        : { ...fira, definition: init?.body ? JSON.parse(String(init.body)) : fira.definition };
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  });
  const onAdded = vi.fn();
  const router = createMemoryRouter(
    [{ path: "*", element: <AddTo row={ember} onAdded={onAdded} /> }],
    {
      initialEntries: [path],
    },
  );
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { onAdded, writes };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AddTo", () => {
  it("asks which character away from a sheet, adds to the one chosen, and returns focus", async () => {
    const { onAdded, writes } = renderAt("/settings");
    const button = screen.getByRole("button", { name: "Add to… Ember (Homebrew)" });
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByRole("group", { name: "Add Ember (Homebrew) to which character" });
    fireEvent.click(await within(list).findByRole("button", { name: "Fira" }));

    await waitFor(() =>
      expect(onAdded).toHaveBeenCalledWith({ text: "Added Ember (Homebrew) to Fira." }),
    );
    expect(writes).toEqual(["/api/characters/7"]);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it("adds straight to the character whose sheet is open", async () => {
    const { onAdded } = renderAt("/characters/7/p/stats");
    const button = await screen.findByRole("button", {
      name: "Add to… Ember (Homebrew), for Fira",
    });
    expect(button).not.toHaveAttribute("aria-expanded");
    fireEvent.click(button);
    await waitFor(() =>
      expect(onAdded).toHaveBeenCalledWith({ text: "Added Ember (Homebrew) to Fira." }),
    );
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("offers to create a character where there is none, and closes on Escape", async () => {
    renderAt("/", []);
    const button = screen.getByRole("button", { name: "Add to… Ember (Homebrew)" });
    fireEvent.click(button);
    expect(
      await screen.findByText("There is no character to add to.", { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+ New Character" })).toHaveAttribute(
      "href",
      "/characters/new",
    );
    fireEvent.keyDown(screen.getByRole("link", { name: "+ New Character" }), { key: "Escape" });
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });
});
