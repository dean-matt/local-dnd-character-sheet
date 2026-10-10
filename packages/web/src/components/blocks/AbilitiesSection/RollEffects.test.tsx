import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RollEffects } from "./RollEffects.tsx";

describe("RollEffects", () => {
  it("lists an effect an item states twice once", () => {
    const key = { item: "Infiltrator's Key", mode: "advantage", roll: "check" } as const;
    render(<RollEffects effects={[key, { ...key, roll: "skill", target: "Stealth" }]} />);

    expect(screen.getAllByText("Advantage (Infiltrator's Key)")).toHaveLength(1);
  });
});
