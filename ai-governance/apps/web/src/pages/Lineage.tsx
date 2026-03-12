import { useState, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  MarkerType,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';

// ── Types ──────────────────────────────────────────────────────────────────────

type Layer = 'raw' | 'source' | 'core' | 'analytics';

interface ModelNode { id: string; name: string; layer: Layer; }

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  ts: number;
}

// ── ShopMesh static data ───────────────────────────────────────────────────────

const NODES: ModelNode[] = [
  // RAW
  { id: 'raw_shopify_orders',           name: 'raw_shopify_orders',           layer: 'raw' },
  { id: 'raw_shopify_order_items',      name: 'raw_shopify_order_items',      layer: 'raw' },
  { id: 'raw_shopify_customers',        name: 'raw_shopify_customers',        layer: 'raw' },
  { id: 'raw_shopify_products',         name: 'raw_shopify_products',         layer: 'raw' },
  { id: 'raw_shopify_product_variants', name: 'raw_shopify_product_variants', layer: 'raw' },
  { id: 'raw_shopify_refunds',          name: 'raw_shopify_refunds',          layer: 'raw' },
  { id: 'raw_stripe_payments',          name: 'raw_stripe_payments',          layer: 'raw' },
  { id: 'raw_stripe_refunds',           name: 'raw_stripe_refunds',           layer: 'raw' },
  { id: 'raw_stripe_subscriptions',     name: 'raw_stripe_subscriptions',     layer: 'raw' },
  { id: 'raw_google_ads_campaigns',     name: 'raw_google_ads_campaigns',     layer: 'raw' },
  { id: 'raw_google_ads_performance',   name: 'raw_google_ads_performance',   layer: 'raw' },
  { id: 'raw_salesforce_accounts',      name: 'raw_salesforce_accounts',      layer: 'raw' },
  { id: 'raw_salesforce_contacts',      name: 'raw_salesforce_contacts',      layer: 'raw' },
  { id: 'raw_salesforce_opportunities', name: 'raw_salesforce_opportunities', layer: 'raw' },
  { id: 'raw_mobile_events',            name: 'raw_mobile_events',            layer: 'raw' },
  { id: 'raw_email_campaigns',          name: 'raw_email_campaigns',          layer: 'raw' },
  { id: 'raw_email_events',             name: 'raw_email_events',             layer: 'raw' },
  { id: 'raw_web_sessions',             name: 'raw_web_sessions',             layer: 'raw' },
  { id: 'raw_inventory_snapshots',      name: 'raw_inventory_snapshots',      layer: 'raw' },
  { id: 'raw_erp_products',             name: 'raw_erp_products',             layer: 'raw' },
  { id: 'raw_erp_warehouses',           name: 'raw_erp_warehouses',           layer: 'raw' },
  { id: 'raw_mobile_sessions',          name: 'raw_mobile_sessions',          layer: 'raw' },
  { id: 'raw_shopify_gift_cards',       name: 'raw_shopify_gift_cards',       layer: 'raw' },
  // SOURCE
  { id: 'src_shopify_orders',           name: 'src_shopify_orders',           layer: 'source' },
  { id: 'src_shopify_order_items',      name: 'src_shopify_order_items',      layer: 'source' },
  { id: 'src_shopify_customers',        name: 'src_shopify_customers',        layer: 'source' },
  { id: 'src_shopify_products',         name: 'src_shopify_products',         layer: 'source' },
  { id: 'src_shopify_product_variants', name: 'src_shopify_product_variants', layer: 'source' },
  { id: 'src_shopify_refunds',          name: 'src_shopify_refunds',          layer: 'source' },
  { id: 'src_stripe_payments',          name: 'src_stripe_payments',          layer: 'source' },
  { id: 'src_stripe_refunds',           name: 'src_stripe_refunds',           layer: 'source' },
  { id: 'src_stripe_subscriptions',     name: 'src_stripe_subscriptions',     layer: 'source' },
  { id: 'src_google_ads_campaigns',     name: 'src_google_ads_campaigns',     layer: 'source' },
  { id: 'src_google_ads_performance',   name: 'src_google_ads_performance',   layer: 'source' },
  { id: 'src_salesforce_accounts',      name: 'src_salesforce_accounts',      layer: 'source' },
  { id: 'src_salesforce_contacts',      name: 'src_salesforce_contacts',      layer: 'source' },
  { id: 'src_salesforce_opportunities', name: 'src_salesforce_opportunities', layer: 'source' },
  { id: 'src_mobile_events',            name: 'src_mobile_events',            layer: 'source' },
  { id: 'src_email_campaigns',          name: 'src_email_campaigns',          layer: 'source' },
  { id: 'src_email_events',             name: 'src_email_events',             layer: 'source' },
  { id: 'src_web_sessions',             name: 'src_web_sessions',             layer: 'source' },
  { id: 'src_inventory_snapshots',      name: 'src_inventory_snapshots',      layer: 'source' },
  { id: 'src_subscription_events',      name: 'src_subscription_events',      layer: 'source' },
  { id: 'src_erp_products',             name: 'src_erp_products',             layer: 'source' },
  { id: 'src_erp_warehouses',           name: 'src_erp_warehouses',           layer: 'source' },
  { id: 'src_orders_v2',                name: 'src_orders_v2',                layer: 'source' },
  { id: 'src_shopify_gift_cards_v2',    name: 'src_shopify_gift_cards_v2',    layer: 'source' },
  // CORE
  { id: 'core_orders',               name: 'core_orders',               layer: 'core' },
  { id: 'core_customers',            name: 'core_customers',            layer: 'core' },
  { id: 'core_products',             name: 'core_products',             layer: 'core' },
  { id: 'core_subscriptions',        name: 'core_subscriptions',        layer: 'core' },
  { id: 'core_revenue_daily',        name: 'core_revenue_daily',        layer: 'core' },
  { id: 'core_revenue_monthly',      name: 'core_revenue_monthly',      layer: 'core' },
  { id: 'core_revenue_combined',     name: 'core_revenue_combined',     layer: 'core' },
  { id: 'core_refunds',              name: 'core_refunds',              layer: 'core' },
  { id: 'core_new_vs_returning',     name: 'core_new_vs_returning',     layer: 'core' },
  { id: 'core_cohort_retention',     name: 'core_cohort_retention',     layer: 'core' },
  { id: 'core_ad_performance',       name: 'core_ad_performance',       layer: 'core' },
  { id: 'core_customer_segments',    name: 'core_customer_segments',    layer: 'core' },
  { id: 'core_inventory_status',     name: 'core_inventory_status',     layer: 'core' },
  { id: 'core_b2b_accounts',         name: 'core_b2b_accounts',         layer: 'core' },
  { id: 'core_email_performance',    name: 'core_email_performance',    layer: 'core' },
  { id: 'core_web_engagement',       name: 'core_web_engagement',       layer: 'core' },
  { id: 'core_mobile_engagement',    name: 'core_mobile_engagement',    layer: 'core' },
  { id: 'core_opportunities',        name: 'core_opportunities',        layer: 'core' },
  { id: 'core_revenue_summary',      name: 'core_revenue_summary',      layer: 'core' },
  { id: 'core_coupon_analysis',      name: 'core_coupon_analysis',      layer: 'core' },
  { id: 'core_experimental_ltv',     name: 'core_experimental_ltv',     layer: 'core' },
  { id: 'core_inventory_legacy',     name: 'core_inventory_legacy',     layer: 'core' },
  { id: 'core_seller_metrics',       name: 'core_seller_metrics',       layer: 'core' },
  { id: 'core_geographic_revenue',   name: 'core_geographic_revenue',   layer: 'core' },
  // ANALYTICS
  { id: 'analytics_revenue_v1',               name: 'analytics_revenue_v1',               layer: 'analytics' },
  { id: 'analytics_revenue_v2',               name: 'analytics_revenue_v2',               layer: 'analytics' },
  { id: 'analytics_customer_360',             name: 'analytics_customer_360',             layer: 'analytics' },
  { id: 'analytics_customer_health',          name: 'analytics_customer_health',          layer: 'analytics' },
  { id: 'analytics_churn_risk',               name: 'analytics_churn_risk',               layer: 'analytics' },
  { id: 'analytics_product_performance',      name: 'analytics_product_performance',      layer: 'analytics' },
  { id: 'analytics_subscription_health',      name: 'analytics_subscription_health',      layer: 'analytics' },
  { id: 'analytics_subscription_mrr_trend',   name: 'analytics_subscription_mrr_trend',   layer: 'analytics' },
  { id: 'analytics_marketing_weekly',         name: 'analytics_marketing_weekly',         layer: 'analytics' },
  { id: 'analytics_b2b_pipeline',             name: 'analytics_b2b_pipeline',             layer: 'analytics' },
  { id: 'analytics_inventory_current',        name: 'analytics_inventory_current',        layer: 'analytics' },
  { id: 'analytics_cohort_retention',         name: 'analytics_cohort_retention',         layer: 'analytics' },
  { id: 'analytics_email_performance',        name: 'analytics_email_performance',        layer: 'analytics' },
  { id: 'analytics_web_traffic',              name: 'analytics_web_traffic',              layer: 'analytics' },
  { id: 'analytics_mobile_engagement',        name: 'analytics_mobile_engagement',        layer: 'analytics' },
  { id: 'analytics_geographic_revenue',       name: 'analytics_geographic_revenue',       layer: 'analytics' },
  { id: 'analytics_inventory_legacy',         name: 'analytics_inventory_legacy',         layer: 'analytics' },
  { id: 'analytics_seller_dashboard_v1',      name: 'analytics_seller_dashboard_v1',      layer: 'analytics' },
  { id: 'analytics_seller_dashboard_v2',      name: 'analytics_seller_dashboard_v2',      layer: 'analytics' },
  { id: 'analytics_legacy_kpis',              name: 'analytics_legacy_kpis',              layer: 'analytics' },
  { id: 'analytics_executive_kpis',           name: 'analytics_executive_kpis',           layer: 'analytics' },
  { id: 'analytics_refund_analysis',          name: 'analytics_refund_analysis',          layer: 'analytics' },
  { id: 'analytics_new_vs_returning',         name: 'analytics_new_vs_returning',         layer: 'analytics' },
  { id: 'analytics_finance_monthly',          name: 'analytics_finance_monthly',          layer: 'analytics' },
  { id: 'analytics_cac_analysis',             name: 'analytics_cac_analysis',             layer: 'analytics' },
  { id: 'analytics_channel_roi',              name: 'analytics_channel_roi',              layer: 'analytics' },
  { id: 'analytics_new_customer_acquisition', name: 'analytics_new_customer_acquisition', layer: 'analytics' },
];

