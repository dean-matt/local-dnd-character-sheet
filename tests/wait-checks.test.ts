import { describe, expect, it } from "vitest";
import {
  expectedChecks,
  headCommit,
  missingChecks,
  readChecks,
} from "../scripts/required-checks.mjs";
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

describe("a sharded OS check", () => {
  const REQUIRED = ["check (ubuntu-latest)", "check (windows-latest)"];
  const red = { name: "test (windows-latest, 2/4)", bucket: "fail" };

  it("waits while a red shard's OS check is still pending, then exits 1 on both", async () => {
    const r = await harness(
      [
        [pass("check (ubuntu-latest)"), red, { name: "check (windows-latest)", bucket: "pending" }],
        [pass("check (ubuntu-latest)"), red, { name: "check (windows-latest)", bucket: "fail" }],
      ],
      60_000,
      REQUIRED,
    );
    expect(r).toMatchObject({
      code: 1,
      failed: ["test (windows-latest, 2/4)", "check (windows-latest)"],
      reads: 2,
    });
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

describe("a push GitHub has not caught up with", () => {
  const green = (name: string) => ({ name, status: "completed", conclusion: "success" });
  const gh = (_file: string, args: string[]) =>
    JSON.stringify([
      { check_runs: args.at(-1)?.includes("/commits/old/") ? [green("check"), green("e2e")] : [] },
    ]);

  it("waits on the pushed commit while the old head shows every check green", async () => {
    expect(readChecks("old", gh)).toHaveLength(2);
    const r = await waitChecks({
      expected: EXPECTED,
      read: async () => readChecks("new", gh),
      wait: async () => {},
      timeoutMs: 0,
    });
    expect(r).toMatchObject({ code: 2, waiting: EXPECTED });
  });

  it("judges the local branch's tip, falling back to origin's, never GitHub's head", () => {
    const calls: string[][] = [];
    const local = (file: string, args: string[]) => {
      calls.push([file, ...args]);
      return "abc\n";
    };
    expect(headCommit("fix/1-x", undefined, local)).toBe("abc");
    expect(calls).toEqual([["git", "rev-parse", "--verify", "--quiet", "refs/heads/fix/1-x"]]);
    const remote = (_file: string, args: string[]) => {
      if (args[0] === "rev-parse") throw new Error("exit 1");
      return "def\trefs/heads/fix/1-x\n";
    };
    expect(headCommit("fix/1-x", undefined, remote)).toBe("def");
    expect(headCommit("fix/1-x", "given", remote)).toBe("given");
  });
});

describe("gh readers", () => {
  it("reads the latest run of each check on every page, bucketed as gh pr checks prints", () => {
    const pages = [
      {
        check_runs: [
          { name: "check", status: "completed", conclusion: "success" },
          { name: "corpus", status: "completed", conclusion: "skipped" },
          { name: "e2e", status: "in_progress", conclusion: null },
        ],
      },
      {
        check_runs: [
          { name: "spellcheck", status: "completed", conclusion: "startup_failure" },
          { name: "static", status: "completed", conclusion: "cancelled" },
        ],
      },
    ];
    expect(readChecks("abc", () => JSON.stringify(pages))).toEqual([
      { name: "check", bucket: "pass" },
      { name: "corpus", bucket: "skipping" },
      { name: "e2e", bucket: "pending" },
      { name: "spellcheck", bucket: "fail" },
      { name: "static", bucket: "cancel" },
    ]);
    expect(
      readChecks("abc", () => {
        throw new Error("HTTP 502");
      }),
    ).toEqual([]);
  });

  it("bounds every gh call and reads a timeout as no rollup", () => {
    const timeouts: number[] = [];
    const run = (_file: string, _args: string[], options: { timeout: number }) => {
      timeouts.push(options.timeout);
      return "[]";
    };
    readChecks("abc", run);
    expectedChecks(run);
    expect(timeouts).toEqual([30_000, 30_000]);
    const timedOut = () => {
      throw Object.assign(new Error("spawnSync gh ETIMEDOUT"), { code: "ETIMEDOUT" });
    };
    expect(readChecks("abc", timedOut)).toEqual([]);
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
