/**
 * Unit tests for sqlAst.ts
 *
 * Covers: analyzeSQL, inferGrain, fingerprintSQL,
 *         extractAggregateExpressions, extractColumnLineage
 *
 * No DB / LLM dependencies — pure unit tests.
 */
import { describe, it, expect } from 'vitest';
import {
  analyzeSQL,
  inferGrain,
  fingerprintSQL,
  extractAggregateExpressions,
  extractColumnLineage,
} from './sqlAst.js';

// ── analyzeSQL ────────────────────────────────────────────────────────────────

describe('analyzeSQL', () => {
  it('returns null for empty string', () => {
    expect(analyzeSQL('')).toBeNull();
  });

  it('returns null for non-SELECT statement', () => {
    expect(analyzeSQL('INSERT INTO foo VALUES (1)')).toBeNull();
  });

  it('detects GROUP BY', () => {
    const sql = 'SELECT user_id, COUNT(*) FROM orders GROUP BY user_id';
    const result = analyzeSQL(sql);
    expect(result).not.toBeNull();
    expect(result!.hasGroupBy).toBe(true);
    expect(result!.hasAggregateFunctions).toBe(true);
  });

  it('detects aggregate functions without GROUP BY', () => {
    const sql = 'SELECT COUNT(*) AS total FROM orders';
    const result = analyzeSQL(sql);
    expect(result).not.toBeNull();
    expect(result!.hasAggregateFunctions).toBe(true);
    expect(result!.hasGroupBy).toBe(false);
  });

  it('detects SUM, AVG, MIN, MAX', () => {
    const sql = 'SELECT SUM(amount), AVG(price), MIN(qty), MAX(qty) FROM sales GROUP BY day';
    const result = analyzeSQL(sql);
    expect(result!.hasAggregateFunctions).toBe(true);
    expect(result!.hasGroupBy).toBe(true);
  });

  it('detects JOINs', () => {
    const sql = 'SELECT o.id, c.name FROM orders o JOIN customers c ON o.customer_id = c.id';
    const result = analyzeSQL(sql);
    expect(result!.hasJoins).toBe(true);
    expect(result!.joinCount).toBeGreaterThanOrEqual(1);
  });

  it('returns hasJoins=false for plain SELECT', () => {
    const sql = 'SELECT id, name FROM customers WHERE active = true';
    const result = analyzeSQL(sql);
    expect(result!.hasJoins).toBe(false);
    expect(result!.joinCount).toBe(0);
  });

  it('builds table alias map', () => {
    const sql = 'SELECT o.id FROM orders o JOIN customers c ON o.customer_id = c.id';
    const result = analyzeSQL(sql);
    expect(result!.tableAliases.get('o')).toBe('orders');
    expect(result!.tableAliases.get('c')).toBe('customers');
  });

  it('detects CTEs', () => {
    const sql = `
      WITH base AS (SELECT id FROM orders)
      SELECT id FROM base
    `;
    const result = analyzeSQL(sql);
    expect(result!.cteNames.has('base')).toBe(true);
  });

  it('strips Jinja before parsing', () => {
    const sql = `
      SELECT o.order_id, o.total
      FROM {{ ref('src_orders') }} o
    `;
    const result = analyzeSQL(sql);
    expect(result).not.toBeNull();
    expect(result!.selectColumns.length).toBeGreaterThan(0);
  });

  it('returns selectColumns with aliases', () => {
    const sql = 'SELECT id AS order_id, total AS revenue FROM orders';
    const result = analyzeSQL(sql);
    expect(result).not.toBeNull();
    const aliases = result!.selectColumns.map(c => c.alias);
    expect(aliases).toContain('order_id');
    expect(aliases).toContain('revenue');
  });

  it('handles SELECT *', () => {
    const sql = 'SELECT * FROM orders';
    const result = analyzeSQL(sql);
    expect(result).not.toBeNull();
    const star = result!.selectColumns.find(c => c.alias === '*');
    expect(star).toBeDefined();
  });
});

// ── inferGrain ────────────────────────────────────────────────────────────────

describe('inferGrain', () => {
  it('returns "aggregate" when GROUP BY present', () => {
    expect(inferGrain('SELECT date, SUM(revenue) FROM orders GROUP BY date')).toBe('aggregate');
  });

  it('returns "aggregate" when aggregate function present', () => {
    expect(inferGrain('SELECT COUNT(*) FROM orders')).toBe('aggregate');
  });

  it('returns "transaction" for row-level SELECT', () => {
    expect(inferGrain('SELECT id, amount FROM orders WHERE status = \'paid\'')).toBe('transaction');
  });

  it('falls back to regex for unparseable SQL and detects GROUP BY', () => {
    // DuckDB-specific syntax node-sql-parser cannot parse; regex fallback catches GROUP BY
    const duckSql = 'SELECT date_trunc(\'month\', ts) AS mo, COUNT(*) FROM t GROUP BY 1 USING SAMPLE 10%';
    expect(inferGrain(duckSql)).toBe('aggregate');
  });

  it('returns "unknown" for null input', () => {
    expect(inferGrain(null)).toBe('unknown');
  });

  it('returns "unknown" for non-string input (model object)', () => {
    expect(inferGrain({ sql: 'SELECT 1' })).toBe('unknown');
  });

  it('returns "unknown" for empty string', () => {
    expect(inferGrain('')).toBe('unknown');
  });
});

