import { describe, expect, it } from "vitest";
import { expectedChecks, missingChecks, readChecks } from "../scripts/required-checks.mjs";
import { settle, waitChecks } from "../scripts/wait-checks.mjs";

const EXPECTED = ["check", "e2e"];
const pass = (name: string) => ({ name, bucket: "pass" });

/** A clock and a reader the test drives: each `read` returns the next rollup, each `wait` moves time. */
function harness(
  rollups: { name: string; bucket: string }[][],
  timeoutMs = 60_000,
  expected = EXPECTED,
) {
  let t = 0;
  let i = 0;
  return waitChecks({
    expected,
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

  it("exits 1 once a check is red and none is still running", async () => {
    const r = await harness([[pass("check"), { name: "e2e", bucket: "fail" }]]);
    expect(r).toMatchObject({ code: 1, failed: ["e2e"] });
  });

  it("keeps waiting on a running check while another is red", async () => {
    const red = { name: "check", bucket: "fail" };
    const r = await harness([
      [red, { name: "e2e", bucket: "pending" }],
      [red, pass("e2e")],
    ]);
    expect(r).toMatchObject({ code: 1, failed: ["check"] });
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

describe("an unjudgeable head", () => {
  it("exits 2 where the ruleset names no required check, whatever the rollup holds", async () => {
    expect(await harness([[pass("check")]], 60_000, [])).toMatchObject({ code: 2 });
    expect(await harness([[]], 60_000, [])).toMatchObject({ code: 2 });
  });

  it("exits 2 where nothing has reported by the deadline", async () => {
    expect(await harness([[]])).toMatchObject({ code: 2, waiting: EXPECTED });
  });

  it("exits 1 on a red check while a required check has not reported", async () => {
    const r = await harness([[{ name: "check", bucket: "fail" }]]);
    expect(r).toMatchObject({ code: 1, failed: ["check"] });
  });
});

describe("gh readers", () => {
  it("reads the rollup gh prints while exiting non-zero, and nothing when it prints nothing", () => {
    const rollup = [{ name: "e2e", bucket: "pending" }];
    const exits = (stdout: string) => () => {
      throw Object.assign(new Error("exit 8"), { stdout });
    };
    expect(readChecks("1", exits(JSON.stringify(rollup)))).toEqual(rollup);
    expect(readChecks("1", exits(""))).toEqual([]);
  });

  it("takes the required names from the ruleset's status-check rule alone", () => {
    const rules = [
      { type: "deletion" },
      {
        type: "required_status_checks",
        parameters: { required_status_checks: [{ context: "e2e" }] },
      },
    ];
    expect(expectedChecks(() => JSON.stringify(rules))).toEqual(["e2e"]);
  });
});
