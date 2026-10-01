import { describe, expect, it } from "vitest";
import {
  blockedBySection,
  clearBlocker,
  referencedIssues,
  removeBlockerTerm,
  removeSection,
  stillBlocked,
} from "../scripts/unblock-issues.mjs";

/**
 * Bodies below are copied verbatim from open issues this repository has actually filed —
 * the same reason `tests/merge-gate.test.ts` copies real review bodies rather than
 * composing ones more convenient for a parser to read.
 */
const SINGLE_BLOCKER = `## What

#276 gives a character's rolls somewhere to land; nothing shows them.

## Acceptance criteria

- [ ] A panel lists a character's recent rolls, newest first, notation and result
      together

## Package

web

## Blocked by

#276, for a read endpoint.

## Related

#26, which is what produces a roll to show.

## Out of scope

Filtering or searching the log.
`;

const BARE_PAIR = `## What

Multiclass.

## Package

web, character

## Blocked by

#214 and #215.

## Out of scope

Nothing.
`;

const APPOSITIVE_LIST = `## What

Level up.

## Package

web, character

## Blocked by

The class table reads, the pickers, and #223.

## Out of scope

Nothing.
`;

const EXPLAINED_PAIR = `## What

Creation spells.

## Package

web, character

## Blocked by

#233, for the creation shell, and #226, for the picker.

## Out of scope

Nothing.
`;

const NO_AND_PAIR = `## What

House rules.

## Package

web, character

## Blocked by

#222 for the fields, #212 for the term a house rule contributes.

## Out of scope

Nothing.
`;

const BARE_TAIL = `## What

Editing the inventory.

## Package

web, character

## Blocked by

#210, #222 and the picker.

## Out of scope

Nothing.
`;

const LAST_SECTION = `## What

Nothing says whether the app animates.

## Package

web

## Blocked by

#217.
`;

const PARAGRAPH_PAIR = `## What

Grip toggle.

## Blocked by

#453, for the grip toggle's design.

#459, for the row the attack and damage chips sit in.
`;

const SENTENCE_AFTER_PAIR = `## What

Delete a reference.

## Blocked by

#75 and #77. There is no delete route and no character to hold a reference until both
land.

## Out of scope

Nothing.
`;

const REFERENCE_IN_DESCRIPTION = `## What

Search.

## Blocked by

#192, which opens \`content.db\` and names the leaf package a result schema lives in, and
#75, which makes homebrew rows reachable. #196 and #197 widen what a hit can be, and a
search shipped before them covers fewer types rather than being wrong.

## Out of scope

Nothing.
`;

describe("blockedBySection", () => {
  it("reads the section between its heading and the next one", () => {
    expect(blockedBySection(SINGLE_BLOCKER)).toBe("#276, for a read endpoint.");
  });

  it("reads a section that runs to the end of the body", () => {
    expect(blockedBySection(LAST_SECTION)).toBe("#217.");
  });

  it("returns null where the issue carries no such section", () => {
    expect(blockedBySection("## What\n\nNo blockers here.\n")).toBeNull();
  });
});

describe("referencedIssues", () => {
  it("finds every #NNN a section names, prose blockers included", () => {
    expect(referencedIssues(blockedBySection(APPOSITIVE_LIST))).toEqual([223]);
    expect(referencedIssues(blockedBySection(EXPLAINED_PAIR))).toEqual([233, 226]);
  });

  it("returns nothing for a body with no section", () => {
    expect(referencedIssues(null)).toEqual([]);
  });
});

