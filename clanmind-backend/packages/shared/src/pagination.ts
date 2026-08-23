/**
 * Cursor-based pagination (spec §156). No offset/`?page=100000` scans.
 */
export interface Page<T> {
  items: T[];
  /** Opaque cursor for the next page; absent when exhausted. */
  next_cursor: string | null;
}

export function encodeCursor(value: Record<string, string | number>): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): Record<string, string | number> {
  const parsed: unknown = JSON.parse(
    Buffer.from(cursor, "base64url").toString("utf8"),
  );
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid cursor");
  }
  return parsed as Record<string, string | number>;
}

export function buildPage<T>(
  items: T[],
  limit: number,
  cursorOf: (item: T) => Record<string, string | number>,
): Page<T> {
  if (items.length <= limit) return { items, next_cursor: null };
  const pageItems = items.slice(0, limit);
  const last = pageItems[pageItems.length - 1];
  if (last === undefined) return { items: pageItems, next_cursor: null };
  return { items: pageItems, next_cursor: encodeCursor(cursorOf(last)) };
}
