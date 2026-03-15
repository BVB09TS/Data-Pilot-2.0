/**
 * SQL AST utilities — wraps node-sql-parser for dbt SQL analysis.
 *
 * Used by:
 *  - C-3: grainJoins, duplicateMetrics agents (replace regex heuristics)
 *  - C-9: column-level lineage extraction in parser
 *
 * Fallback: if parsing fails (DuckDB-specific syntax, Jinja leftovers, etc.)
 * we return null so callers can fall back to regex.
 */

import Parser from 'node-sql-parser';

const sqlParser = new Parser();

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ColumnRef { table: string | null; column: string }

export interface SelectColumn {
  alias: string;          // output column name (alias or inferred)
  exprType: string;       // 'column_ref' | 'aggr_func' | 'binary_expr' | 'function' | '*' | 'other'
  sourceRefs: ColumnRef[]; // upstream columns referenced
}

export interface ColumnLineageEntry {
  output: string;
  exprType: string;
  sourceRefs: { model: string; column: string }[];
}

export interface SqlAstSummary {
  hasGroupBy: boolean;
  hasAggregateFunctions: boolean;
  hasWindowFunctions: boolean;
  hasJoins: boolean;
  joinCount: number;
  selectColumns: SelectColumn[];
  tableAliases: Map<string, string>;  // alias → table_name (last segment)
  cteNames: Set<string>;
}

// ── Parser ────────────────────────────────────────────────────────────────────

/** Strip Jinja tags and normalise SQL for parsing. */
function cleanSql(sql: string): string {
  return sql
    .replace(/\{\{.*?\}\}/gs, '__ref__')   // {{ ref('x') }} → __ref__
    .replace(/\{%-?.*?-?%\}/gs, '')         // {% set ... %} blocks
    .replace(/--[^\n]*/g, '')               // inline comments
    .replace(/\/\*[\s\S]*?\*\//g, '')       // block comments
    .trim();
}

/** Try to parse with multiple dialects; return first success. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeParse(sql: string): any | null {
  const clean = cleanSql(sql);
  for (const db of ['PostgreSQL', 'BigQuery', 'MySQL']) {
    try {
      // astify returns array for multi-statement, object for single
      const ast = sqlParser.astify(clean, { database: db });
      // Normalise to single statement
      return Array.isArray(ast) ? ast[0] : ast;
    } catch { /* try next dialect */ }
  }
  return null;
}

// ── AST walkers ───────────────────────────────────────────────────────────────

