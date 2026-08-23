/**
 * Prefixed identifier helpers. Human-readable prefixes make logs and debug
 * output unambiguous; the underlying values are UUIDs.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function newId(): string {
  return crypto.randomUUID();
}

export function newEventId(): string {
  // §17 envelope: "evt_01..." — prefixed ULID-style sortable id.
  return `evt_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function newRequestId(): string {
  return `req_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}
