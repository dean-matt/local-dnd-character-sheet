import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "../../../test/renderWithClient.tsx";
import { FeatureHomebrewEffect } from "./FeatureHomebrewEffect.tsx";

const MECHANICS = [{ kind: "uses", count: 2, reset: "short" }];
const feature = { name: "Second Wind", source: "PHB" };

/** The effects API over one row, which the writes below keep. */
function serve(initial: unknown[] = []) {
  let rows = initial;
  const calls: { method: string; url: string; body?: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, url, body });
      if (method === "DELETE") {
        rows = [];
        return new Response(null, { status: 204 });
      }
      if (method !== "GET") {
        const row = { id: "e1", createdAt: "2026-01-01T00:00:00.000Z", ...body };
        rows = [row];
        return new Response(JSON.stringify(row), { status: method === "POST" ? 201 : 200 });
      }
      return new Response(JSON.stringify(rows));
    }),
  );
  return calls;
}

describe("FeatureHomebrewEffect", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates an effect for the feature, then edits and deletes it", async () => {
    const calls = serve();
    renderWithClient(<FeatureHomebrewEffect feature={feature} />);

    const field = await screen.findByLabelText("Mechanics (JSON)");
    fireEvent.change(field, { target: { value: JSON.stringify(MECHANICS) } });
    fireEvent.click(screen.getByRole("button", { name: "Save effect" }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: "POST",
        url: "/api/homebrew/feature-effects",
        body: { ...feature, mechanics: MECHANICS },
      }),
    );

    await screen.findByRole("button", { name: "Delete effect" });
    const edited = [{ kind: "uses", count: 3, reset: "long" }];
    fireEvent.change(screen.getByLabelText("Mechanics (JSON)"), {
      target: { value: JSON.stringify(edited) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save effect" }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: "PUT",
        url: "/api/homebrew/feature-effects/e1",
        body: { ...feature, mechanics: edited },
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete effect" }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        method: "DELETE",
        url: "/api/homebrew/feature-effects/e1",
        body: undefined,
      }),
    );
    await waitFor(() => expect(screen.queryByRole("button", { name: "Delete effect" })).toBeNull());
  });

  it("shows the stored effect and writes nothing for mechanics that do not validate", async () => {
    const calls = serve([
      { id: "e1", createdAt: "2026-01-01T00:00:00.000Z", ...feature, mechanics: MECHANICS },
    ]);
    renderWithClient(<FeatureHomebrewEffect feature={feature} />);

    const field = await screen.findByLabelText("Mechanics (JSON)");
    await waitFor(() =>
      expect(JSON.parse((field as HTMLTextAreaElement).value)).toEqual(MECHANICS),
    );

    fireEvent.change(field, { target: { value: '[{"kind":"nonsense"}]' } });
    fireEvent.click(screen.getByRole("button", { name: "Save effect" }));
    expect(await screen.findByRole("alert")).toBeTruthy();

    fireEvent.change(field, { target: { value: "[" } });
    fireEvent.click(screen.getByRole("button", { name: "Save effect" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Not valid JSON");
    expect(calls.every(({ method }) => method === "GET")).toBe(true);
  });

  it("says a class feature's effect is shared only when it is", async () => {
    serve();
    const { rerender } = renderWithClient(
      <FeatureHomebrewEffect feature={feature} origin="class" />,
    );
    expect(await screen.findByText(/every class and subclass feature/)).toBeTruthy();
    rerender(<FeatureHomebrewEffect feature={feature} />);
    expect(screen.queryByText(/every class and subclass feature/)).toBeNull();
  });
});