describe("clearBlocker", () => {
  it("drops the whole section where no other blocker is open", () => {
    const result = clearBlocker(SINGLE_BLOCKER, 276, false);
    expect(result).not.toMatch(/## Blocked by/);
    expect(result).toBe(removeSection(SINGLE_BLOCKER));
    expect(blockedBySection(result)).toBeNull();
  });

  it("drops a section that was the last one in the body", () => {
    const result = clearBlocker(LAST_SECTION, 217, false);
    expect(result).not.toMatch(/## Blocked by/);
    expect(result.endsWith("## Package\n\nweb\n")).toBe(true);
  });

  it("keeps a sibling blocker, joined with 'and', where one stays open", () => {
    expect(clearBlocker(BARE_PAIR, 214, true)).toContain("## Blocked by\n\n#215.\n");
  });

  it("keeps a sibling's explanation intact", () => {
    const result = clearBlocker(EXPLAINED_PAIR, 233, true);
    expect(blockedBySection(result)).toBe("#226, for the picker.");
  });

  it("keeps an unnumbered blocker a numbered one sat beside", () => {
    const result = clearBlocker(BARE_TAIL, 222, true);
    expect(blockedBySection(result)).toBe("#210 and the picker.");
  });

  it("keeps a prose blocker that names no issue at all", () => {
    const result = clearBlocker(APPOSITIVE_LIST, 223, true);
    expect(blockedBySection(result)).toBe("The class table reads and the pickers.");
  });

  it("handles a list joined by commas alone, with no 'and'", () => {
    const result = clearBlocker(NO_AND_PAIR, 222, true);
    expect(blockedBySection(result)).toBe("#212 for the term a house rule contributes.");
  });

  it("leaves every other section untouched", () => {
    const result = clearBlocker(SINGLE_BLOCKER, 276, false);
    expect(result).toContain("## Related\n\n#26, which is what produces a roll to show.");
    expect(result).toContain("## Out of scope\n\nFiltering or searching the log.");
  });
});

describe("removeBlockerTerm", () => {
  it("is a no-op on a body with no Blocked by section", () => {
    const body = "## What\n\nNo blockers here.\n";
    expect(removeBlockerTerm(body, 1)).toBe(body);
  });

  it("keeps a blocker in its own paragraph, 'and' in its description included", () => {
    expect(blockedBySection(removeBlockerTerm(PARAGRAPH_PAIR, 453))).toBe(
      "#459, for the row the attack and damage chips sit in.",
    );
    expect(blockedBySection(removeBlockerTerm(PARAGRAPH_PAIR, 459))).toBe(
      "#453, for the grip toggle's design.",
    );
  });

  it("keeps the sentence describing the blocker that stays", () => {
    expect(blockedBySection(removeBlockerTerm(SENTENCE_AFTER_PAIR, 75))).toBe(
      "#77. There is no delete route and no character to hold a reference until both\nland.",
    );
  });

  it("leaves a term alone where the closed issue sits only in its description", () => {
    expect(removeBlockerTerm(REFERENCE_IN_DESCRIPTION, 196)).toBe(REFERENCE_IN_DESCRIPTION);
    expect(blockedBySection(removeBlockerTerm(REFERENCE_IN_DESCRIPTION, 192))).toMatch(
      /^#75, which makes homebrew rows reachable\./,
    );
  });
});

describe("stillBlocked", () => {
  it("stays true for a prose blocker with no issue number, even where nothing is open", () => {
    expect(stillBlocked(APPOSITIVE_LIST, 223, new Set())).toBe(true);
  });

  it("is false where the closed issue was the section's only blocker", () => {
    expect(stillBlocked(SINGLE_BLOCKER, 276, new Set())).toBe(false);
  });

  it("is true where a sibling issue number is still open", () => {
    expect(stillBlocked(BARE_PAIR, 214, new Set([215]))).toBe(true);
  });

  it("is false where the only other named issue is also closed", () => {
    expect(stillBlocked(BARE_PAIR, 214, new Set())).toBe(false);
  });

  it("reads an 'and' inside a blocker's description as part of it", () => {
    expect(stillBlocked(SENTENCE_AFTER_PAIR, 75, new Set())).toBe(false);
  });

  it("clears once every paragraph's blocker has closed", () => {
    expect(stillBlocked(PARAGRAPH_PAIR, 453, new Set([459]))).toBe(true);
    const after = removeBlockerTerm(PARAGRAPH_PAIR, 453);
    expect(stillBlocked(after, 459, new Set())).toBe(false);
  });

  it("stays true for an unnumbered blocker sitting beside a numbered one", () => {
    expect(stillBlocked(BARE_TAIL, 222, new Set())).toBe(true);
  });
});
