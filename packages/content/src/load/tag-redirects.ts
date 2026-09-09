/**
 * `generated/gendata-tag-redirects.json` into `tag_redirects`.
 *
 * Upstream groups redirects by the namespace the link lands in and keys them by
 * its hash. A target is a bare hash in the same namespace, or a `{ hash, page }`
 * pair naming another one.
 */
import type { Loader, Row } from "./index.ts";
import { isRecord } from "./json.ts";

const FILE = "data/generated/gendata-tag-redirects.json";

function target(tag: string, to: unknown, context: string): Row {
  if (typeof to === "string") return { to_tag: tag, to_key: to };
  if (isRecord(to) && typeof to.hash === "string" && typeof to.page === "string") {
    return { to_tag: to.page, to_key: to.hash };
  }
  throw new Error(`${context}: target is neither a hash nor a { hash, page } pair`);
}

export const tagRedirects: Loader = {
  name: "tag-redirects",
  files: [FILE],
  rows: (sources) => {
    const parsed = sources.get(FILE);
    if (!isRecord(parsed)) throw new Error(`${FILE} is not an object`);
    return {
      tag_redirects: Object.entries(parsed).flatMap(([tag, group]) => {
        if (!isRecord(group)) throw new Error(`${FILE}: ${tag} holds no redirect map`);
        return Object.entries(group).map(([from, to]) => ({
          tag,
          from_key: from,
          ...target(tag, to, `${FILE}: ${tag} ${from}`),
        }));
      }),
    };
  },
};
