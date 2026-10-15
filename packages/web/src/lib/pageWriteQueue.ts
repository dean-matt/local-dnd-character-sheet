import type { QueryClient } from "@tanstack/react-query";

// One queue per character and client, so every page write — a replace, an undo, a restore —
// leaves in the order it was made.
const queues = new WeakMap<QueryClient, Map<string, Promise<unknown>>>();

/** Sends `send` once every page write queued before it for `characterId` has settled. */
export function queuePageWrite<T>(
  client: QueryClient,
  characterId: string,
  send: () => Promise<T>,
): Promise<T> {
  let byCharacter = queues.get(client);
  if (!byCharacter) {
    byCharacter = new Map();
    queues.set(client, byCharacter);
  }
  const write = (byCharacter.get(characterId) ?? Promise.resolve()).then(send);
  byCharacter.set(
    characterId,
    write.catch(() => undefined),
  );
  return write;
}
