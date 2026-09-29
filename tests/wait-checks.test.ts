import { describe, expect, it } from "vitest";
import { expectedChecks, missingChecks, readChecks } from "../scripts/required-checks.mjs";
import { readExpected, settle, waitChecks } from "../scripts/wait-checks.mjs";

const EXPECTED = ["check", "e2e"];
const pass = (name: string) => ({ name, bucket: "pass" });

/** A clock and a reader the test drives: each `read` returns the next rollup, each `wait` moves time. */
async function harness(
  rollups: { name: string; bucket: string }[][],
  timeoutMs = 60_000,
  expected = EXPECTED,
) {
  let t = 0;
  let reads = 0;
  const result = await waitChecks({
    expected,
    read: async () => rollups[Math.min(reads++, rollups.length - 1)] ?? [],
    wait: async (ms?: number) => {
      t += ms ?? 0;
    },
    now: () => t,
    timeoutMs,
    intervalMs: 10_000,
  });
  return { ...result, reads, elapsed: t };
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
    expect(r).toMatchObject({ code: 1, failed: ["check"], reads: 2 });
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

describe("a final answer", () => {
  it("needs two consecutive green polls, and a red between them restarts the count", async () => {
    const both = [pass("check"), pass("e2e")];
    expect(await harness([both, both])).toMatchObject({ code: 0, reads: 2 });
    const r = await harness([
      both,
      [pass("check"), { name: "e2e", bucket: "pending" }],
      both,
      both,
    ]);
    expect(r).toMatchObject({ code: 0, reads: 4 });
  });

  it("never polls past the deadline: a lone green with no time for a second is unconfirmed", async () => {
    const both = [pass("check"), pass("e2e")];
    const r = await harness([both], 9_000);
    expect(r).toMatchObject({ code: 2, waiting: ["a second green poll"], reads: 1 });
  });

  it("stops before a poll whose interval would cross the deadline", async () => {
    const r = await harness([[pass("check")]], 25_000);
    expect(r).toMatchObject({ code: 2, waiting: ["e2e"] });
    expect(r.elapsed).toBeLessThanOrEqual(25_000);
  });
});

describe("readExpected", () => {
  it("retries once after a delay, then lets the second error stand", async () => {
    const waits: number[] = [];
    const wait = async (ms: number) => void waits.push(ms);
    let calls = 0;
    const flaky = () => {
      if (calls++ === 0) throw new Error("gh timed out");
      return ["check"];
    };
    expect(await readExpected(flaky, wait, 5)).toEqual(["check"]);
    expect(waits).toEqual([5]);
    const dead = () => {
      throw new Error("still down");
    };
    await expect(readExpected(dead, wait, 5)).rejects.toThrow("still down");
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

  it("bounds every gh call and reads a timeout as no rollup", () => {
    const timeouts: number[] = [];
    const run = (_file: string, _args: string[], options: { timeout: number }) => {
      timeouts.push(options.timeout);
      return "[]";
    };
    readChecks("1", run);
    expectedChecks(run);
    expect(timeouts).toEqual([30_000, 30_000]);
    const timedOut = () => {
      throw Object.assign(new Error("spawnSync gh ETIMEDOUT"), {
        code: "ETIMEDOUT",
        stdout: JSON.stringify([{ name: "e2e", bucket: "pass" }]),
      });
    };
    expect(readChecks("1", timedOut)).toEqual([]);
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
