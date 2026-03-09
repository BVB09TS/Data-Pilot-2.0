import React, { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { LAYER_COLORS } from '../../types'

/* ─── Types ─── */

export interface ModelNodeData extends Record<string, unknown> {
  name:        string
  layer:       string
  has_problem: boolean
  q90:         number | null
  matched:     boolean  // highlighted by search
}

export type ModelNodeType = Node<ModelNodeData>

/* ─── Component ─── */

export const ModelNode = memo(function ModelNode({
  data,
  selected,
}: NodeProps<ModelNodeType>) {
  const color = LAYER_COLORS[data.layer] ?? '#64748b'

  return (
    <div
      className={`
        relative rounded-lg bg-white dark:bg-slate-900 shadow-sm
        border transition-colors duration-150 select-none
        ${selected
          ? 'border-blue-500 shadow-md shadow-blue-200/40 dark:shadow-blue-900/40'
          : data.matched
          ? 'border-amber-400 dark:border-amber-500'
          : 'border-slate-200 dark:border-slate-700'}
      `}
      style={{ width: 170 }}
    >
      {/* Layer accent bar */}
      <span
        className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
        style={{ backgroundColor: color }}
      />

      <Handle
        type="target"
        position={Position.Left}
        style={{ width: 7, height: 7, background: color, border: 'none', left: -4 }}
      />

      <div className="px-3 py-2 pl-3.5">
        <div className="flex items-center gap-1">
          <span className="font-mono text-xs text-slate-700 dark:text-slate-300 truncate flex-1 min-w-0">
            {data.name}
          </span>
          {data.has_problem && (
            <span
              className="text-amber-500 dark:text-amber-400 text-[10px] shrink-0"
              title="Has audit findings"
            >
              ⚠
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[10px] font-medium" style={{ color }}>
            {data.layer}
          </span>
          {data.q90 != null && (
            <span className="text-[10px] text-slate-400 dark:text-slate-600">
              · {data.q90 >= 1000 ? `${(data.q90 / 1000).toFixed(1)}k` : data.q90}q
            </span>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ width: 7, height: 7, background: color, border: 'none', right: -4 }}
      />
    </div>
  )
})
