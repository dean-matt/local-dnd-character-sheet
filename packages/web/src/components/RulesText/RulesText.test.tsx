import { fireEvent, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "../../test/renderWithClient.tsx";
import { stubFetch, stubFetchByUrl } from "../../test/stubFetch.ts";
import { RulesText } from "./RulesText.tsx";

describe("RulesText", () => {
  it("renders plain text with no markup", () => {
    renderWithClient(<RulesText text="plain prose" />);
    expect(screen.getByText("plain prose")).toBeInTheDocument();
  });

  it("renders every token kind tier 1 produces", () => {
    const { container } = renderWithClient(
      <RulesText text="{@b Bold} and {@dc 15} save against {@spell fireball} for {@damage 8d6}." />,
    );

    // style: bold renders as its element
    expect(screen.getByText("Bold").tagName).toBe("STRONG");
    // a computed text token
    expect(container).toHaveTextContent("DC 15");
    // ref: unlinked display text, its name and source carried for a later tier
    const ref = screen.getByText("fireball");
    expect(ref.tagName).toBe("SPAN");
    expect(ref).toHaveAttribute("data-tag", "spell");
    expect(ref).toHaveAttribute("data-name", "fireball");
    // roll: unlinked display text, its notation carried the same way
    const roll = screen.getByText("8d6");
    expect(roll.tagName).toBe("SPAN");
    expect(roll).toHaveAttribute("data-notation", "8d6");
    expect(roll).toHaveAttribute("data-rollable", "true");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("degrades an unknown tag to plain text instead of throwing", () => {
    expect(() => renderWithClient(<RulesText text="{@notarealtag surprise}" />)).not.toThrow();
    expect(screen.getByText("surprise")).toBeInTheDocument();
  });

  it("maps every formatting tag to the element it means", () => {
    renderWithClient(
      <RulesText
        text="{@i italic} {@u underline} {@u2 dblunder} {@s strike} {@s2 dblstrike}
          {@sup sup} {@sub sub} {@kbd key} {@highlight hi} {@code mono}"
      />,
    );
    expect(screen.getByText("italic").tagName).toBe("EM");
    expect(screen.getByText("underline").tagName).toBe("U");
    expect(screen.getByText("dblunder").tagName).toBe("U");
    expect(screen.getByText("dblunder")).toHaveClass("decoration-double");
    expect(screen.getByText("strike").tagName).toBe("S");
    expect(screen.getByText("dblstrike").tagName).toBe("S");
    expect(screen.getByText("dblstrike")).toHaveClass("decoration-double");
    expect(screen.getByText("sup").tagName).toBe("SUP");
    expect(screen.getByText("sub").tagName).toBe("SUB");
    expect(screen.getByText("key").tagName).toBe("KBD");
    expect(screen.getByText("hi").tagName).toBe("MARK");
    expect(screen.getByText("mono").tagName).toBe("CODE");
  });
});

describe("reference resolution", () => {
  afterEach(() => vi.unstubAllGlobals());

  const FIREBALL = {
    name: "Fireball",
    source: "PHB",
    entries: [{ type: "list", items: ["A bright streak flashes from your {@b finger}."] }],
    path: "/spells/Fireball/PHB",
  };

  const requested = (fetchMock: ReturnType<typeof vi.fn>) =>
    fetchMock.mock.calls.map(([url, init]) => [url, JSON.parse(init.body).refs]);

  it("asks for a feature by its whole key, and tells apart two at different levels", async () => {
    const asi = (level: number) => ({
      name: "Ability Score Improvement",
      source: "PHB",
      entries: [`Level ${level}.`],
      path: `/classes/Fighter/PHB/features/Ability%20Score%20Improvement/PHB/${level}`,
    });
    const fetchMock = stubFetchByUrl({ "/api/refs/resolve": { refs: [asi(4), asi(6)] } });
    renderWithClient(
      <MemoryRouter>
        <RulesText text="{@classFeature Ability Score Improvement|Fighter||4||At 4} and {@classFeature Ability Score Improvement|Fighter||6||at 6}" />
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "at 6" }));
    expect(screen.getByRole("link", { name: "Open Ability Score Improvement" })).toHaveAttribute(
      "href",
      "/catalog/classes/Fighter/PHB/features/Ability%20Score%20Improvement/PHB/6",
    );
    expect(requested(fetchMock)).toEqual([
      [
        "/api/refs/resolve",
        [4, 6].map((level) => ({
          tag: "classFeature",
          name: "Ability Score Improvement",
          owner: { className: "Fighter", level },
        })),
      ],
    ]);
  });

  it("opens a resolved reference onto the row's prose and its page", async () => {
    stubFetchByUrl({ "/api/refs/resolve": { refs: [FIREBALL] } });
    renderWithClient(
      <MemoryRouter>
        <p>
          <RulesText text="Cast {@spell fireball}." />
        </p>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: "fireball" }));
    const popover = screen.getByRole("group", { name: "Fireball (PHB)" });
    expect(popover).toHaveTextContent("A bright streak flashes from your finger.");
    expect(screen.getByRole("link", { name: "Open Fireball" })).toHaveAttribute(
      "href",
      "/catalog/spells/Fireball/PHB",
    );
    expect(popover.querySelector("p, ul, div")).toBeNull();
  });

  it("offers no link for a row no page shows", async () => {
    stubFetchByUrl({
      "/api/refs/resolve": { refs: [{ name: "Blinded", source: "XPHB", entries: ["Can't see."] }] },
    });
    renderWithClient(<RulesText text="{@condition blinded|XPHB}" />);

    fireEvent.click(await screen.findByRole("button", { name: "blinded" }));
    expect(screen.getByRole("group", { name: "Blinded (XPHB)" })).toHaveTextContent("Can't see.");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("keeps a row with neither prose nor a page as text, rather than a popover of its name", async () => {
    const fetchMock = stubFetchByUrl({
      "/api/refs/resolve": { refs: [{ name: "Goblin", source: "MM", entries: [] }] },
    });
    renderWithClient(<RulesText text="A {@creature goblin} attacks." />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText("goblin")).toHaveAttribute("data-tag", "creature"));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("leaves every reference as its display text when resolution fails", async () => {
    const fetchMock = stubFetch(new Response(JSON.stringify({ error: "bad" }), { status: 400 }));
    renderWithClient(<RulesText text="Cast {@spell fireball}." />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText("fireball")).toHaveAttribute("data-tag", "spell");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("asks nothing of a block with no references", () => {
    const fetchMock = stubFetch(new Response("{}"));
    renderWithClient(<RulesText text="{@b plain} prose" />);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
