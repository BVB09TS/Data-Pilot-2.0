import React, { useCallback, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Edge,
  type NodeTypes,
  type OnNodeClick,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from '@dagrejs/dagre'

import { ModelNode, type ModelNodeData, type ModelNodeType } from './ModelNode'
import { LAYER_COLORS } from '../../types'
import { useTheme } from '../../contexts/ThemeContext'

/* ─── Types ─── */

export interface RawNode {
  id:          string
  layer:       string
  has_problem: boolean
  q30:         number | null
  q90:         number | null
}

export interface RawEdge {
  source: string
  target: string
}

/* ─── Dagre layout ─── */

const NODE_W = 170
const NODE_H = 52

function applyLayout(
  nodes: ModelNodeType[],
  edges: Edge[],
  direction: 'LR' | 'TB',
): ModelNodeType[] {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, nodesep: 40, ranksep: 90, align: 'UL' })
  nodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }))
  edges.forEach(e => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return nodes.map(n => {
    const p = g.node(n.id)
    return { ...n, position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } }
  })
}

/* ─── Custom node registry ─── */

const NODE_TYPES: NodeTypes = { modelNode: ModelNode }

/* ─── Component ─── */

interface LineageGraphProps {
  rawNodes:       RawNode[]
  rawEdges:       RawEdge[]
  searchText:     string
  layerFilter:    string | null
  direction:      'LR' | 'TB'
  selectedNodeId: string | null
  onSelectNode:   (id: string | null) => void
}

export function LineageGraph({
  rawNodes,
  rawEdges,
  searchText,
  layerFilter,
  direction,
  selectedNodeId,
  onSelectNode,
}: LineageGraphProps) {
  const { theme } = useTheme()

  const [nodes, setNodes, onNodesChange] = useNodesState<ModelNodeType>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  // Rebuild and re-layout whenever inputs change
  useEffect(() => {
    const lc = searchText.toLowerCase().trim()

    const rfNodes: ModelNodeType[] = rawNodes
      .filter(n => !layerFilter || n.layer === layerFilter)
      .map(n => ({
        id:       n.id,
        type:     'modelNode' as const,
        position: { x: 0, y: 0 },
        data: {
          name:        n.id,
          layer:       n.layer,
          has_problem: n.has_problem,
          q90:         n.q90,
          matched:     lc.length > 0 && n.id.toLowerCase().includes(lc),
        } satisfies ModelNodeData,
      }))

    const visible = new Set(rfNodes.map(n => n.id))

    const rfEdges: Edge[] = rawEdges
      .filter(e => visible.has(e.source) && visible.has(e.target))
      .map(e => ({
        id:     `${e.source}→${e.target}`,
        source: e.source,
        target: e.target,
        type:   'smoothstep',
        style:  { stroke: '#94a3b8', strokeWidth: 1.5 },
      }))

    const laid = applyLayout(rfNodes, rfEdges, direction)
    setNodes(laid)
    setEdges(rfEdges)
  }, [rawNodes, rawEdges, searchText, layerFilter, direction, setNodes, setEdges])

  const handleNodeClick: OnNodeClick = useCallback((_e, node) => {
    onSelectNode(node.id === selectedNodeId ? null : node.id)
  }, [onSelectNode, selectedNodeId])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      onPaneClick={() => onSelectNode(null)}
      nodeTypes={NODE_TYPES}
      colorMode={theme === 'dark' ? 'dark' : 'light'}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      minZoom={0.08}
      maxZoom={2.5}
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} />

      <Controls showInteractive={false} />

      <MiniMap
        nodeColor={n => LAYER_COLORS[(n.data as ModelNodeData).layer] ?? '#94a3b8'}
        maskColor={theme === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.06)'}
        style={{ bottom: 56, right: 12 }}
        zoomable
        pannable
      />
    </ReactFlow>
  )
}
