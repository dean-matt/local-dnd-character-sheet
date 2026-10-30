import { describe, expect, it } from "vitest";
import { FIXED_JOBS, MIN_SHARDS, planShards, SLOTS } from "../scripts/plan-shards.mjs";

const total = (plan: { windows: number; ubuntu: number; e2e: number }) =>
  plan.windows + plan.ubuntu + plan.e2e;

describe("planShards", () => {
  it("gives every job its minimum on a small suite", () => {
    expect(planShards({ tests: 10, specs: 1 })).toEqual({
      windows: MIN_SHARDS,
      ubuntu: MIN_SHARDS,
      e2e: MIN_SHARDS,
    });
  });

  it("adds shards as the suite grows", () => {
    const small = planShards({ tests: 300, specs: 20 });
    const large = planShards({ tests: 600, specs: 20 });
    expect(large.windows).toBeGreaterThan(small.windows);
    expect(large.ubuntu).toBeGreaterThan(small.ubuntu);
    expect(planShards({ tests: 300, specs: 60 }).e2e).toBeGreaterThan(small.e2e);
  });

  it("keeps the shards and the fixed jobs within the concurrent-job budget", () => {
    for (const tests of [0, 336, 1000, 5000]) {
      for (const specs of [0, 23, 100]) {
        const plan = planShards({ tests, specs });
        expect(total(plan) + FIXED_JOBS, `${tests} tests, ${specs} specs`).toBeLessThanOrEqual(
          SLOTS,
        );
      }
    }
  });

  it("lets Windows take the room Ubuntu and e2e leave", () => {
    const plan = planShards({ tests: 5000, specs: 100 });
    expect(plan).toEqual({ windows: SLOTS - FIXED_JOBS - 8, ubuntu: 4, e2e: 4 });
  });
});
