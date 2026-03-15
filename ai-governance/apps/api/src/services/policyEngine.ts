/**
 * Policy Engine — evaluates a set of rules against a subject (node or run).
 *
 * Rule schema:
 * {
 *   id: string,
 *   type: 'require_field' | 'deny_value' | 'require_connection' | 'max_runs' | 'custom',
 *   field?: string,          // for require_field / deny_value
 *   value?: unknown,         // for deny_value
 *   message: string,         // human-readable violation message
 *   severity: 'error' | 'warn'
 * }
 */

export type RuleType =
  | 'require_field'
  | 'deny_value'
  | 'require_connection'
  | 'max_runs'
  | 'custom';

export type RuleSeverity = 'error' | 'warn';

export interface PolicyRule {
  id: string;
  type: RuleType;
  field?: string;
  value?: unknown;
  threshold?: number;
  message: string;
  severity: RuleSeverity;
}

export interface EvaluationSubject {
  node?: Record<string, unknown>;
  run?: Record<string, unknown>;
  connectionCount?: number;
  runCount?: number;
  metadata?: Record<string, unknown>;
}

export interface Violation {
  ruleId: string;
  message: string;
  severity: RuleSeverity;
}

export type EvaluationResult = 'pass' | 'fail' | 'warn' | 'skip';

export interface PolicyEvaluation {
  result: EvaluationResult;
  violations: Violation[];
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function evaluateRule(rule: PolicyRule, subject: EvaluationSubject): Violation | null {
  const target = { ...subject.node, ...subject.run, ...subject.metadata };

  switch (rule.type) {
    case 'require_field': {
      if (!rule.field) return null;
      const val = getNestedValue(target, rule.field);
      if (val === undefined || val === null || val === '') {
        return { ruleId: rule.id, message: rule.message, severity: rule.severity };
      }
      return null;
    }

    case 'deny_value': {
      if (!rule.field) return null;
      const val = getNestedValue(target, rule.field);
      if (val === rule.value) {
        return { ruleId: rule.id, message: rule.message, severity: rule.severity };
      }
      return null;
    }

    case 'require_connection': {
      if ((subject.connectionCount ?? 0) === 0) {
        return { ruleId: rule.id, message: rule.message, severity: rule.severity };
      }
      return null;
    }

    case 'max_runs': {
      const threshold = rule.threshold ?? 0;
      if ((subject.runCount ?? 0) > threshold) {
        return { ruleId: rule.id, message: rule.message, severity: rule.severity };
      }
      return null;
    }

    default:
      return null;
  }
}

export function evaluatePolicy(
  rules: PolicyRule[],
  subject: EvaluationSubject
): PolicyEvaluation {
  if (rules.length === 0) return { result: 'skip', violations: [] };

  const violations: Violation[] = [];
  for (const rule of rules) {
    const violation = evaluateRule(rule, subject);
    if (violation) violations.push(violation);
  }

  if (violations.length === 0) return { result: 'pass', violations: [] };

  const hasError = violations.some(v => v.severity === 'error');
  return { result: hasError ? 'fail' : 'warn', violations };
}
