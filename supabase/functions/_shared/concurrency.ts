/**
 * Run `worker` over `items` with at most `limit` in flight at once, preserving
 * result order. Background jobs use this instead of one `await` per row so a
 * run of N receipts/reminders costs ~N/limit round-trip latencies, not N,
 * while never flooding Postgres or a third-party API with unbounded fan-out.
 * Errors are caught per item and returned as `null` so one failure never
 * aborts the batch; callers decide what a null means.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<(R | null)[]> {
  const results: (R | null)[] = new Array(items.length).fill(null);
  let next = 0;
  const width = Math.max(1, Math.min(limit, items.length));
  await Promise.all(
    Array.from({ length: width }, async () => {
      while (next < items.length) {
        const index = next++;
        try {
          results[index] = await worker(items[index], index);
        } catch {
          results[index] = null;
        }
      }
    }),
  );
  return results;
}
