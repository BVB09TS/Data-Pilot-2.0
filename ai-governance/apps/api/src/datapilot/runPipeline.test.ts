/**
 * T-3: Integration test for the DataPilot pipeline.
 * Tests that runPipeline correctly orchestrates agents and handles failures.
 * DB and LLM are mocked; only the pipeline logic is exercised end-to-end.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AgentFinding } from './agents/types.js';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockQuery = vi.fn();
const mockConnect = vi.fn();
const mockRelease = vi.fn();
const clientQuery = vi.fn();

vi.mock('../db/pool.js', () => ({
  pool: {
    query: mockQuery,
    connect: mockConnect,
  },
}));

const sampleFinding: AgentFinding = {
  type: 'dead_model',
  severity: 'high',
  title: 'Dead model: test_model',
  description: 'No downstream consumers',
  recommendation: 'Remove or document it',
  modelName: 'test_model',
  metadata: {},
  cost_usd: 0.001,
  confidence: 1.0,
};

// Mock all agents to return one finding each (or throw for failure test)
vi.mock('./agents/deadModels.js', () => ({
  analyzeDeadModels: vi.fn().mockResolvedValue([sampleFinding]),
}));
vi.mock('./agents/orphans.js', () => ({
  analyzeOrphans: vi.fn().mockResolvedValue([]),
}));
vi.mock('./agents/brokenRefs.js', () => ({
  analyzeBrokenRefs: vi.fn().mockResolvedValue([]),
}));
vi.mock('./agents/duplicateMetrics.js', () => ({
  analyzeDuplicateMetrics: vi.fn().mockResolvedValue([]),
}));
vi.mock('./agents/grainJoins.js', () => ({
  analyzeGrainJoins: vi.fn().mockResolvedValue([]),
}));
vi.mock('./agents/logicDrift.js', () => ({
  analyzeLogicDrift: vi.fn().mockResolvedValue([]),
}));
vi.mock('./agents/missingTests.js', () => ({
  analyzeMissingTests: vi.fn().mockResolvedValue([]),
}));
vi.mock('./agents/deprecatedSources.js', () => ({
  analyzeDeprecatedSources: vi.fn().mockResolvedValue([]),
}));

vi.mock('./llmGateway.js', () => ({
  getQuotaStatus: vi.fn().mockReturnValue({ usedUsd: 0.001, limitUsd: 1 }),
}));

// Mock parseDbtProject to return a minimal project
vi.mock('./parser.js', () => ({
  parseDbtProject: vi.fn().mockResolvedValue({
    projectName: 'test',
    dbtVersion: '1.7.0',
    generatedAt: new Date().toISOString(),
    nodeCount: 1,
    edgeCount: 0,
    models: [
      {
        uniqueId: 'model.test.test_model',
        name: 'test_model',
        resourceType: 'model',
        description: '',
        filePath: 'models/test_model.sql',
        sql: 'SELECT 1',
        config: {},
        columns: [],
        tags: [],
        meta: {},
        dependsOn: [],
      },
    ],
    sources: [],
  }),
  resolveProjectPath: vi.fn().mockImplementation((p: string) => p),
}));

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('runPipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // DB mock setup
    clientQuery.mockResolvedValue({ rows: [] });
    mockConnect.mockResolvedValue({
      query: clientQuery,
      release: mockRelease,
    });
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // setRunStatus: running
      .mockResolvedValueOnce({ rows: [] }) // node lookup for persistFindings
      .mockResolvedValueOnce({ rows: [] }); // setRunStatus: success
  });

  it('returns a result with findings from agents', async () => {
    const { runPipeline } = await import('./runPipeline.js');
    const result = await runPipeline({
      projectPath: '/dbt_projects/test',
      workspaceId: 'ws-1',
      runId: 'run-1',
    });

    expect(result.totalFindings).toBe(1);
    expect(result.findings[0].type).toBe('dead_model');
    expect(result.bySeverity['high']).toBe(1);
    expect(result.totalCostUsd).toBeCloseTo(0.001);
  });

  it('updates run status to running then success', async () => {
    const { runPipeline } = await import('./runPipeline.js');
    await runPipeline({
      projectPath: '/dbt_projects/test',
      workspaceId: 'ws-1',
      runId: 'run-1',
    });

    // First call = set to running
    expect(mockQuery.mock.calls[0][1][0]).toBe('running');
    // Last update call = success
    const statusCalls = mockQuery.mock.calls.filter(c => String(c[0]).includes('UPDATE runs'));
    const lastStatus = statusCalls[statusCalls.length - 1];
    expect(lastStatus[1][0]).toBe('success');
  });

  it('sets run status to failed when parser throws', async () => {
    const { parseDbtProject } = await import('./parser.js');
    (parseDbtProject as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('manifest not found'));

    // Reset query mocks
    mockQuery
      .mockResolvedValueOnce({ rows: [] }) // set running
      .mockResolvedValueOnce({ rows: [] }); // set failed

    const { runPipeline } = await import('./runPipeline.js');
    await expect(
      runPipeline({ projectPath: '/bad/path', workspaceId: 'ws-1', runId: 'run-1' })
    ).rejects.toThrow('manifest not found');

    // Verify failed status was set
    const failedCall = mockQuery.mock.calls.find(c =>
      String(c[0]).includes('UPDATE runs') && c[1]?.[0] === 'failed'
    );
    expect(failedCall).toBeDefined();
  });

  it('partial agent failure still returns other findings', async () => {
    const { analyzeOrphans } = await import('./agents/orphans.js');
    (analyzeOrphans as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('orphan agent crash'));

    const { runPipeline } = await import('./runPipeline.js');
    const result = await runPipeline({
      projectPath: '/dbt_projects/test',
      workspaceId: 'ws-1',
      runId: 'run-1',
    });

    // deadModels still returned 1 finding despite orphan agent failing
    expect(result.totalFindings).toBe(1);
    // agentErrors should be populated
    expect(result).toHaveProperty('agentErrors');
  });
});
