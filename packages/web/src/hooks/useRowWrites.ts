import { type QueryKey, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

/**
 * Guards a list that edits its definition entries by index. An index holds only once the
 * last row write has landed and the rows under `rowsKey` have refetched: a second click
 * before then could reach the entry that moved into place, or a duplicate holding the same
 * row. `settled` reads both at the click rather than from render state, which a query's
 * observers update a tick late, too late for a double click. `hold` runs a write and counts
 * it until its own promise settles, and `writing` mirrors that count to draw the list busy.
 */
export function useRowWrites(rowsKey: QueryKey) {
  const queryClient = useQueryClient();
  const pending = useRef(0);
  const [count, setCount] = useState(0);
  const settled = () =>
    pending.current === 0 && queryClient.isFetching({ queryKey: rowsKey }) === 0;
  // Released from the write's own promise: a later `mutate` on the same observer detaches
  // it from an earlier write, whose per-call `onSettled` then never runs.
  const hold = <T>(run: () => Promise<T>) => {
    pending.current += 1;
    setCount((now) => now + 1);
    return run().finally(() => {
      pending.current -= 1;
      setCount((now) => now - 1);
    });
  };
  return { settled, hold, writing: count > 0 };
}
