import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterRecord } from "../test/records.ts";
import { stubFetch } from "../test/stubFetch.ts";
import { characterKey } from "./characterKeys.ts";
import { useSaveOverride } from "./useSaveOverride.ts";

afterEach(() => vi.unstubAllGlobals());

function render(overrides: Record<string, unknown>) {
  const record = characterRecord("1", "Vex");
  const fetchMock = stubFetch(new Response(JSON.stringify(record), { status: 200 }));
  const queryClient = new QueryClient();
  queryClient.setQueryData(characterKey("1"), {
    ...record,
    definition: { ...record.definition, overrides },
  });
  const { result } = renderHook(() => useSaveOverride("1"), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
  const written = () => JSON.parse(fetchMock.mock.calls[0]?.[1]?.body).overrides;
  return { save: result.current, written };
}

describe("useSaveOverride", () => {
  it("sets one key and keeps the others", async () => {
    const { save, written } = render({ initiative: 4 });
    await save("armorClass", 20);
    expect(written()).toEqual({ initiative: 4, armorClass: 20 });
  });

  it("drops the key on null, which returns the value to computed", async () => {
    const { save, written } = render({ initiative: 4, armorClass: 20 });
    await save("armorClass", null);
    expect(written()).toEqual({ initiative: 4 });
  });
});
