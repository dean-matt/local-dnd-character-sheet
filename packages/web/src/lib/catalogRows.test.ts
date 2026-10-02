import { describe, expect, it } from "vitest";
import { matchCatalogTarget } from "./catalogRows.ts";

describe("matchCatalogTarget", () => {
  it("decodes each segment of the key, an encoded slash included", () => {
    const match = matchCatalogTarget("/spells/Mage%20Hand%20%2F%20Legerdemain/XPHB");
    expect(match?.target.label).toBe("spell");
    expect(match?.key).toEqual({ name: "Mage Hand / Legerdemain", source: "XPHB" });
  });

  it("names a class feature by its class, its key and its level", () => {
    const match = matchCatalogTarget("/classes/Fighter/PHB/features/Action%20Surge/PHB/2");
    expect(match?.target.label).toBe("class feature");
    expect(match?.key).toMatchObject({ className: "Fighter", name: "Action Surge", level: "2" });
  });

  it.each(["/monsters/Goblin/MM", "/spells/%E0%A4%A/PHB"])("matches nothing at %s", (address) => {
    expect(matchCatalogTarget(address)).toBeUndefined();
  });
});
