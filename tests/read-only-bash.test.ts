import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { rejects } from "../scripts/read-only-bash.mjs";

/**
 * Fence for the `pr-auditor` agent's Bash hook. Every command `audit-pr` runs has to pass,
 * or the review pass cannot read the change at all.
 */
const SCRIPT = resolve(import.meta.dirname, "../scripts/read-only-bash.mjs");

describe("rejects", () => {
  it.each([
    'head=$(gh pr view "$n" --json headRefOid --jq .headRefOid)',
    'git fetch --quiet origin main "$head"',
    "git worktree prune",
    'git worktree remove --force "$dir" 2>/dev/null || true',
    'git worktree add --detach --quiet "$dir" "$head"',
    "git -C \"$dir\" diff origin/main...HEAD -- . ':(exclude)pnpm-lock.yaml'",
    'gh pr view "$n" --json title,body',
    "gh issue view 12 --json title,body",
    'gh pr checks "$n"',
    "gh api 'repos/{owner}/{repo}/pulls/7/comments' --jq '.[].id'",
    "gh run view 123 --log-failed",
    "git log --oneline -5",
  ])("lets a read through: %s", (command) => {
    expect(rejects(command)).toBeNull();
  });

  it.each([
    "git commit -m 'fix: apply finding'",
    "git push",
    "cd /tmp && git -C /repo push origin HEAD",
    "git -c core.editor=true rebase -i main",
    "git checkout feat/1-slug",
    "git worktree remove .claude/worktrees/353",
    "gh pr review 7 --comment -b x",
    "gh pr comment 7 -b x",
    "gh pr edit 7 --add-label review:approved",
    "gh pr merge 7 --squash",
    "gh issue create --title x",
    "gh project item-edit --id x",
    "gh label create x",
    "gh api 'repos/{owner}/{repo}/pulls/7/reviews' --input pass.json",
    "gh api repos/o/r/issues/7/labels -f labels[]=x",
    "gh api -X DELETE repos/o/r/issues/comments/1",
    "gh api --method PATCH repos/o/r/pulls/7",
  ])("refuses a write: %s", (command) => {
    expect(rejects(command)).not.toBeNull();
  });
});

describe("the hook", () => {
  function hook(command: string) {
    return spawnSync("node", [SCRIPT], {
      input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
      encoding: "utf8",
    });
  }

  it("exits 2 with the reason on a write, which is what blocks the call", () => {
    const result = hook("git push");
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/^Refused: this command changes a branch/);
  });

  it("exits 0 on a read", () => {
    expect(hook("git status").status).toBe(0);
  });
});
