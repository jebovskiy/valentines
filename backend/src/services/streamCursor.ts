/**
 * Cursor for the companion's SSE stream (`GET /api/companion/stream`).
 *
 * Kept free of I/O on purpose: this is the part that decides whether a
 * reconnecting client is told about what it missed, and it is far easier to
 * reason about (and to test) as a pure function over an already-fetched page.
 */

export interface StreamCursor {
  /** `sent_at` of the newest row already announced. */
  ts: string;
  /** Ids already announced at exactly `ts`. */
  ids: Set<string>;
}

export interface ValentineLike {
  id: string;
  sent_at: string;
}

export interface CursorAdvance<T> {
  /** Rows the client has not seen yet, oldest first. */
  fresh: T[];
  /** Cursor to carry into the next poll. */
  next: StreamCursor;
}

/**
 * Splits one fetched page into "still to announce" and the cursor to keep.
 *
 * The page is expected to be everything with `sent_at >= cursor.ts`, ascending.
 * Two details matter:
 *
 *  - a cursor is `(ts, ids)` rather than a bare timestamp, because `id` alone
 *    cannot order `valentines` (uuids are not sequential) and `sent_at` alone
 *    is not unique: one transaction shares a single `now()`, so the anchor row
 *    would otherwise be re-announced on every single poll;
 *  - `ids` is rebuilt from the page, not appended to, so rows the batch limit
 *    cut off stay out of the set and get announced by the next poll instead of
 *    being skipped forever.
 */
export function advanceStreamCursor<T extends ValentineLike>(
  cursor: StreamCursor,
  page: T[],
): CursorAdvance<T> {
  const fresh = page.filter((row) => !cursor.ids.has(row.id));
  if (fresh.length === 0) {
    return { fresh, next: cursor };
  }

  const newest = fresh[fresh.length - 1];
  return {
    fresh,
    next: {
      ts: newest.sent_at,
      ids: new Set(page.filter((row) => row.sent_at === newest.sent_at).map((row) => row.id)),
    },
  };
}

/** First cursor the stream should use when the client resumes from an id. */
export function cursorFromRow<T extends ValentineLike>(row: T): StreamCursor {
  return { ts: row.sent_at, ids: new Set([row.id]) };
}
