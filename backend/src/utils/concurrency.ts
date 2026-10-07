/**
 * A counting semaphore with no dependency and no timers.
 *
 * Uploads are the obvious user: a request hands the process an unbounded
 * payload (base64 of a photo) and asks it to decode, compress and push that to
 * storage. A burst of them would otherwise all be in flight at once, and the
 * only thing keeping the burst in check is the rate limit — which counts
 * requests, not bytes.
 */
export class Semaphore {
  private available: number;
  private readonly waiters: Array<() => void> = [];

  constructor(limit: number) {
    this.available = Math.max(1, Math.floor(limit));
  }

  get pending(): number {
    return this.waiters.length;
  }

  async acquire(): Promise<void> {
    if (this.available > 0) {
      this.available -= 1;
      return;
    }
    // Woken waiters take over the slot that was released; `available` is
    // deliberately left alone so the limit never drifts upward.
    await new Promise<void>((resolve) => this.waiters.push(resolve));
  }

  release(): void {
    const next = this.waiters.shift();
    if (next) next();
    else this.available += 1;
  }

  async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }
}

/**
 * Runs `task` over `items` with at most `limit` in flight, preserving order in
 * the returned array. Errors are the caller's business: pass a task that
 * handles its own failures if a single bad item must not abort the batch.
 */
export async function mapConcurrent<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await task(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}
