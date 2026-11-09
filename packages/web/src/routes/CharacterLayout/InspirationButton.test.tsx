import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stateRecord } from "../../test/records.ts";
import { renderWithClient } from "../../test/renderWithClient.tsx";
import { stubFetchByUrl } from "../../test/stubFetch.ts";
import { InspirationButton } from "./InspirationButton.tsx";

afterEach(() => vi.unstubAllGlobals());

describe("InspirationButton", () => {
  it("shows a character with none as not pressed", async () => {
    stubFetchByUrl({ "/api/characters/1/state": stateRecord() });
    renderWithClient(<InspirationButton characterId="1" />);

    const button = screen.getByRole("button", { name: "Inspiration" });
    await waitFor(() => expect(button).not.toHaveAttribute("aria-disabled", "true"));
    expect(button).toHaveAttribute("aria-pressed", "false");
  });

  it("shows a character with inspiration as pressed", async () => {
    const record = stateRecord();
    stubFetchByUrl({
      "/api/characters/1/state": { ...record, state: { ...record.state, inspiration: true } },
    });
    renderWithClient(<InspirationButton characterId="1" />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Inspiration" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
  });

  it("writes the state with inspiration held", async () => {
    const record = stateRecord();
    const fetchMock = stubFetchByUrl({ "/api/characters/1/state": record });
    renderWithClient(<InspirationButton characterId="1" />);
    const button = screen.getByRole("button", { name: "Inspiration" });
    await waitFor(() => expect(button).not.toHaveAttribute("aria-disabled", "true"));

    fireEvent.click(button);

    await screen.findByText("Inspiration gained");
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ ...record.state, inspiration: true });
  });

  it("holds still until the state has loaded", () => {
    stubFetchByUrl({});
    renderWithClient(<InspirationButton characterId="1" />);
    expect(screen.getByRole("button", { name: "Inspiration" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
