---
name: converge-review
description: Run the review loop on one open local-dnd-character-sheet pull request until it converges — dispatch a review pass, post it, label, apply what survives, reply to each thread, and repeat while a pass still returns a blocking finding. Use from `issue-to-pr` once a pull request is open. Never merges.
---

# Converging a review

1. **Dispatch the review to a subagent** whose prompt carries the pull request number and
   nothing else — no rationale, no account of what you wrote, no defense of a choice. It
   invokes [`audit-pr`](../audit-pr/SKILL.md), which reviews from its own worktree. Its
   findings reach step 2 unchanged.
2. **Post the pass as one review, before applying** — a run that dies mid-apply then
   leaves the findings standing rather than a label pointing at nothing. One call sends
   `commit_id`, `event`, a `body` and each line comment as `{path, line, side, body}`;
   posted one at a time they arrive as a review each. The `body` opens with `PASS_MARKER`
   from `scripts/merge-gate.mjs`, which is how the gate tells a pass from a human's review,
   then holds what the pass found and any finding no line anchors. `event` is `COMMENT`,
   because GitHub refuses an approval on your own pull request; step 5's label carries that
   verdict.

   ```bash
   gh api 'repos/{owner}/{repo}/pulls/<n>/reviews' --input <the pass, as json>
   gh api 'repos/{owner}/{repo}/pulls/<n>/reviews/<review>/comments' --jq '.[].id'
   gh api 'repos/{owner}/{repo}/pulls/<n>/comments/<id>/replies' -f body=<the verdict>
   ```

   A pass returning nothing still posts its marked `body`, with no comments, then skips to
   step 5 — that review is the only record the gate has that the code was read again, and
   "the review converged" reads the findings of the last pass to post. A later pass adds,
   leaving earlier threads alone.
3. **Label, apply, reply.** Swap `review:changes-requested` on first, in one `gh pr edit
   <n> --add-label <one> --remove-label <other>`, so the mark and the findings stand
   together. Then apply what survives, `pnpm check`, prose pass what the fixes touched,
   commit, push, and bring the pull request body back in line — fixes left in the working
   tree leave the pull request holding the code the review rejected.

   Reply into each thread last, `**Applied** in <sha>` or `**Declined** — <reason>`, so
   every finding carries a verdict. Each reply lands as its own empty review. A fix that
   moves a line outdates its thread, and the reply still posts.
4. **Repeat 1 to 3 while a pass returns a `critical` or `warning` finding**, a fresh
   subagent each so none inherits the last one's conclusions. `PASS_CAP` in
   `scripts/merge-gate.mjs` caps the loop and the gate's "the review converged" reads it:
   a pass returning nothing ends the loop earlier, and at the cap you apply what the pass
   found and let the verdict reply carry it. A finding you declined comes back and takes
   the same reply.
5. **Label, then return.** `review:approved` where `pnpm check` is green and nothing a pass
   returned still waits on the user; `review:changes-requested` where something does — a
   decline, a second bug filed as its own issue, a red check. Preferences wait on nobody.

   Return the label left, what each pass found, and what `gh pr checks` says, to whatever
   called this skill.

## What this skill will not do

**Merge.** Label and return, whatever a pass found and however small the change.

**Open the pull request or remove the worktree.** Those bracket this skill in
[`issue-to-pr`](../issue-to-pr/SKILL.md) and stay there.
