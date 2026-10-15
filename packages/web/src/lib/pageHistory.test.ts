import { type CharacterPageRecord, UNDO_LOG_LIMIT } from "@dnd/character";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { pageHistoryDepth, rememberPages, takeLastPages } from "./pageHistory.ts";

const list = (title: string): CharacterPageRecord[] => [
  { slug: "grapple", title, hidden: false, preset: false, blocks: [] },
];

describe("pageHistory", () => {
  it("keeps the newest UNDO_LOG_LIMIT entries, dropping the oldest", () => {
    const client = new QueryClient();
    for (let n = 0; n <= UNDO_LOG_LIMIT; n++) rememberPages(client, "1", list(String(n)));

    expect(pageHistoryDepth(client, "1")).toBe(UNDO_LOG_LIMIT);
    let oldest: CharacterPageRecord[] | undefined;
    for (let n = 0; n < UNDO_LOG_LIMIT; n++) oldest = takeLastPages(client, "1");
    expect(oldest).toEqual(list("1"));
    expect(takeLastPages(client, "1")).toBeUndefined();
  });
});
