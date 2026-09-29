import { describe, expect, it } from "vitest";
import { missingChecks } from "../scripts/required-checks.mjs";
import { settle, waitChecks } from "../scripts/wait-checks.mjs";

const EXPECTED = ["check", "e2e"];
const pass = (name: string) => ({ name, bucket: "pass" });

/** A clock and a reader the test drives: each `read` returns the next rollup, each `wait` moves time. */
function harness(rollups: { name: string; bucket: string }[][], timeoutMs = 60_000) {
  let t = 0;
  let i = 0;
  return waitChecks({
    expected: EXPECTED,
    read: async () => rollups[Math.min(i++, rollups.length - 1)] ?? [],
    wait: async (ms?: number) => {
      t += ms ?? 0;
    },
    now: () => t,
    timeoutMs,
    intervalMs: 10_000,
  });
}

describe("missingChecks", () => {
  it("names the expected checks the head has not reported", () => {
    expect(missingChecks(EXPECTED, [pass("check")])).toEqual(["e2e"]);
    expect(missingChecks(EXPECTED, [pass("check"), pass("e2e")])).toEqual([]);
  });
});

describe("settle", () => {
  it("counts a cancelled check as failed and reads pending apart from missing", () => {
    const r = settle(EXPECTED, [{ name: "check", bucket: "cancel" }]);
    expect(r).toEqual({ failed: ["check"], pending: [], missing: ["e2e"] });
  });
});

describe("waitChecks", () => {
  it("exits 0 once every expected check has reported green, after waiting for the late one", async () => {
    const r = await harness([[pass("check")], [pass("check"), pass("e2e")]]);
    expect(r.code).toBe(0);
  });

  it("exits 1 as soon as a check is red, without waiting for the rest", async () => {
    const r = await harness([[pass("check"), { name: "e2e", bucket: "fail" }]]);
    expect(r).toMatchObject({ code: 1, failed: ["e2e"] });
  });

  it("exits 2 naming the checks that never reported", async () => {
    const r = await harness([[pass("check")]]);
    expect(r).toMatchObject({ code: 2, waiting: ["e2e"] });
  });

  it("exits 2 on a check still pending at the deadline", async () => {
    const r = await harness([[pass("check"), { name: "e2e", bucket: "pending" }]]);
    expect(r).toMatchObject({ code: 2, waiting: ["e2e"] });
  });
});
