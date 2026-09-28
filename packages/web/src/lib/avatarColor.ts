const AVATAR_COLORS = ["#3f5d44", "#7a3b2e", "#3a4f7a", "#7a3b53", "#6b4f3a"] as const;

/** Hashes the id, so a character keeps its color across reloads with no stored field. */
export function avatarColor(id: string): string {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}