const EDGES_RAW: [string, string][] = [
  ['raw_shopify_orders',           'src_shopify_orders'],
  ['raw_shopify_order_items',      'src_shopify_order_items'],
  ['raw_shopify_customers',        'src_shopify_customers'],
  ['raw_shopify_products',         'src_shopify_products'],
  ['raw_shopify_product_variants', 'src_shopify_product_variants'],
  ['raw_shopify_refunds',          'src_shopify_refunds'],
  ['raw_stripe_payments',          'src_stripe_payments'],
  ['raw_stripe_refunds',           'src_stripe_refunds'],
  ['raw_stripe_subscriptions',     'src_stripe_subscriptions'],
  ['raw_google_ads_campaigns',     'src_google_ads_campaigns'],
  ['raw_google_ads_performance',   'src_google_ads_performance'],
  ['raw_salesforce_accounts',      'src_salesforce_accounts'],
  ['raw_salesforce_contacts',      'src_salesforce_contacts'],
  ['raw_salesforce_opportunities', 'src_salesforce_opportunities'],
  ['raw_mobile_events',            'src_mobile_events'],
  ['raw_email_campaigns',          'src_email_campaigns'],
  ['raw_email_events',             'src_email_events'],
  ['raw_web_sessions',             'src_web_sessions'],
  ['raw_inventory_snapshots',      'src_inventory_snapshots'],
  ['raw_erp_products',             'src_erp_products'],
  ['raw_erp_warehouses',           'src_erp_warehouses'],
  ['raw_shopify_orders',           'src_orders_v2'],
  ['raw_shopify_gift_cards',       'src_shopify_gift_cards_v2'],
  ['src_stripe_subscriptions',     'src_subscription_events'],
  ['src_shopify_orders',           'core_orders'],
  ['src_stripe_payments',          'core_orders'],
  ['src_shopify_order_items',      'core_orders'],
  ['src_shopify_customers',        'core_customers'],
  ['core_orders',                  'core_customers'],
  ['src_stripe_subscriptions',     'core_customers'],
  ['src_shopify_products',         'core_products'],
  ['src_shopify_order_items',      'core_products'],
  ['src_shopify_product_variants', 'core_products'],
  ['src_stripe_subscriptions',     'core_subscriptions'],
  ['core_customers',               'core_subscriptions'],
  ['core_orders',                  'core_revenue_daily'],
  ['src_stripe_subscriptions',     'core_revenue_monthly'],
  ['core_revenue_daily',           'core_revenue_combined'],
  ['core_revenue_monthly',         'core_revenue_combined'],
  ['src_stripe_refunds',           'core_refunds'],
  ['src_stripe_payments',          'core_refunds'],
  ['core_orders',                  'core_refunds'],
  ['src_shopify_orders',           'core_new_vs_returning'],
  ['core_customers',               'core_cohort_retention'],
  ['core_orders',                  'core_cohort_retention'],
  ['src_google_ads_performance',   'core_ad_performance'],
  ['src_google_ads_campaigns',     'core_ad_performance'],
  ['core_customers',               'core_customer_segments'],
  ['src_inventory_snapshots',      'core_inventory_status'],
  ['src_shopify_product_variants', 'core_inventory_status'],
  ['src_shopify_products',         'core_inventory_status'],
  ['src_salesforce_accounts',      'core_b2b_accounts'],
  ['src_salesforce_contacts',      'core_b2b_accounts'],
  ['core_customers',               'core_b2b_accounts'],
  ['src_email_campaigns',          'core_email_performance'],
  ['src_email_events',             'core_email_performance'],
  ['src_web_sessions',             'core_web_engagement'],
  ['src_mobile_events',            'core_mobile_engagement'],
  ['src_salesforce_opportunities', 'core_opportunities'],
  ['src_salesforce_accounts',      'core_opportunities'],
  ['core_orders',                  'core_revenue_summary'],
  ['src_shopify_order_items',      'core_coupon_analysis'],
  ['core_customers',               'core_experimental_ltv'],
  ['src_erp_products',             'core_inventory_legacy'],
  ['core_orders',                  'core_seller_metrics'],
  ['core_customers',               'core_geographic_revenue'],
  ['core_orders',                  'core_geographic_revenue'],
  ['core_revenue_daily',           'analytics_revenue_v1'],
  ['core_revenue_combined',        'analytics_revenue_v2'],
  ['core_customers',               'analytics_customer_360'],
  ['core_customer_segments',       'analytics_customer_360'],
  ['core_mobile_engagement',       'analytics_customer_360'],
  ['core_customers',               'analytics_customer_health'],
  ['core_customer_segments',       'analytics_customer_health'],
  ['core_customers',               'analytics_churn_risk'],
  ['core_products',                'analytics_product_performance'],
  ['core_subscriptions',           'analytics_subscription_health'],
  ['core_revenue_monthly',         'analytics_subscription_mrr_trend'],
  ['core_ad_performance',          'analytics_marketing_weekly'],
  ['core_b2b_accounts',            'analytics_b2b_pipeline'],
  ['core_opportunities',           'analytics_b2b_pipeline'],
  ['core_inventory_status',        'analytics_inventory_current'],
  ['core_cohort_retention',        'analytics_cohort_retention'],
  ['core_email_performance',       'analytics_email_performance'],
  ['core_web_engagement',          'analytics_web_traffic'],
  ['core_mobile_engagement',       'analytics_mobile_engagement'],
  ['core_geographic_revenue',      'analytics_geographic_revenue'],
  ['core_inventory_legacy',        'analytics_inventory_legacy'],
  ['core_seller_metrics',          'analytics_seller_dashboard_v1'],
  ['core_seller_metrics',          'analytics_seller_dashboard_v2'],
  ['analytics_revenue_v1',         'analytics_legacy_kpis'],
  ['core_customers',               'analytics_legacy_kpis'],
  ['core_orders',                  'analytics_executive_kpis'],
  ['core_subscriptions',           'analytics_executive_kpis'],
  ['core_refunds',                 'analytics_refund_analysis'],
  ['core_new_vs_returning',        'analytics_new_vs_returning'],
  ['core_new_vs_returning',        'analytics_new_customer_acquisition'],
  ['core_web_engagement',          'analytics_new_customer_acquisition'],
  ['core_revenue_daily',           'analytics_finance_monthly'],
  ['core_refunds',                 'analytics_finance_monthly'],
  ['core_ad_performance',          'analytics_cac_analysis'],
  ['core_customers',               'analytics_cac_analysis'],
  ['core_orders',                  'analytics_channel_roi'],
  ['core_web_engagement',          'analytics_channel_roi'],
];

