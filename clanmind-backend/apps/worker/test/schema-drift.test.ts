import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * C1 regression guard (BACKEND_DEEP_AUDIT.md): the repository layer must only
 * reference columns that actually exist in supabase/migrations. Before this
 * test existed, `quotaLimit()` selected `quota_states.limit_value` while the
 * migration defines `limit_override` — invisible to the suite because every
 * test stubs UsageRepository, fatal to every AI run against the real schema
 * (PGRST204 → quotaLimit throws → startRun throws).
 *
 * Method: parse CREATE TABLE / ALTER TABLE ADD COLUMN statements out of the
 * migrations directory, then statically cross-check every SELECT column list
 * and INSERT/UPDATE/UPSERT column list in ai-runtime.repo.ts against them.
 */

const here = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(here, "..", "..", "..");
const migrationsDir = join(backendRoot, "supabase", "migrations");

/** Content between the parenthesis at `openParenIndex` and its match. */
function balancedInner(source: string, openParenIndex: number): string {
  let depth = 0;
  let inString: '"' | "'" | "`" | null = null;
  for (let i = openParenIndex; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return source.slice(openParenIndex + 1, i);
    }
  }
  return source.slice(openParenIndex + 1);
}

/** Split on top-level commas only (parens/braces change depth). */
function splitTopLevel(body: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  let inString: '"' | "'" | "`" | null = null;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === undefined) break;
    if (inString) {
      current += ch;
      if (ch === "\\") {
        current += body[i + 1] ?? "";
        i++;
      } else if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      current += ch;
      continue;
    }
    if ("([{".includes(ch)) depth++;
    if (")]}".includes(ch)) depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim().length > 0) parts.push(current);
  return parts;
}

const COLUMN_CONSTRAINT_KEYWORDS = new Set([
  "primary",
  "unique",
  "check",
  "foreign",
  "constraint",
  "exclude",
]);

/**
 * table → set of columns, parsed from every migration's CREATE TABLE bodies
 * plus ALTER TABLE … ADD COLUMN statements.
 */
export function parseMigratedTables(): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();
  const ensure = (name: string): Set<string> => {
    let set = tables.get(name);
    if (!set) {
      set = new Set<string>();
      tables.set(name, set);
    }
    return set;
  };

  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    for (const m of sql.matchAll(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/gi,
    )) {
      const tableName = m[1];
      if (!tableName) continue;
      const columns = ensure(tableName);
      const body = balancedInner(sql, (m.index ?? 0) + m[0].length - 1);
      for (const def of splitTopLevel(body)) {
        const name = def.trim().match(/^"?([a-zA-Z_][a-zA-Z0-9_]*)"?(\s+)/)?.[1];
        if (!name) continue;
        if (COLUMN_CONSTRAINT_KEYWORDS.has(name.toLowerCase())) continue;
        columns.add(name);
      }
    }
    for (const m of sql.matchAll(
      /alter\s+table\s+(?:only\s+)?(?:public\.)?([a-zA-Z_][a-zA-Z0-9_]*)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi,
    )) {
      const table = m[1];
      const column = m[2];
      if (!table || !column) continue;
      ensure(table).add(column);
    }
  }
  return tables;
}

/** Full argument text of the call whose `(` sits at `openParenIndex`. */
function balancedCallArgs(source: string, openParenIndex: number): string {
  let depth = 0;
  let inString: '"' | "'" | "`" | null = null;
  for (let i = openParenIndex; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return source.slice(openParenIndex + 1, i);
    }
  }
  return source.slice(openParenIndex + 1);
}

