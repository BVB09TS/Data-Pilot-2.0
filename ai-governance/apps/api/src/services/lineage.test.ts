import { describe, it, expect, vi, beforeEach } from 'vitest';
import { topologicalSort, buildLineageGraph } from './lineage.js';
import type { LineageEdge, LineageNode } from './lineage.js';

// ── topologicalSort ───────────────────────────────────────────────────────────

describe('topologicalSort', () => {
  const edge = (s: string, t: string): LineageEdge =>
    ({ id: `${s}-${t}`, source_node_id: s, target_node_id: t, label: null, metadata: {} });

  it('sorts a simple chain A→B→C', () => {
    const ids = ['A', 'B', 'C'];
    const edges = [edge('A', 'B'), edge('B', 'C')];
    const sorted = topologicalSort(ids, edges);
    expect(sorted.indexOf('A')).toBeLessThan(sorted.indexOf('B'));
    expect(sorted.indexOf('B')).toBeLessThan(sorted.indexOf('C'));
  });

  it('sorts a diamond A→B, A→C, B→D, C→D', () => {
    const ids = ['A', 'B', 'C', 'D'];
    const edges = [edge('A', 'B'), edge('A', 'C'), edge('B', 'D'), edge('C', 'D')];
    const sorted = topologicalSort(ids, edges);
    expect(sorted.indexOf('A')).toBeLessThan(sorted.indexOf('B'));
    expect(sorted.indexOf('A')).toBeLessThan(sorted.indexOf('C'));
    expect(sorted.indexOf('B')).toBeLessThan(sorted.indexOf('D'));
    expect(sorted.indexOf('C')).toBeLessThan(sorted.indexOf('D'));
  });

  it('handles disconnected nodes', () => {
    const ids = ['A', 'B', 'X'];
    const edges = [edge('A', 'B')];
    const sorted = topologicalSort(ids, edges);
    expect(sorted).toHaveLength(3);
    expect(sorted).toContain('X');
  });

  it('handles empty graph', () => {
    expect(topologicalSort([], [])).toEqual([]);
  });

  it('handles single node', () => {
    expect(topologicalSort(['A'], [])).toEqual(['A']);
  });

  it('throws on a cycle', () => {
    const ids = ['A', 'B', 'C'];
    const edges = [edge('A', 'B'), edge('B', 'C'), edge('C', 'A')];
    expect(() => topologicalSort(ids, edges)).toThrow('cycles');
  });
});

// ── buildLineageGraph (cycle detection) ───────────────────────────────────────

// Mock the pool so we don't need a real DB
vi.mock('../db/pool.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { pool } from '../db/pool.js';

function makeNode(id: string): LineageNode {
  return { id, name: id, type: 'model', description: null, metadata: {}, config: {} };
}

function makeEdge(s: string, t: string): LineageEdge {
  return { id: `${s}-${t}`, source_node_id: s, target_node_id: t, label: null, metadata: {} };
}

describe('buildLineageGraph', () => {
  beforeEach(() => vi.clearAllMocks());

  function mockDB(nodes: LineageNode[], edges: LineageEdge[]) {
    (pool.query as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ rows: nodes })   // nodes query
      .mockResolvedValueOnce({ rows: edges });   // edges query
  }

  it('returns is_dag=true and no cycles for a valid DAG', async () => {
    mockDB(
      [makeNode('A'), makeNode('B'), makeNode('C')],
      [makeEdge('A', 'B'), makeEdge('B', 'C')]
    );
    const g = await buildLineageGraph('ws-1');
    expect(g.is_dag).toBe(true);
    expect(g.cycles).toHaveLength(0);
  });

  it('detects a direct cycle A→B→A', async () => {
    mockDB(
      [makeNode('A'), makeNode('B')],
      [makeEdge('A', 'B'), makeEdge('B', 'A')]
    );
    const g = await buildLineageGraph('ws-1');
    expect(g.is_dag).toBe(false);
    expect(g.cycles.length).toBeGreaterThan(0);
  });

  it('detects a 3-node cycle A→B→C→A', async () => {
    mockDB(
      [makeNode('A'), makeNode('B'), makeNode('C')],
      [makeEdge('A', 'B'), makeEdge('B', 'C'), makeEdge('C', 'A')]
    );
    const g = await buildLineageGraph('ws-1');
    expect(g.is_dag).toBe(false);
    expect(g.cycles.length).toBeGreaterThan(0);
    // All nodes in cycle must be IDs we know
    const known = new Set(['A', 'B', 'C']);
    g.cycles[0].forEach(id => expect(known.has(id)).toBe(true));
  });

  it('returns empty graph for empty workspace', async () => {
    mockDB([], []);
    const g = await buildLineageGraph('ws-empty');
    expect(g.nodes).toHaveLength(0);
    expect(g.edges).toHaveLength(0);
    expect(g.is_dag).toBe(true);
  });

  it('is_dag=true for disconnected forest', async () => {
    mockDB(
      [makeNode('A'), makeNode('B'), makeNode('X'), makeNode('Y')],
      [makeEdge('A', 'B'), makeEdge('X', 'Y')]
    );
    const g = await buildLineageGraph('ws-1');
    expect(g.is_dag).toBe(true);
  });
});