// ── Lookups ────────────────────────────────────────────────────────────────────

const NODE_MAP = new Map(NODES.map(n => [n.id, n]));
const LAYERS: Layer[] = ['raw', 'source', 'core', 'analytics'];

const LAYER_COLOR: Record<Layer, string> = {
  raw:       '#1e3a5f',
  source:    '#14532d',
  core:      '#312e81',
  analytics: '#78350f',
};
const LAYER_BORDER: Record<Layer, string> = {
  raw:       '#3b82f6',
  source:    '#22c55e',
  core:      '#818cf8',
  analytics: '#f59e0b',
};
const LAYER_LABEL: Record<Layer, string> = {
  raw: 'Raw', source: 'Source', core: 'Core', analytics: 'Analytics',
};

// ── Graph helpers ──────────────────────────────────────────────────────────────

function getFocusedGraph(selectedId: string, depth: number) {
  const included = new Set<string>([selectedId]);

  let frontier = [selectedId];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    EDGES_RAW.forEach(([src, tgt]) => {
      if (frontier.includes(tgt) && !included.has(src)) { included.add(src); next.push(src); }
    });
    frontier = next;
  }
  frontier = [selectedId];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    EDGES_RAW.forEach(([src, tgt]) => {
      if (frontier.includes(src) && !included.has(tgt)) { included.add(tgt); next.push(tgt); }
    });
    frontier = next;
  }
  const nodes = NODES.filter(n => included.has(n.id));
  const edges = EDGES_RAW.filter(([src, tgt]) => included.has(src) && included.has(tgt));
  return { nodes, edges, included };
}

