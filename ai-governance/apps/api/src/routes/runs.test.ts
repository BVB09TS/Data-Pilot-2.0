/**
 * Unit tests for the runs status machine logic.
 */
import { describe, it, expect } from 'vitest';

// Status machine — mirrors the TRANSITIONS map in runs.ts
type RunStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

const TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  pending:   ['running', 'cancelled'],
  running:   ['success', 'failed', 'cancelled'],
  success:   [],
  failed:    [],
  cancelled: [],
};

function canTransition(from: RunStatus, to: RunStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

describe('Run status machine', () => {
  // Valid transitions
  it('pending → running is allowed', () => expect(canTransition('pending', 'running')).toBe(true));
  it('pending → cancelled is allowed', () => expect(canTransition('pending', 'cancelled')).toBe(true));
  it('running → success is allowed', () => expect(canTransition('running', 'success')).toBe(true));
  it('running → failed is allowed', () => expect(canTransition('running', 'failed')).toBe(true));
  it('running → cancelled is allowed', () => expect(canTransition('running', 'cancelled')).toBe(true));

  // Invalid transitions
  it('pending → success is NOT allowed', () => expect(canTransition('pending', 'success')).toBe(false));
  it('pending → failed is NOT allowed', () => expect(canTransition('pending', 'failed')).toBe(false));
  it('success → anything is NOT allowed', () => {
    const from: RunStatus = 'success';
    (['pending', 'running', 'failed', 'cancelled'] as RunStatus[]).forEach(to => {
      expect(canTransition(from, to)).toBe(false);
    });
  });
  it('failed → anything is NOT allowed', () => {
    const from: RunStatus = 'failed';
    (['pending', 'running', 'success', 'cancelled'] as RunStatus[]).forEach(to => {
      expect(canTransition(from, to)).toBe(false);
    });
  });
  it('cancelled → anything is NOT allowed', () => {
    const from: RunStatus = 'cancelled';
    (['pending', 'running', 'success', 'failed'] as RunStatus[]).forEach(to => {
      expect(canTransition(from, to)).toBe(false);
    });
  });

  // Terminal states
  it('success, failed, cancelled are terminal (no outgoing transitions)', () => {
    (['success', 'failed', 'cancelled'] as RunStatus[]).forEach(status => {
      expect(TRANSITIONS[status]).toHaveLength(0);
    });
  });

  // All reachable paths
  it('every non-terminal state has at least one valid transition', () => {
    (['pending', 'running'] as RunStatus[]).forEach(status => {
      expect(TRANSITIONS[status].length).toBeGreaterThan(0);
    });
  });
});

// ── Log entry validation ──────────────────────────────────────────────────────

describe('log entry stamping', () => {
  function stampEntry(entry: Record<string, unknown>) {
    return { ts: new Date().toISOString(), level: 'info', ...entry };
  }

  it('adds ts when missing', () => {
    const stamped = stampEntry({ message: 'hello' });
    expect(stamped.ts).toBeDefined();
    expect(() => new Date(stamped.ts as string)).not.toThrow();
  });

  it('adds default level=info', () => {
    const stamped = stampEntry({ message: 'hello' });
    expect(stamped.level).toBe('info');
  });

  it('preserves existing ts and level', () => {
    const ts = '2025-01-01T00:00:00.000Z';
    const stamped = stampEntry({ ts, level: 'error', message: 'boom' });
    expect(stamped.ts).toBe(ts);
    expect(stamped.level).toBe('error');
  });
});
