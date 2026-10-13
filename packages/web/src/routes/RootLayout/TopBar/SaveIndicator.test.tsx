import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { characterDefinitionWriteKey } from "../../../hooks/characterKeys.ts";
import { SAVED_STATUS_MS } from "../../../hooks/useFleeting.ts";
import { SaveIndicator } from "./SaveIndicator.tsx";

function setup() {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <SaveIndicator />
    </QueryClientProvider>,
  );
  /** Starts a write under `key`, returning the calls that settle it. */
  const write = (key: readonly unknown[] = characterDefinitionWriteKey("1")) => {
    const settle = { land: () => {}, fail: () => {} };
    const mutation = client.getMutationCache().build(client, {
      mutationKey: key,
      mutationFn: () =>
        new Promise<void>((resolve, reject) => {
          settle.land = resolve;
          settle.fail = () => reject(new Error("down"));
        }),
    });
    act(() => {
      mutation.execute(undefined).catch(() => {});
    });
    return settle;
  };
  return write;
}

/** Lets the query client's batched notifications reach the indicator. */
const tick = () => act(() => vi.advanceTimersByTimeAsync(0));

afterEach(() => vi.useRealTimers());

describe("SaveIndicator", () => {
  it("says Saving… while any character write is in flight, then Saved for a moment", async () => {
    vi.useFakeTimers();
    const write = setup();
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();

    const first = write();
    const second = write(characterDefinitionWriteKey("2"));
    await tick();
    expect(status).toHaveTextContent("Saving…");
    first.land();
    await tick();
    expect(status).toHaveTextContent("Saving…");
    second.land();
    await tick();
    expect(status).toHaveTextContent("Saved");

    await act(() => vi.advanceTimersByTimeAsync(SAVED_STATUS_MS));
    expect(status).toBeEmptyDOMElement();
  });

  it("says nothing once a write fails, leaving that to its field's toast", async () => {
    const write = setup();

    const failing = write();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Saving…"));
    failing.fail();

    await waitFor(() => expect(screen.getByRole("status")).toBeEmptyDOMElement());
  });

  it("ignores a write to anything but a character", async () => {
    vi.useFakeTimers();
    const write = setup();

    write(["homebrew"]);
    await tick();

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