function getFullLineage(id: string) {
  const ancestors: string[] = [];
  const descendants: string[] = [];
  const vis = new Set<string>([id]);
  const up = (nid: string) => EDGES_RAW.forEach(([s, t]) => { if (t === nid && !vis.has(s)) { vis.add(s); ancestors.push(s); up(s); } });
  up(id);
  vis.clear(); vis.add(id);
  const down = (nid: string) => EDGES_RAW.forEach(([s, t]) => { if (s === nid && !vis.has(t)) { vis.add(t); descendants.push(t); down(t); } });
  down(id);
  return { ancestors, descendants };
}

// ── Dagre layout ───────────────────────────────────────────────────────────────

const NODE_W = 210;
const NODE_H = 48;

function layoutGraph(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 50, ranksep: 130 });
  nodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach(e => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map(n => { const p = g.node(n.id); return { ...n, position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } }; });
}

function buildFlowElements(modelNodes: ModelNode[], edgePairs: [string, string][], selectedId: string) {
  const rfNodes: Node[] = modelNodes.map(n => ({
    id: n.id,
    type: 'default',
    position: { x: 0, y: 0 },
    data: { label: n.name.replace(/^(raw_|src_|core_|analytics_)/, '') },
    style: {
      background: n.id === selectedId ? LAYER_BORDER[n.layer] : LAYER_COLOR[n.layer],
      color: '#f1f5f9',
      border: `2px solid ${LAYER_BORDER[n.layer]}`,
      borderRadius: 8,
      fontSize: 11,
      fontWeight: n.id === selectedId ? 700 : 400,
      width: NODE_W,
      height: NODE_H,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 10px',
      boxShadow: n.id === selectedId ? `0 0 16px ${LAYER_BORDER[n.layer]}66` : '0 1px 4px rgba(0,0,0,0.5)',
      cursor: 'pointer',
    },
  }));

  const rfEdges: Edge[] = edgePairs.map(([src, tgt], i) => ({
    id: `e${i}`,
    source: src,
    target: tgt,
    style: { stroke: '#475569', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b', width: 12, height: 12 },
  }));

  return { nodes: layoutGraph(rfNodes, rfEdges), edges: rfEdges };
}

// ── Model Tree (left panel) ────────────────────────────────────────────────────

function ModelTree({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<Layer>>(new Set());

  const toggle = (layer: Layer) =>
    setCollapsed(prev => { const s = new Set(prev); s.has(layer) ? s.delete(layer) : s.add(layer); return s; });

  const filtered = NODES.filter(n => n.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800 w-64 flex-shrink-0">
      <div className="px-3 py-3 border-b border-gray-800">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Models</p>
        <input
          type="text"
          placeholder="Search models…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500"
        />
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {LAYERS.map(layer => {
          const models = filtered.filter(n => n.layer === layer);
          if (models.length === 0) return null;
          const isCollapsed = collapsed.has(layer);

          return (
            <div key={layer} className="mb-1">
              <button
                onClick={() => toggle(layer)}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-800 text-left"
              >
                <span className="text-gray-500 text-xs">{isCollapsed ? '▶' : '▼'}</span>
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: LAYER_BORDER[layer] }} />
                <span className="text-xs font-semibold text-gray-300">{LAYER_LABEL[layer]}</span>
                <span className="ml-auto text-xs text-gray-600">{models.length}</span>
              </button>

              {!isCollapsed && models.map(n => (
                <button
                  key={n.id}
                  onClick={() => onSelect(n.id)}
                  className={`w-full flex items-center gap-2 px-4 py-1.5 text-left hover:bg-gray-800 transition-colors ${selected === n.id ? 'bg-gray-800' : ''}`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: selected === n.id ? LAYER_BORDER[layer] : LAYER_COLOR[layer], border: `1px solid ${LAYER_BORDER[layer]}` }}
                  />
                  <span className={`text-xs truncate ${selected === n.id ? 'text-white font-medium' : 'text-gray-400'}`}>
                    {n.name.replace(/^(raw_|src_|core_|analytics_)/, '')}
                  </span>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      <div className="px-3 py-2 border-t border-gray-800">
        <p className="text-xs text-gray-600">{NODES.length} models total</p>
      </div>
    </div>
  );
}

// ── AI Chat panel (right panel) ────────────────────────────────────────────────

function buildContextMessage(id: string): string {
  const node = NODE_MAP.get(id);
  if (!node) return '';
  const { ancestors, descendants } = getFullLineage(id);
  const directParents  = EDGES_RAW.filter(([, t]) => t === id).map(([s]) => s);
  const directChildren = EDGES_RAW.filter(([s]) => s === id).map(([, t]) => t);

  return [
    `**Model selected: \`${id}\`** (${LAYER_LABEL[node.layer]} layer)`,
    '',
    directParents.length
      ? `**Direct dependencies (${directParents.length}):** ${directParents.join(', ')}`
      : '**Direct dependencies:** none — this is a root model',
    directChildren.length
      ? `**Direct dependents (${directChildren.length}):** ${directChildren.join(', ')}`
      : '**Direct dependents:** none — this is a leaf model',
    '',
    `**Full upstream (${ancestors.length} models):** ${ancestors.length ? ancestors.join(', ') : 'none'}`,
    `**Full downstream (${descendants.length} models):** ${descendants.length ? descendants.join(', ') : 'none'}`,
    '',
    'How can I help you with this model?',
  ].join('\n');
}

function AiChat({ selectedModelId }: { selectedModelId: string | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Inject context when model changes
  useEffect(() => {
    if (!selectedModelId) return;
    const ctx = buildContextMessage(selectedModelId);
    setMessages([{ role: 'assistant', content: ctx, ts: Date.now() }]);
  }, [selectedModelId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: input.trim(), ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model_context: selectedModelId ? buildContextMessage(selectedModelId) : null,
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) throw new Error('not_configured');
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply, ts: Date.now() }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '⚙️ AI provider not configured yet. Connect your AI in Settings to enable chat.',
        ts: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col w-80 flex-shrink-0 border-l border-gray-800 bg-gray-900">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-indigo-400" />
        <p className="text-xs font-semibold text-gray-300">AI Assistant</p>
        {selectedModelId && (
          <span className="ml-auto text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded truncate max-w-[140px]">
            {selectedModelId}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {!selectedModelId && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center mb-3 text-lg">⬅</div>
            <p className="text-xs text-gray-500">Select a model from the tree to automatically load its context into the AI conversation.</p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[90%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-indigo-700 text-white'
                  : 'bg-gray-800 text-gray-300'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-500 animate-pulse">
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder={selectedModelId ? `Ask about ${selectedModelId}…` : 'Select a model first…'}
            disabled={!selectedModelId || loading}
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500 disabled:opacity-40"
          />
          <button
            onClick={send}
            disabled={!selectedModelId || !input.trim() || loading}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs rounded transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function Lineage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [depth, setDepth] = useState(1);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    if (!selectedId) { setNodes([]); setEdges([]); return; }
    const { nodes: mn, edges: me } = getFocusedGraph(selectedId, depth);
    const { nodes: fn, edges: fe } = buildFlowElements(mn, me, selectedId);
    setNodes(fn);
    setEdges(fe);
  }, [selectedId, depth]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedId(node.id);
  }, []);

  const selectedNode = selectedId ? NODE_MAP.get(selectedId) : null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Model tree */}
      <ModelTree selected={selectedId} onSelect={setSelectedId} />

      {/* Center: Focused canvas */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Canvas toolbar */}
        <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-800 bg-gray-900 flex-shrink-0">
          {selectedNode ? (
            <>
              <span className="text-xs text-gray-400">Showing lineage for</span>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded"
                style={{ background: LAYER_COLOR[selectedNode.layer], color: LAYER_BORDER[selectedNode.layer], border: `1px solid ${LAYER_BORDER[selectedNode.layer]}` }}
              >
                {selectedNode.name}
              </span>
              <span className="text-xs text-gray-600">·</span>
              <span className="text-xs text-gray-500">{nodes.length} nodes · {edges.length} edges</span>
            </>
          ) : (
            <span className="text-xs text-gray-600">← Select a model to view its lineage</span>
          )}

          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-gray-500">Depth</span>
            {[1, 2, 3].map(d => (
              <button
                key={d}
                onClick={() => setDepth(d)}
                className={`w-6 h-6 rounded text-xs font-medium transition-colors ${depth === d ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
              >
                {d}
              </button>
            ))}

            {selectedId && (
              <button
                onClick={() => setSelectedId(null)}
                className="ml-2 text-xs text-gray-600 hover:text-gray-400"
              >
                ✕ Clear
              </button>
            )}
          </div>

          {/* Layer legend */}
          <div className="hidden xl:flex items-center gap-3 ml-2">
            {LAYERS.map(l => (
              <span key={l} className="flex items-center gap-1 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-sm" style={{ background: LAYER_BORDER[l] }} />
                {LAYER_LABEL[l]}
              </span>
            ))}
          </div>
        </div>

        {/* ReactFlow canvas */}
        <div className="flex-1 bg-gray-950">
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="text-4xl mb-4 opacity-20">⬡</div>
              <p className="text-gray-600 text-sm font-medium mb-1">No model selected</p>
              <p className="text-gray-700 text-xs max-w-xs">
                Pick a model from the tree on the left to explore its lineage graph.
              </p>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} color="#1e293b" gap={20} />
              <Controls />
              <Panel position="bottom-center">
                <div className="bg-gray-900 border border-gray-700 rounded px-3 py-1 text-xs text-gray-500">
                  Click any node to re-focus · Drag to pan · Scroll to zoom
                </div>
              </Panel>
            </ReactFlow>
          )}
        </div>
      </div>

      {/* Right: AI chat */}
      <AiChat selectedModelId={selectedId} />
    </div>
  );
}
