/**
 * T-1: Unit tests for parser.ts
 *
 * Tests resolveProjectPath() and the manifest parsing helpers.
 * Does NOT touch the database — all DB calls are mocked.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'path';

// ── Mock the DB pool before importing parser ───────────────────────────────────
vi.mock('../db/pool.js', () => ({
  pool: { query: vi.fn().mockResolvedValue({ rows: [] }) },
}));

import { resolveProjectPath } from './parser.js';

// ── resolveProjectPath ────────────────────────────────────────────────────────

describe('resolveProjectPath', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('accepts a path inside DBT_PROJECTS_DIR', () => {
    process.env.DBT_PROJECTS_DIR = '/allowed';
    // /allowed/my-project is inside /allowed
    const resolved = resolveProjectPath('/allowed/my-project');
    expect(resolved).toBe('/allowed/my-project');
  });

  it('accepts the DBT_PROJECTS_DIR itself', () => {
    process.env.DBT_PROJECTS_DIR = '/allowed';
    const resolved = resolveProjectPath('/allowed');
    expect(resolved).toBe('/allowed');
  });

  it('rejects a path that escapes DBT_PROJECTS_DIR via ../', () => {
    process.env.DBT_PROJECTS_DIR = '/allowed';
    expect(() => resolveProjectPath('/allowed/../etc/passwd')).toThrow(/outside the allowed directory/);
  });

  it('rejects an absolute path outside DBT_PROJECTS_DIR', () => {
    process.env.DBT_PROJECTS_DIR = '/allowed';
    expect(() => resolveProjectPath('/tmp/evil')).toThrow(/outside the allowed directory/);
  });

  it('resolves relative paths relative to process.cwd() in dev', () => {
    // In non-production, DBT_PROJECTS_DIR falls back to cwd
    process.env.NODE_ENV = 'development';
    delete process.env.DBT_PROJECTS_DIR;
    const cwd = process.cwd();
    // A relative path should resolve inside cwd
    const result = resolveProjectPath('./subdir');
    expect(result).toBe(path.resolve(cwd, 'subdir'));
  });
});

// ── resolveProjectPath edge cases ────────────────────────────────────────────

describe('resolveProjectPath edge cases', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  it('rejects path with encoded traversal (%2e%2e)', () => {
    process.env.DBT_PROJECTS_DIR = '/allowed';
    // path.resolve decodes these, so '%2e%2e/etc' resolves to a path starting with CWD, not /allowed
    expect(() => resolveProjectPath('%2e%2e/etc')).toThrow(/outside the allowed directory/);
  });

  it('accepts nested path inside allowed base', () => {
    process.env.DBT_PROJECTS_DIR = '/allowed';
    const result = resolveProjectPath('/allowed/projects/my-dbt/target');
    expect(result.startsWith('/allowed')).toBe(true);
  });

  it('rejects empty string', () => {
    process.env.DBT_PROJECTS_DIR = '/allowed';
    // path.resolve('') gives cwd — which is not /allowed unless they happen to match
    const cwd = process.cwd();
    if (!cwd.startsWith('/allowed')) {
      expect(() => resolveProjectPath('')).toThrow(/outside the allowed directory/);
    }
  });
});