/** Extract a plain string from a column value (handles v5 PG object shape). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveColumnName(col: any): string {
  if (typeof col === 'string') return col;
  // PG dialect: { expr: { type: 'default', value: 'col_name' } }
  if (col?.expr?.value) return String(col.expr.value);
  if (col?.value)       return String(col.value);
  return String(col ?? '');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectColumnRefs(node: any, refs: ColumnRef[] = []): ColumnRef[] {
  if (!node || typeof node !== 'object') return refs;

  if (node.type === 'column_ref') {
    refs.push({ table: node.table ?? null, column: resolveColumnName(node.column) });
    return refs;
  }

  for (const val of Object.values(node)) {
    if (val && typeof val === 'object') collectColumnRefs(val, refs);
  }
  return refs;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAggregateFunc(node: any): boolean {
  if (!node) return false;
  if (node.type === 'aggr_func') return true;
  if (node.type === 'function') {
    // node.name can be string, { name: string }, or array — extract safely
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawName: any = node.name;
    let name = '';
    if (typeof rawName === 'string') name = rawName;
    else if (rawName && typeof rawName === 'object' && typeof rawName.name === 'string') name = rawName.name;
    name = name.toUpperCase();
    return ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'STDDEV', 'VARIANCE',
      'PERCENTILE_CONT', 'PERCENTILE_DISC', 'APPROX_COUNT_DISTINCT'].includes(name);
  }
  return false;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function containsAggregate(node: any): boolean {
  if (!node || typeof node !== 'object') return false;
  if (isAggregateFunc(node)) return true;
  return Object.values(node).some(v => v && typeof v === 'object' && containsAggregate(v));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function containsWindow(node: any): boolean {
  if (!node || typeof node !== 'object') return false;
  if (node.type === 'window_func' || node.over !== undefined) return true;
  return Object.values(node).some(v => v && typeof v === 'object' && containsWindow(v));
}

// ── Table alias map ───────────────────────────────────────────────────────────

/** Strip schema prefix: 'main.customers' → 'customers' */
function stripSchema(tableName: string): string {
  const parts = tableName.split('.');
  return parts[parts.length - 1].replace(/["`]/g, '').toLowerCase();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildAliasMap(ast: any): Map<string, string> {
  const map = new Map<string, string>();
  const froms: any[] = [];

  if (ast.from) froms.push(...(Array.isArray(ast.from) ? ast.from : [ast.from]));

  for (const f of froms) {
    if (!f || f.type === 'subquery') continue;
    const tableName = stripSchema(f.table ?? f.name ?? '');
    const alias = (f.as ?? f.alias ?? tableName).toLowerCase();
    if (tableName) {
      map.set(alias, tableName);
      map.set(tableName, tableName);
    }
    // Handle JOIN entries nested in from
    if (f.join) {
      const jTable = stripSchema(f.table ?? '');
      const jAlias = (f.as ?? jTable).toLowerCase();
      if (jTable) { map.set(jAlias, jTable); map.set(jTable, jTable); }
    }
  }
  return map;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCteNames(ast: any): Set<string> {
  const names = new Set<string>();
  if (ast.with) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const cte of ast.with as any[]) {
      // PG dialect: cte.name is { type: 'default', value: 'base' } not a string
      const raw = cte.name;
      const name = typeof raw === 'string' ? raw : (raw?.value ?? raw?.name ?? '');
      if (name) names.add(String(name).toLowerCase());
    }
  }
  return names;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Full parse — returns structured summary or null on failure. */
export function analyzeSQL(sql: string): SqlAstSummary | null {
  const ast = safeParse(sql);
  if (!ast || ast.type !== 'select') return null;

  const tableAliases = buildAliasMap(ast);
  const cteNames = getCteNames(ast);

  // Group By — PG dialect: { columns: [...] }; older dialects: array
  const gb = ast.groupby;
  const hasGroupBy = Array.isArray(gb) ? gb.length > 0 : (gb?.columns?.length ?? 0) > 0;

  // Joins
  const joins: any[] = (ast.from ?? []).filter((f: any) => f?.join);
  const hasJoins = joins.length > 0;

  // Window functions
  const hasWindowFunctions = containsWindow(ast);

  // Aggregate functions anywhere in SELECT
  const hasAggregateFunctions = hasGroupBy ||
    (Array.isArray(ast.columns) && ast.columns.some((c: any) => containsAggregate(c?.expr)));

  // SELECT columns
  const selectColumns: SelectColumn[] = [];
  if (Array.isArray(ast.columns)) {
    for (const col of ast.columns as any[]) {
      if (col === '*' || col?.expr?.column === '*') {
        selectColumns.push({ alias: '*', exprType: '*', sourceRefs: [] });
        continue;
      }
      const expr = col?.expr;
      // col.as can be a string or object; expr.column may be a PG-dialect object
      const rawAlias = col?.as ?? (expr?.type === 'column_ref' ? resolveColumnName(expr.column) : null);
      const alias = (typeof rawAlias === 'string' ? rawAlias : 'expr').toLowerCase();
      const exprType: string = isAggregateFunc(expr) ? 'aggr_func'
        : expr?.type === 'column_ref' ? 'column_ref'
        : expr?.type ?? 'other';
      const sourceRefs = collectColumnRefs(expr);
      selectColumns.push({ alias, exprType, sourceRefs });
    }
  }

  return { hasGroupBy, hasAggregateFunctions, hasWindowFunctions, hasJoins, joinCount: joins.length, selectColumns, tableAliases, cteNames };
}

// ── C-3: Grain detection ──────────────────────────────────────────────────────

export type Grain = 'aggregate' | 'transaction' | 'unknown';

const AGG_REGEX = /\b(SUM|COUNT|AVG|MIN|MAX|STDDEV|VARIANCE|PERCENTILE|APPROX_COUNT)\s*\(/i;
const GROUP_BY_REGEX = /\bGROUP\s+BY\b/i;

/** AST-first grain inference with regex fallback. */
export function inferGrain(sql: unknown): Grain {
  if (!sql || typeof sql !== 'string') return 'unknown';
  const summary = analyzeSQL(sql);
  if (summary) {
    return summary.hasAggregateFunctions || summary.hasGroupBy ? 'aggregate' : 'transaction';
  }
  // Regex fallback
  const hasAgg = AGG_REGEX.test(sql) || GROUP_BY_REGEX.test(sql);
  return hasAgg ? 'aggregate' : 'transaction';
}

// ── C-3: SQL fingerprinting for duplicate metric detection ────────────────────

/** Normalise SQL to a comparable fingerprint — removes formatting, aliases. */
export function fingerprintSQL(sql: string): string {
  const ast = safeParse(sql);
  if (!ast) {
    // Regex fallback: strip whitespace and lowercase
    return sql.replace(/\s+/g, ' ').replace(/--[^\n]*/g, '').toLowerCase().trim();
  }
  try {
    // Regenerate normalised SQL from AST
    return sqlParser.sqlify(ast).toLowerCase().replace(/\s+/g, ' ').trim();
  } catch {
    return sql.replace(/\s+/g, ' ').toLowerCase().trim();
  }
}

/** Extract just the aggregate expressions from a SQL string (for metric comparison). */
export function extractAggregateExpressions(sql: string): string[] {
  const summary = analyzeSQL(sql);
  if (!summary) return [];
  return summary.selectColumns
    .filter(c => c.exprType === 'aggr_func')
    .map(c => c.alias);
}

// ── C-9: Column-level lineage ─────────────────────────────────────────────────

/**
 * Given a model's compiled SQL and the list of upstream model names,
 * return per-output-column lineage: which upstream model+column it came from.
 *
 * CTE names are treated as intermediate — we don't surface them as "upstream models".
 */
export function extractColumnLineage(
  sql: string,
  upstreamModelNames: string[],
): ColumnLineageEntry[] {
  const summary = analyzeSQL(sql);
  if (!summary) return [];

  const { selectColumns, tableAliases, cteNames } = summary;
  const upstreamSet = new Set(upstreamModelNames.map(n => n.toLowerCase()));

  const lineage: ColumnLineageEntry[] = [];

  for (const col of selectColumns) {
    if (col.alias === '*') continue;

    const sourceRefs: { model: string; column: string }[] = [];

    for (const ref of col.sourceRefs) {
      const tableAlias = ref.table?.toLowerCase() ?? '';
      const resolvedTable = tableAlias
        ? (tableAliases.get(tableAlias) ?? tableAlias)
        : null;

      if (!resolvedTable) continue;
      if (cteNames.has(resolvedTable)) continue;            // skip CTE intermediates
      if (!upstreamSet.has(resolvedTable)) continue;        // only known upstreams

      sourceRefs.push({ model: resolvedTable, column: ref.column });
    }

    lineage.push({
      output: col.alias,
      exprType: col.exprType,
      sourceRefs,
    });
  }

  return lineage;
}
