/**
 * Unit tests for the policy engine — pure logic, no DB required.
 */
import { describe, it, expect } from 'vitest';
import { evaluatePolicy } from './policyEngine.js';
import type { PolicyRule, EvaluationSubject } from './policyEngine.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function rule(overrides: Partial<PolicyRule> & Pick<PolicyRule, 'type'>): PolicyRule {
  return {
    id: 'r1',
    message: 'violation',
    severity: 'error',
    ...overrides,
  };
}

// ── Empty rules ───────────────────────────────────────────────────────────────

describe('evaluatePolicy — no rules', () => {
  it('returns skip when rules array is empty', () => {
    const { result, violations } = evaluatePolicy([], {});
    expect(result).toBe('skip');
    expect(violations).toHaveLength(0);
  });
});

// ── require_field ─────────────────────────────────────────────────────────────

describe('require_field', () => {
  const subject: EvaluationSubject = { node: { name: 'my-node', description: '' } };

  it('passes when field is present and non-empty', () => {
    const { result } = evaluatePolicy(
      [rule({ type: 'require_field', field: 'name' })],
      subject
    );
    expect(result).toBe('pass');
  });

  it('fails when field is empty string', () => {
    const { result, violations } = evaluatePolicy(
      [rule({ type: 'require_field', field: 'description' })],
      subject
    );
    expect(result).toBe('fail');
    expect(violations[0].ruleId).toBe('r1');
  });

  it('fails when field is missing', () => {
    const { result } = evaluatePolicy(
      [rule({ type: 'require_field', field: 'nonexistent' })],
      subject
    );
    expect(result).toBe('fail');
  });

  it('supports nested field paths', () => {
    const s: EvaluationSubject = { metadata: { config: { key: 'value' } } as Record<string, unknown> };
    const { result } = evaluatePolicy(
      [rule({ type: 'require_field', field: 'config.key' })],
      s
    );
    expect(result).toBe('pass');
  });

  it('fails nested path when intermediate key missing', () => {
    const { result } = evaluatePolicy(
      [rule({ type: 'require_field', field: 'config.key' })],
      { metadata: {} }
    );
    expect(result).toBe('fail');
  });
});

// ── deny_value ────────────────────────────────────────────────────────────────

describe('deny_value', () => {
  it('fails when field equals the denied value', () => {
    const { result } = evaluatePolicy(
      [rule({ type: 'deny_value', field: 'status', value: 'deprecated' })],
      { node: { status: 'deprecated' } }
    );
    expect(result).toBe('fail');
  });

  it('passes when field differs from the denied value', () => {
    const { result } = evaluatePolicy(
      [rule({ type: 'deny_value', field: 'status', value: 'deprecated' })],
      { node: { status: 'active' } }
    );
    expect(result).toBe('pass');
  });
});

// ── require_connection ────────────────────────────────────────────────────────

describe('require_connection', () => {
  it('fails when connectionCount is 0', () => {
    const { result } = evaluatePolicy(
      [rule({ type: 'require_connection' })],
      { connectionCount: 0 }
    );
    expect(result).toBe('fail');
  });

  it('passes when connectionCount > 0', () => {
    const { result } = evaluatePolicy(
      [rule({ type: 'require_connection' })],
      { connectionCount: 2 }
    );
    expect(result).toBe('pass');
  });

  it('fails when connectionCount is undefined', () => {
    const { result } = evaluatePolicy(
      [rule({ type: 'require_connection' })],
      {}
    );
    expect(result).toBe('fail');
  });
});

// ── max_runs ──────────────────────────────────────────────────────────────────

describe('max_runs', () => {
  it('fails when runCount exceeds threshold', () => {
    const { result } = evaluatePolicy(
      [rule({ type: 'max_runs', threshold: 5 })],
      { runCount: 6 }
    );
    expect(result).toBe('fail');
  });

  it('passes when runCount equals threshold', () => {
    const { result } = evaluatePolicy(
      [rule({ type: 'max_runs', threshold: 5 })],
      { runCount: 5 }
    );
    expect(result).toBe('pass');
  });

  it('uses 0 as default threshold when not set', () => {
    const { result } = evaluatePolicy(
      [rule({ type: 'max_runs' })],
      { runCount: 1 }
    );
    expect(result).toBe('fail');
  });
});

// ── severity: warn ────────────────────────────────────────────────────────────

describe('severity: warn', () => {
  it('returns warn (not fail) when all violations are warn-level', () => {
    const { result, violations } = evaluatePolicy(
      [rule({ type: 'require_field', field: 'missing', severity: 'warn' })],
      {}
    );
    expect(result).toBe('warn');
    expect(violations[0].severity).toBe('warn');
  });

  it('returns fail when at least one violation is error-level', () => {
    const rules: PolicyRule[] = [
      rule({ id: 'w1', type: 'require_field', field: 'a', severity: 'warn' }),
      rule({ id: 'e1', type: 'require_field', field: 'b', severity: 'error' }),
    ];
    const { result } = evaluatePolicy(rules, {});
    expect(result).toBe('fail');
  });
});

// ── unknown rule type ─────────────────────────────────────────────────────────

describe('custom / unknown rule type', () => {
  it('skips custom rules (no violation produced)', () => {
    const { result } = evaluatePolicy(
      [rule({ type: 'custom' })],
      {}
    );
    expect(result).toBe('pass');
  });
});

// ── multiple rules ────────────────────────────────────────────────────────────

describe('multiple rules', () => {
  it('accumulates violations from all rules', () => {
    const rules: PolicyRule[] = [
      rule({ id: 'r1', type: 'require_field', field: 'name' }),
      rule({ id: 'r2', type: 'require_field', field: 'owner' }),
    ];
    const { violations } = evaluatePolicy(rules, {});
    expect(violations.map(v => v.ruleId)).toEqual(['r1', 'r2']);
  });

  it('only reports violations for failing rules', () => {
    const rules: PolicyRule[] = [
      rule({ id: 'r1', type: 'require_field', field: 'name' }),
      rule({ id: 'r2', type: 'require_field', field: 'owner' }),
    ];
    const { violations } = evaluatePolicy(rules, { node: { name: 'x' } });
    expect(violations).toHaveLength(1);
    expect(violations[0].ruleId).toBe('r2');
  });
});
