import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterKey } from "../../../hooks/characterKeys.ts";
import { identityRecord } from "../../../test/records.ts";
import { LanguagesCard } from "./LanguagesCard.tsx";

const language = (name: string) => ({ type: "language", name, source: "XPHB", edition: "one" });

/** Answers search with Common and Draconic, and a write with the record. */
function stubServer() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const items = [language("Common"), language("Draconic")];
    return String(input).startsWith("/api/search")
      ? new Response(JSON.stringify({ items, total: 2, limit: 20, offset: 0 }))
      : new Response(JSON.stringify(identityRecord()));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const writtenLanguages = (fetchMock: ReturnType<typeof stubServer>) => {
  const put = fetchMock.mock.calls.find(([url]) => url === "/api/characters/1");
  return put && JSON.parse(String(put[1]?.body)).proficiencies.languages;
};

function renderCard() {
  const record = identityRecord();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(characterKey(record.id), record);
  render(
    <QueryClientProvider client={client}>
      <LanguagesCard character={record} />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("LanguagesCard", () => {
  it("adds a language as a reference, refusing one already known", async () => {
    const fetchMock = stubServer();
    renderCard();

    fireEvent.focus(screen.getByRole("combobox", { name: "Add a language" }));
    const known = await screen.findByRole("option", { name: /Common/ });
    expect(known).toHaveTextContent("Already known");
    fireEvent.click(known);
    expect(writtenLanguages(fetchMock)).toBeUndefined();
    fireEvent.click(screen.getByRole("option", { name: /Draconic/ }));

    await waitFor(() => expect(writtenLanguages(fetchMock)).toBeDefined());
    expect(writtenLanguages(fetchMock)).toEqual([
      { name: "Common", source: "XPHB" },
      { name: "Elvish", source: "XPHB" },
      { name: "Draconic", source: "XPHB" },
    ]);
  });

  it("removes a language with ×", async () => {
    const fetchMock = stubServer();
    renderCard();

    const card = screen.getByRole("region", { name: "Languages" });
    fireEvent.click(within(card).getByRole("button", { name: "Remove Common" }));

    await waitFor(() => expect(writtenLanguages(fetchMock)).toBeDefined());
    expect(writtenLanguages(fetchMock)).toEqual([{ name: "Elvish", source: "XPHB" }]);
  });
});