/** Top-level property keys of an object-literal body (spreads skipped). */
function topLevelObjectKeys(body: string): string[] {
  const keys: string[] = [];
  for (const segment of splitTopLevel(body)) {
    const trimmed = segment.trim();
    if (trimmed.startsWith("...")) continue;
    const explicit = trimmed.match(/^([A-Za-z_$][A-Za-z0-9_$]*)\s*:/);
    if (explicit?.[1]) {
      keys.push(explicit[1]);
      continue;
    }
    const shorthand = trimmed.match(/^([A-Za-z_$][A-Za-z0-9_$]*)$/);
    if (shorthand?.[1]) keys.push(shorthand[1]);
  }
  return keys;
}

export interface ColumnReference {
  table: string;
  operation: "select" | "insert" | "update" | "upsert";
  columns: string[];
}

/**
 * Walk `.from("t")…select/insert/update/upsert` chains and pull out every
 * literal column reference. Chains are scanned sequentially, mirroring how
 * the Supabase builder is used in this codebase.
 */
export function extractColumnReferences(source: string): ColumnReference[] {
  const refs: ColumnReference[] = [];
  const callRe = /\.(from|select|insert|update|upsert)\s*\(/g;
  let currentTable: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = callRe.exec(source))) {
    const method = m[1] as ColumnReference["operation"] | "from";
    const openParen = m.index + m[0].length - 1;
    const args = balancedCallArgs(source, openParen);
    if (method === "from") {
      const table = args.trim().match(/^"([a-zA-Z_][a-zA-Z0-9_]*)"/)?.[1];
      currentTable = table ?? null;
      continue;
    }
    if (!currentTable) continue;
    if (method === "select") {
      const columns = args
        .match(/^\s*"([^"]*)"/)?.[1]
        ?.split(",")
        .map((c) => c.trim())
        .filter((c) => c.length > 0 && c !== "*" && !c.includes("("));
      if (columns && columns.length > 0) {
        refs.push({ table: currentTable, operation: "select", columns });
      }
      continue;
    }
    const objectStart = args.indexOf("{");
    if (objectStart === -1) continue; // e.g. update(variable) — nothing literal
    // Body of the FIRST top-level object literal in the argument list.
    let depth = 0;
    let end = objectStart;
    let inString: '"' | "'" | "`" | null = null;
    for (let i = objectStart; i < args.length; i++) {
      const ch = args[i];
      if (inString) {
        if (ch === "\\") i++;
        else if (ch === inString) inString = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") {
        inString = ch;
        continue;
      }
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const keys = topLevelObjectKeys(args.slice(objectStart + 1, end));
    if (keys.length > 0) {
      refs.push({ table: currentTable, operation: method, columns: keys });
    }
  }
  return refs;
}

describe("C1 regression: repository SQL must match migrated schema", () => {
  it("quota_states defines limit_override and never had limit_value (audit C1)", () => {
    const tables = parseMigratedTables();
    const quotaStates = tables.get("quota_states");
    expect(quotaStates, "quota_states must exist in migrations").toBeTruthy();
    expect(quotaStates).toContain("limit_override");
    expect(quotaStates).not.toContain("limit_value");
  });

  it("every column referenced by ai-runtime.repo.ts exists in the migrations", () => {
    const tables = parseMigratedTables();
    const source = readFileSync(
      join(backendRoot, "apps", "worker", "src", "repositories", "ai-runtime.repo.ts"),
      "utf8",
    );
    const refs = extractColumnReferences(source);
    // Sanity: the extractor must actually see the schema surface, including
    // the fixed quota lookup and the run/tool-call ledger writes.
    expect(refs.length).toBeGreaterThan(10);
    expect(refs).toContainEqual({
      table: "quota_states",
      operation: "select",
      columns: ["limit_override"],
    });

    const problems: string[] = [];
    for (const ref of refs) {
      const columns = tables.get(ref.table);
      if (!columns) {
        problems.push(`table "${ref.table}" has no CREATE TABLE in migrations`);
        continue;
      }
      for (const column of ref.columns) {
        if (!columns.has(column)) {
          problems.push(
            `${ref.operation} on "${ref.table}" references missing column "${column}"`,
          );
        }
      }
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
});
