import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { lineageApi } from '../lib/api';

interface LineageNode { id: string; name: string; type: string; }
interface LineageEdge { id: string; source_node_id: string; target_node_id: string; label?: string; }
interface Graph {
  nodes: LineageNode[];
  edges: LineageEdge[];
  cycles: string[][];
  is_dag: boolean;
}

export default function Lineage() {
  const { workspaceId } = useAuth();
  const [graph, setGraph] = useState<Graph | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [relatives, setRelatives] = useState<{ ancestors: LineageNode[]; descendants: LineageNode[] } | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    lineageApi.graph(workspaceId)
      .then(r => setGraph(r.data.data))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  async function selectNode(id: string) {
    if (!workspaceId) return;
    if (selected === id) { setSelected(null); setRelatives(null); return; }
    setSelected(id);
    const [a, d] = await Promise.all([
      lineageApi.ancestors(workspaceId, id),
      lineageApi.descendants(workspaceId, id),
    ]);
    setRelatives({ ancestors: a.data.data.ancestors, descendants: d.data.data.descendants });
  }

  function downloadManifest() {
    if (!workspaceId) return;
    window.open(`/api/workspaces/${workspaceId}/lineage/manifest?format=download`, '_blank');
  }

  if (loading) return <div className="p-8 text-gray-500 text-sm">Loading…</div>;
  if (!graph)  return <div className="p-8 text-gray-500 text-sm">Failed to load lineage.</div>;

  const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Lineage</h1>
          <p className="text-sm text-gray-400 mt-1">
            {graph.nodes.length} nodes · {graph.edges.length} edges ·{' '}
            <span className={graph.is_dag ? 'text-green-400' : 'text-red-400'}>
              {graph.is_dag ? 'Valid DAG' : `${graph.cycles.length} cycle(s) detected`}
            </span>
          </p>
        </div>
        <button className="btn-ghost" onClick={downloadManifest}>
          ↓ Export Manifest
        </button>
      </div>

      {/* Cycles warning */}
      {!graph.is_dag && (
        <div className="rounded-lg bg-red-900/30 border border-red-700 p-4 text-sm text-red-300">
          <p className="font-semibold mb-1">Cycles detected — not a valid DAG</p>
          {graph.cycles.map((cycle, i) => (
            <p key={i} className="font-mono text-xs text-red-400">
              {cycle.map(id => nodeMap.get(id)?.name ?? id).join(' → ')}
            </p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Node list */}
        <div className="card space-y-2">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Nodes — click to inspect</h2>
          {graph.nodes.length === 0
            ? <p className="text-sm text-gray-500">No nodes.</p>
            : graph.nodes.map(n => (
              <button
                key={n.id}
                onClick={() => selectNode(n.id)}
                className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  selected === n.id
                    ? 'bg-indigo-600/20 text-indigo-300'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                <span className="flex-shrink-0 w-2 h-2 rounded-full bg-indigo-400" />
                <span className="font-medium">{n.name}</span>
                <span className="text-xs text-gray-500 ml-auto">{n.type}</span>
              </button>
            ))
          }
        </div>

        {/* Edges + relatives panel */}
        <div className="space-y-4">
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-300 mb-3">Edges</h2>
            {graph.edges.length === 0
              ? <p className="text-sm text-gray-500">No edges.</p>
              : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {graph.edges.map(e => (
                    <div key={e.id} className="flex items-center gap-2 text-xs text-gray-400 font-mono">
                      <span className="text-white">{nodeMap.get(e.source_node_id)?.name ?? e.source_node_id}</span>
                      <span>→</span>
                      <span className="text-white">{nodeMap.get(e.target_node_id)?.name ?? e.target_node_id}</span>
                      {e.label && <span className="text-gray-600">({e.label})</span>}
                    </div>
                  ))}
                </div>
              )
            }
          </div>

          {relatives && selected && (
            <div className="card space-y-3">
              <h2 className="text-sm font-semibold text-gray-300">
                Lineage for <span className="text-indigo-400">{nodeMap.get(selected)?.name}</span>
              </h2>
              <div>
                <p className="text-xs text-gray-500 mb-1">Ancestors ({relatives.ancestors.length})</p>
                {relatives.ancestors.length === 0
                  ? <p className="text-xs text-gray-600">None</p>
                  : relatives.ancestors.map(n => (
                    <p key={n.id} className="text-xs text-gray-300">↑ {n.name} <span className="text-gray-600">({n.type})</span></p>
                  ))
                }
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Descendants ({relatives.descendants.length})</p>
                {relatives.descendants.length === 0
                  ? <p className="text-xs text-gray-600">None</p>
                  : relatives.descendants.map(n => (
                    <p key={n.id} className="text-xs text-gray-300">↓ {n.name} <span className="text-gray-600">({n.type})</span></p>
                  ))
                }
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
