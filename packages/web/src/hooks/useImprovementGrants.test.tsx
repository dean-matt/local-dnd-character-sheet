import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubFetchByUrl } from "../test/stubFetch.ts";
import { useImprovementGrants } from "./useImprovementGrants.ts";

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

const PHB = (name: string) => ({ name, source: "PHB" });
const feature = (name: string, level: number) => ({ ...PHB(name), level, json: PHB(name) });
const grants = (level: number, features: object[]) => ({
  level,
  resources: [],
  spellSlots: [],
  optionalFeatures: [],
  features,
});

afterEach(() => vi.unstubAllGlobals());

describe("useImprovementGrants", () => {
  it("names a subclass's features beside its class's, as Eldritch Knight's Spellcasting", async () => {
    stubFetchByUrl({
      "/api/classes/Fighter/PHB/at/4": grants(4, [feature("Ability Score Improvement", 4)]),
      "/api/classes/Fighter/PHB/subclasses/Eldritch%20Knight/PHB/at/4": grants(4, [
        feature("Spellcasting", 3),
      ]),
    });
    const levels = [
      { class: PHB("Fighter") },
      { class: PHB("Fighter") },
      { class: PHB("Fighter"), subclass: PHB("Eldritch Knight") },
      { class: PHB("Fighter") },
    ];

    const { result } = renderHook(() => useImprovementGrants(levels), { wrapper });

    await waitFor(() =>
      expect(result.current.grants[0]?.features).toEqual([
        "Ability Score Improvement",
        "Spellcasting",
      ]),
    );
  });
});