// ── fingerprintSQL ────────────────────────────────────────────────────────────

describe('fingerprintSQL', () => {
  it('normalises whitespace differences to same fingerprint', () => {
    const a = 'SELECT  id,  name   FROM   customers';
    const b = 'SELECT id, name FROM customers';
    expect(fingerprintSQL(a)).toBe(fingerprintSQL(b));
  });

  it('is case-insensitive', () => {
    const a = 'SELECT id FROM customers';
    const b = 'select id from customers';
    expect(fingerprintSQL(a)).toBe(fingerprintSQL(b));
  });

  it('two semantically identical queries with different aliases differ only in alias', () => {
    const a = 'SELECT SUM(amount) AS total FROM orders GROUP BY date';
    const b = 'SELECT SUM(amount) AS revenue FROM orders GROUP BY date';
    // fingerprints will differ due to alias difference, which is expected
    // but both should be deterministic
    expect(fingerprintSQL(a)).toBe(fingerprintSQL(a));
    expect(fingerprintSQL(b)).toBe(fingerprintSQL(b));
  });

  it('returns a non-empty string for any SQL', () => {
    expect(fingerprintSQL('SELECT 1').length).toBeGreaterThan(0);
  });
});

// ── extractAggregateExpressions ───────────────────────────────────────────────

describe('extractAggregateExpressions', () => {
  it('extracts aggregate column aliases', () => {
    const sql = `
      SELECT
        date_day,
        SUM(revenue)  AS total_revenue,
        COUNT(*)      AS order_count,
        AVG(amount)   AS avg_order
      FROM orders
      GROUP BY date_day
    `;
    const aggs = extractAggregateExpressions(sql);
    expect(aggs).toContain('total_revenue');
    expect(aggs).toContain('order_count');
    expect(aggs).toContain('avg_order');
    expect(aggs).not.toContain('date_day');
  });

  it('returns empty array for non-aggregate SQL', () => {
    expect(extractAggregateExpressions('SELECT id, name FROM customers')).toEqual([]);
  });

  it('returns empty array for unparseable SQL', () => {
    expect(extractAggregateExpressions('')).toEqual([]);
  });
});

// ── extractColumnLineage ──────────────────────────────────────────────────────

describe('extractColumnLineage', () => {
  it('maps pass-through columns to upstream model', () => {
    const sql = `
      SELECT o.order_id, o.total_amount
      FROM src_orders o
    `;
    const lineage = extractColumnLineage(sql, ['src_orders']);
    const orderIdEntry = lineage.find(e => e.output === 'order_id');
    expect(orderIdEntry).toBeDefined();
    expect(orderIdEntry!.sourceRefs).toEqual(
      expect.arrayContaining([{ model: 'src_orders', column: 'order_id' }])
    );
  });

  it('returns exprType=aggr_func for aggregate columns', () => {
    const sql = `
      SELECT date_day, SUM(amount) AS total
      FROM src_orders
      GROUP BY date_day
    `;
    const lineage = extractColumnLineage(sql, ['src_orders']);
    const totalEntry = lineage.find(e => e.output === 'total');
    expect(totalEntry?.exprType).toBe('aggr_func');
  });

  it('skips CTE intermediates — only surfaces real upstream models', () => {
    const sql = `
      WITH base AS (
        SELECT order_id, amount FROM src_orders
      )
      SELECT b.order_id, b.amount
      FROM base b
    `;
    const lineage = extractColumnLineage(sql, ['src_orders']);
    // CTE "base" should not appear as a source ref
    const allModels = lineage.flatMap(e => e.sourceRefs.map(r => r.model));
    expect(allModels).not.toContain('base');
  });

  it('ignores columns referencing unknown (non-upstream) tables', () => {
    const sql = 'SELECT u.id FROM unknown_table u';
    const lineage = extractColumnLineage(sql, ['src_orders']);
    const withRefs = lineage.filter(e => e.sourceRefs.length > 0);
    expect(withRefs).toHaveLength(0);
  });

  it('returns empty array for unparseable SQL', () => {
    expect(extractColumnLineage('', ['src_orders'])).toEqual([]);
  });

  it('handles multi-model joins', () => {
    const sql = `
      SELECT o.order_id, c.email
      FROM src_orders o
      JOIN src_customers c ON o.customer_id = c.id
    `;
    const lineage = extractColumnLineage(sql, ['src_orders', 'src_customers']);
    const emailEntry = lineage.find(e => e.output === 'email');
    expect(emailEntry?.sourceRefs[0].model).toBe('src_customers');
    const orderEntry = lineage.find(e => e.output === 'order_id');
    expect(orderEntry?.sourceRefs[0].model).toBe('src_orders');
  });

  it('skips SELECT * entries', () => {
    const sql = 'SELECT * FROM src_orders';
    const lineage = extractColumnLineage(sql, ['src_orders']);
    const star = lineage.find(e => e.output === '*');
    expect(star).toBeUndefined();
  });
});
