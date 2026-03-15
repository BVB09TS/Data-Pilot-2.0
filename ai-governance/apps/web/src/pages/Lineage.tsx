import { useState, useCallback, useEffect, useRef, createContext, useContext } from 'react';
import { useSearchParams } from 'react-router-dom';
import { lineageApi, chatApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme as useGlobalTheme } from '../contexts/ThemeContext';
import {
  ReactFlow, Background, Controls,
  useNodesState, useEdgesState,
  type Node, type Edge,
  MarkerType, BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';

// ── Theme (synced with global ThemeContext) ────────────────────────────────────

type Theme = 'dark' | 'light';

interface TV {
  bg: string; panel: string; secondary: string; hover: string;
  border: string; text: string; muted: string; faint: string;
  inputCls: string; rfBg: string; rfDot: string;
}

const THEME: Record<Theme, TV> = {
  dark: {
    bg: '#0a0a0a', panel: '#111111', secondary: '#1a1a1a', hover: '#1a1a1a',
    border: '#1a1a1a', text: '#fafafa', muted: '#737373', faint: '#404040',
    inputCls: 'bg-neutral-900 border-neutral-700 text-neutral-200 placeholder-neutral-600 focus:border-neutral-500',
    rfBg: '#0a0a0a', rfDot: '#1a1a1a',
  },
  light: {
    bg: '#ffffff', panel: '#fafafa', secondary: '#f5f5f5', hover: '#f5f5f5',
    border: '#e5e5e5', text: '#0a0a0a', muted: '#737373', faint: '#a3a3a3',
    inputCls: 'bg-white border-neutral-300 text-neutral-900 placeholder-neutral-400 focus:border-neutral-500',
    rfBg: '#f9fafb', rfDot: '#e5e5e5',
  },
};

// Internal context (wraps global theme for components that need T object)
const ThemeCtx = createContext<{ theme: Theme; T: TV; isDark: boolean }>({
  theme: 'dark', T: THEME.dark, isDark: true,
});
const useTheme = () => useContext(ThemeCtx);

// ── Graph context (API-backed, falls back to static NODES/EDGES_RAW) ───────────

interface GraphCtxValue { nodes: ModelNode[]; edgePairs: [string, string][]; loading: boolean; }
const GraphCtx = createContext<GraphCtxValue>({ nodes: [], edgePairs: [], loading: true });
const useGraph = () => useContext(GraphCtx);

// ── Types ──────────────────────────────────────────────────────────────────────

type Layer = string;
type TestBadge = 'P' | 'F' | 'N' | 'U';
interface ModelNode  { id: string; name: string; layer: Layer; }
interface ColumnDef  { name: string; type: string; tests: TestBadge[]; description?: string; }
interface ModelMeta  { description: string; columns: ColumnDef[]; sql: string; }
interface ChatMessage { role: 'assistant' | 'user'; content: string; ts: number; }

// ── Static model data ──────────────────────────────────────────────────────────

const NODES: ModelNode[] = [
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
  ['raw_shopify_orders','src_shopify_orders'],['raw_shopify_order_items','src_shopify_order_items'],
  ['raw_shopify_customers','src_shopify_customers'],['raw_shopify_products','src_shopify_products'],
  ['raw_shopify_product_variants','src_shopify_product_variants'],['raw_shopify_refunds','src_shopify_refunds'],
  ['raw_stripe_payments','src_stripe_payments'],['raw_stripe_refunds','src_stripe_refunds'],
  ['raw_stripe_subscriptions','src_stripe_subscriptions'],['raw_google_ads_campaigns','src_google_ads_campaigns'],
  ['raw_google_ads_performance','src_google_ads_performance'],['raw_salesforce_accounts','src_salesforce_accounts'],
  ['raw_salesforce_contacts','src_salesforce_contacts'],['raw_salesforce_opportunities','src_salesforce_opportunities'],
  ['raw_mobile_events','src_mobile_events'],['raw_email_campaigns','src_email_campaigns'],
  ['raw_email_events','src_email_events'],['raw_web_sessions','src_web_sessions'],
  ['raw_inventory_snapshots','src_inventory_snapshots'],['raw_erp_products','src_erp_products'],
  ['raw_erp_warehouses','src_erp_warehouses'],['raw_shopify_orders','src_orders_v2'],
  ['raw_shopify_gift_cards','src_shopify_gift_cards_v2'],['src_stripe_subscriptions','src_subscription_events'],
  ['src_shopify_orders','core_orders'],['src_stripe_payments','core_orders'],['src_shopify_order_items','core_orders'],
  ['src_shopify_customers','core_customers'],['core_orders','core_customers'],['src_stripe_subscriptions','core_customers'],
  ['src_shopify_products','core_products'],['src_shopify_order_items','core_products'],['src_shopify_product_variants','core_products'],
  ['src_stripe_subscriptions','core_subscriptions'],['core_customers','core_subscriptions'],
  ['core_orders','core_revenue_daily'],['src_stripe_subscriptions','core_revenue_monthly'],
  ['core_revenue_daily','core_revenue_combined'],['core_revenue_monthly','core_revenue_combined'],
  ['src_stripe_refunds','core_refunds'],['src_stripe_payments','core_refunds'],['core_orders','core_refunds'],
  ['src_shopify_orders','core_new_vs_returning'],['core_customers','core_cohort_retention'],['core_orders','core_cohort_retention'],
  ['src_google_ads_performance','core_ad_performance'],['src_google_ads_campaigns','core_ad_performance'],
  ['core_customers','core_customer_segments'],['src_inventory_snapshots','core_inventory_status'],
  ['src_shopify_product_variants','core_inventory_status'],['src_shopify_products','core_inventory_status'],
  ['src_salesforce_accounts','core_b2b_accounts'],['src_salesforce_contacts','core_b2b_accounts'],['core_customers','core_b2b_accounts'],
  ['src_email_campaigns','core_email_performance'],['src_email_events','core_email_performance'],
  ['src_web_sessions','core_web_engagement'],['src_mobile_events','core_mobile_engagement'],
  ['src_salesforce_opportunities','core_opportunities'],['src_salesforce_accounts','core_opportunities'],
  ['core_orders','core_revenue_summary'],['src_shopify_order_items','core_coupon_analysis'],
  ['core_customers','core_experimental_ltv'],['src_erp_products','core_inventory_legacy'],
  ['core_orders','core_seller_metrics'],['core_customers','core_geographic_revenue'],['core_orders','core_geographic_revenue'],
  ['core_revenue_daily','analytics_revenue_v1'],['core_revenue_combined','analytics_revenue_v2'],
  ['core_customers','analytics_customer_360'],['core_customer_segments','analytics_customer_360'],['core_mobile_engagement','analytics_customer_360'],
  ['core_customers','analytics_customer_health'],['core_customer_segments','analytics_customer_health'],
  ['core_customers','analytics_churn_risk'],['core_products','analytics_product_performance'],
  ['core_subscriptions','analytics_subscription_health'],['core_revenue_monthly','analytics_subscription_mrr_trend'],
  ['core_ad_performance','analytics_marketing_weekly'],['core_b2b_accounts','analytics_b2b_pipeline'],['core_opportunities','analytics_b2b_pipeline'],
  ['core_inventory_status','analytics_inventory_current'],['core_cohort_retention','analytics_cohort_retention'],
  ['core_email_performance','analytics_email_performance'],['core_web_engagement','analytics_web_traffic'],
  ['core_mobile_engagement','analytics_mobile_engagement'],['core_geographic_revenue','analytics_geographic_revenue'],
  ['core_inventory_legacy','analytics_inventory_legacy'],['core_seller_metrics','analytics_seller_dashboard_v1'],
  ['core_seller_metrics','analytics_seller_dashboard_v2'],['analytics_revenue_v1','analytics_legacy_kpis'],
  ['core_customers','analytics_legacy_kpis'],['core_orders','analytics_executive_kpis'],['core_subscriptions','analytics_executive_kpis'],
  ['core_refunds','analytics_refund_analysis'],['core_new_vs_returning','analytics_new_vs_returning'],
  ['core_new_vs_returning','analytics_new_customer_acquisition'],['core_web_engagement','analytics_new_customer_acquisition'],
  ['core_revenue_daily','analytics_finance_monthly'],['core_refunds','analytics_finance_monthly'],
  ['core_ad_performance','analytics_cac_analysis'],['core_customers','analytics_cac_analysis'],
  ['core_orders','analytics_channel_roi'],['core_web_engagement','analytics_channel_roi'],
];

// ── Dynamic layer colours ─────────────────────────────────────────────────────
// A small neutral palette — assigned round-robin by layer order
const LAYER_PALETTE_BORDER = ['#525252', '#737373', '#a3a3a3', '#262626', '#d4d4d4'];
const LAYER_PALETTE_BG_DARK  = ['#1a1a1a', '#111111', '#262626', '#0a0a0a', '#1f1f1f'];
const LAYER_PALETTE_BG_LIGHT = ['#f5f5f5', '#e5e5e5', '#fafafa', '#ebebeb', '#f0f0f0'];
const LAYER_PALETTE_TEXT_DARK  = Array(5).fill('#d4d4d4');
const LAYER_PALETTE_TEXT_LIGHT = Array(5).fill('#171717');

// Cache layer→index mapping so it's stable within a render cycle
const layerIndexCache = new Map<string, number>();
let layerCounter = 0;

function getLayerIndex(layer: string): number {
  if (!layerIndexCache.has(layer)) {
    layerIndexCache.set(layer, layerCounter++ % LAYER_PALETTE_BORDER.length);
  }
  return layerIndexCache.get(layer)!;
}

function layerBorder(layer: string): string {
  return LAYER_PALETTE_BORDER[getLayerIndex(layer)];
}
function layerBg(layer: string, theme: Theme): string {
  const i = getLayerIndex(layer);
  return theme === 'dark' ? LAYER_PALETTE_BG_DARK[i] : LAYER_PALETTE_BG_LIGHT[i];
}
function layerText(layer: string, theme: Theme): string {
  const i = getLayerIndex(layer);
  return theme === 'dark' ? LAYER_PALETTE_TEXT_DARK[i] : LAYER_PALETTE_TEXT_LIGHT[i];
}
function layerLabel(layer: string): string {
  return layer.charAt(0).toUpperCase() + layer.slice(1);
}
function getUniqueLayers(nodes: ModelNode[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const n of nodes) {
    if (!seen.has(n.layer)) { seen.add(n.layer); order.push(n.layer); }
  }
  return order;
}

const BADGE_CLS: Record<TestBadge, string> = {
  P: 'bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700',
  F: 'bg-purple-100 text-purple-700 border border-purple-300 dark:bg-purple-900 dark:text-purple-300 dark:border-purple-700',
  N: 'bg-green-100 text-green-700 border border-green-300 dark:bg-green-900 dark:text-green-300 dark:border-green-700',
  U: 'bg-yellow-100 text-yellow-700 border border-yellow-300 dark:bg-yellow-900 dark:text-yellow-300 dark:border-yellow-700',
};
const BADGE_TITLE: Record<TestBadge, string> = { P: 'Primary Key', F: 'Foreign Key', N: 'Not Null', U: 'Unique' };

// ── Model metadata ─────────────────────────────────────────────────────────────

// Static NODE_MAP for META lookups (meta is demo-only anyway)
const STATIC_NODE_MAP = new Map(NODES.map(n => [n.id, n]));

const META: Record<string, ModelMeta> = {
  core_orders: {
    description: 'Unified orders fact table combining Shopify order data with Stripe payment records. Each row represents one order with resolved payment status, item count, and revenue attribution.',
    columns: [
      { name: 'order_id',         type: 'varchar',   tests: ['P','N'],     description: 'Unique Shopify order ID' },
      { name: 'customer_id',      type: 'varchar',   tests: ['F','N'],     description: 'Foreign key to core_customers' },
      { name: 'order_date',       type: 'date',      tests: ['N'],         description: 'Date the order was placed' },
      { name: 'total_amount',     type: 'numeric',   tests: ['N'],         description: 'Gross order value in USD' },
      { name: 'payment_status',   type: 'varchar',   tests: [],            description: 'paid | pending | refunded' },
      { name: 'item_count',       type: 'integer',   tests: ['N'],         description: 'Number of line items' },
      { name: 'stripe_charge_id', type: 'varchar',   tests: ['U'],         description: 'Matching Stripe charge' },
    ],
    sql: `with orders as (\n  select * from {{ ref('src_shopify_orders') }}\n),\npayments as (\n  select * from {{ ref('src_stripe_payments') }}\n),\nline_items as (\n  select order_id, count(*) as item_count\n  from {{ ref('src_shopify_order_items') }}\n  group by 1\n)\nselect\n  o.order_id,\n  o.customer_id,\n  o.created_at::date            as order_date,\n  o.total_price                 as total_amount,\n  coalesce(p.status,'pending')  as payment_status,\n  coalesce(li.item_count, 0)    as item_count,\n  p.charge_id                   as stripe_charge_id\nfrom orders o\nleft join payments  p  on o.order_id = p.order_id\nleft join line_items li on o.order_id = li.order_id`,
  },
  core_customers: {
    description: 'Customer dimension table combining Shopify profiles with Stripe subscription status and order history. Primary customer entity across all analytics models.',
    columns: [
      { name: 'customer_id',    type: 'varchar',   tests: ['P','N','U'], description: 'Unique customer identifier' },
      { name: 'email',          type: 'varchar',   tests: ['N','U'],     description: 'Customer email address' },
      { name: 'first_name',     type: 'varchar',   tests: [],            description: 'First name' },
      { name: 'last_name',      type: 'varchar',   tests: [],            description: 'Last name' },
      { name: 'created_at',     type: 'timestamp', tests: ['N'],         description: 'Account creation timestamp' },
      { name: 'total_orders',   type: 'integer',   tests: ['N'],         description: 'Lifetime order count' },
      { name: 'lifetime_value', type: 'numeric',   tests: [],            description: 'Total revenue attributed' },
      { name: 'is_subscriber',  type: 'boolean',   tests: ['N'],         description: 'Has active Stripe subscription' },
    ],
    sql: `with customers as (\n  select * from {{ ref('src_shopify_customers') }}\n),\norder_stats as (\n  select customer_id,\n    count(*)          as total_orders,\n    sum(total_amount) as lifetime_value\n  from {{ ref('core_orders') }}\n  group by 1\n),\nsubs as (\n  select distinct customer_id, true as is_subscriber\n  from {{ ref('src_stripe_subscriptions') }}\n  where status = 'active'\n)\nselect\n  c.customer_id, c.email, c.first_name, c.last_name, c.created_at,\n  coalesce(os.total_orders,0)    as total_orders,\n  coalesce(os.lifetime_value,0)  as lifetime_value,\n  coalesce(s.is_subscriber,false) as is_subscriber\nfrom customers c\nleft join order_stats os using (customer_id)\nleft join subs s        using (customer_id)`,
  },
  core_revenue_daily: {
    description: 'Daily revenue aggregation from core_orders. Provides date-grain metrics used by downstream analytics and finance reporting.',
    columns: [
      { name: 'date_day',       type: 'date',    tests: ['P','N','U'], description: 'Calendar date' },
      { name: 'order_count',    type: 'integer', tests: ['N'],         description: 'Number of paid orders' },
      { name: 'gross_revenue',  type: 'numeric', tests: ['N'],         description: 'Sum of total_amount' },
      { name: 'net_revenue',    type: 'numeric', tests: ['N'],         description: 'Gross minus refunds' },
      { name: 'avg_order_value',type: 'numeric', tests: [],            description: 'gross_revenue / order_count' },
    ],
    sql: `select\n  order_date                        as date_day,\n  count(*)                          as order_count,\n  sum(total_amount)                 as gross_revenue,\n  sum(total_amount)\n    - coalesce(sum(refund_amount),0)  as net_revenue,\n  avg(total_amount)                 as avg_order_value\nfrom {{ ref('core_orders') }}\nwhere payment_status = 'paid'\ngroup by 1`,
  },
  analytics_b2b_pipeline: {
    description: 'B2B sales pipeline combining CRM accounts with open opportunities. Provides deal stage distribution, weighted pipeline value, and win-rate metrics for sales leadership.',
    columns: [
      { name: 'account_id',        type: 'varchar', tests: ['P','N'], description: 'Salesforce account ID' },
      { name: 'account_name',      type: 'varchar', tests: ['N'],     description: 'Company name' },
      { name: 'open_opps',         type: 'integer', tests: ['N'],     description: 'Count of open opportunities' },
      { name: 'pipeline_value',    type: 'numeric', tests: [],        description: 'Sum of opportunity amounts' },
      { name: 'weighted_pipeline', type: 'numeric', tests: [],        description: 'Amount × close probability' },
      { name: 'stage',             type: 'varchar', tests: [],        description: 'Dominant opportunity stage' },
    ],
    sql: `select\n  a.account_id, a.account_name,\n  count(o.opportunity_id)                       as open_opps,\n  sum(o.amount)                                 as pipeline_value,\n  sum(o.amount * o.close_probability / 100)     as weighted_pipeline,\n  mode() within group (order by o.stage)        as stage\nfrom {{ ref('core_b2b_accounts') }} a\nleft join {{ ref('core_opportunities') }} o\n  on a.account_id = o.account_id and not o.is_closed\ngroup by 1, 2`,
  },
  raw_salesforce_accounts: {
    description: 'Raw Salesforce Account records loaded via Fivetran. Contains all CRM account data including B2B company profiles, ARR estimates, and owner assignments.',
    columns: [
      { name: 'id',               type: 'varchar',   tests: ['P','N','U'], description: 'Salesforce Account ID (18-char)' },
      { name: 'name',             type: 'varchar',   tests: ['N'],         description: 'Account / company name' },
      { name: 'industry',         type: 'varchar',   tests: [],            description: 'Industry vertical' },
      { name: 'annual_revenue',   type: 'numeric',   tests: [],            description: 'Self-reported ARR' },
      { name: 'owner_id',         type: 'varchar',   tests: ['F'],         description: 'Salesforce User ID of AE' },
      { name: '_fivetran_synced', type: 'timestamp', tests: ['N'],         description: 'Last Fivetran sync time' },
    ],
    sql: `-- Raw table loaded by Fivetran connector\n-- Do not transform here — use src_salesforce_accounts\nselect * from salesforce.account`,
  },
};

function getMeta(id: string, nodes: ModelNode[], edgePairs: [string, string][]): ModelMeta {
  if (META[id]) return META[id];
  const n = nodes.find(x => x.id === id) ?? STATIC_NODE_MAP.get(id);
  const layer = n?.layer ?? 'raw';
  const label = id.replace(/^[a-z]+_/, '').replace(/_/g, ' ');
  const upstream = edgePairs.find(([, t]) => t === id)?.[0] ?? 'upstream_model';
  return {
    description: `${layerLabel(layer)}-layer model for ${label}.`,
    columns: [
      { name: `${id.replace(/^[a-z]+_/, '')}_id`, type: 'varchar', tests: ['P','N','U'], description: 'Primary key' },
      { name: 'created_at', type: 'timestamp', tests: ['N'], description: 'Record creation timestamp' },
      { name: 'updated_at', type: 'timestamp', tests: [],    description: 'Last update timestamp' },
    ],
    sql: layer === 'raw' ? `select * from ${id.replace(/^[a-z]+_/, '')}` : `select *\nfrom {{ ref('${upstream}') }}`,
  };
}

// ── Layer inference from model name ────────────────────────────────────────────

function inferLayer(name: string): string {
  // Extract the first snake_case segment as the layer name
  const prefix = name.split('_')[0];
  // Map common short prefixes to full names
  const map: Record<string, string> = { src: 'source', stg: 'staging', int: 'intermediate', fct: 'fact', dim: 'dimension', mart: 'mart', rpt: 'report' };
  return map[prefix] ?? prefix ?? 'unknown';
}

// ── Graph helpers ──────────────────────────────────────────────────────────────



function getFullLineage(id: string, edgePairs: [string, string][]) {
  const anc: string[] = [], desc: string[] = [], vis = new Set([id]);
  const up = (n: string) => edgePairs.forEach(([s, t]) => { if (t === n && !vis.has(s)) { vis.add(s); anc.push(s); up(s); } });
  up(id); vis.clear(); vis.add(id);
  const dn = (n: string) => edgePairs.forEach(([s, t]) => { if (s === n && !vis.has(t)) { vis.add(t); desc.push(t); dn(t); } });
  dn(id);
  return { ancestors: anc, descendants: desc };
}

// ── Dagre + ReactFlow ─────────────────────────────────────────────────────────

const NW = 195, NH = 44;

function buildFlow(modelNodes: ModelNode[], edgePairs: [string, string][], selectedId: string, theme: Theme) {
  const isDark = theme === 'dark';
  const rfNodes: Node[] = modelNodes.map(n => ({
    id: n.id, type: 'default', position: { x: 0, y: 0 },
    data: { label: n.name.replace(/^[a-z]+_/, '') },
    style: {
      background: n.id === selectedId ? (isDark ? '#ffffff' : '#0a0a0a') : layerBg(n.layer, theme),
      color: n.id === selectedId ? (isDark ? '#0a0a0a' : '#ffffff') : layerText(n.layer, theme),
      border: `1.5px solid ${n.id === selectedId ? (isDark ? '#ffffff' : '#0a0a0a') : layerBorder(n.layer)}`,
      borderRadius: 8, fontSize: 11, fontWeight: n.id === selectedId ? 700 : 400,
      width: NW, height: NH, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '0 8px', cursor: 'pointer',
      boxShadow: n.id === selectedId ? (isDark ? '0 0 0 2px rgba(255,255,255,0.2)' : '0 0 0 2px rgba(0,0,0,0.15)') : '0 1px 3px rgba(0,0,0,0.08)',
    },
  }));
  const rfEdges: Edge[] = edgePairs.map(([s, t], i) => ({
    id: `e${i}`, source: s, target: t,
    style: { stroke: isDark ? '#404040' : '#d4d4d4', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: isDark ? '#525252' : '#a3a3a3', width: 11, height: 11 },
  }));
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 110 });
  rfNodes.forEach(n => g.setNode(n.id, { width: NW, height: NH }));
  rfEdges.forEach(e => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return {
    nodes: rfNodes.map(n => { const p = g.node(n.id); return { ...n, position: { x: p.x - NW / 2, y: p.y - NH / 2 } }; }),
    edges: rfEdges,
  };
}

// ── Selector parser (dbt-style: +2model_name+3) ───────────────────────────────

interface Selector { nodeId: string; upDepth: number; downDepth: number; }

function parseSelector(raw: string): Selector | null {
  let s = raw.trim();
  let upDepth = 0, downDepth = 0;
  const pre = s.match(/^\+(\d*)/);
  if (pre) { upDepth = pre[1] ? parseInt(pre[1]) : 99; s = s.slice(pre[0].length); }
  const suf = s.match(/\+(\d*)$/);
  if (suf) { downDepth = suf[1] ? parseInt(suf[1]) : 99; s = s.slice(0, s.length - suf[0].length); }
  const nodeId = s.trim();
  if (!nodeId) return null;
  return { nodeId, upDepth, downDepth };
}

function getSelectorGraph(sel: Selector, nodes: ModelNode[], edgePairs: [string, string][]) {
  const inc = new Set<string>([sel.nodeId]);
  let f = [sel.nodeId];
  for (let d = 0; d < sel.upDepth && f.length; d++) {
    const nx: string[] = []; edgePairs.forEach(([s, t]) => { if (f.includes(t) && !inc.has(s)) { inc.add(s); nx.push(s); } }); f = nx;
  }
  f = [sel.nodeId];
  for (let d = 0; d < sel.downDepth && f.length; d++) {
    const nx: string[] = []; edgePairs.forEach(([s, t]) => { if (f.includes(s) && !inc.has(t)) { inc.add(t); nx.push(t); } }); f = nx;
  }
  return { nodes: nodes.filter(n => inc.has(n.id)), edges: edgePairs.filter(([s, t]) => inc.has(s) && inc.has(t)) };
}

function describeSel(sel: Selector): string {
  const parts: string[] = [];
  if (sel.upDepth   === 99) parts.push('all upstream');
  else if (sel.upDepth > 0) parts.push(`${sel.upDepth} level${sel.upDepth > 1 ? 's' : ''} upstream`);
  parts.push(sel.nodeId);
  if (sel.downDepth === 99) parts.push('all downstream');
  else if (sel.downDepth > 0) parts.push(`${sel.downDepth} level${sel.downDepth > 1 ? 's' : ''} downstream`);
  return parts.join(' → ');
}

// ── Full-screen lineage modal ──────────────────────────────────────────────────

function LineageModal({ initialId, onClose, onNavigate }: {
  initialId: string; onClose: () => void; onNavigate: (id: string) => void;
}) {
  const { T, theme, isDark } = useTheme();
  const { nodes: graphNodes, edgePairs } = useGraph();
  const [query, setQuery]     = useState(initialId);
  const [applied, setApplied] = useState<Selector>({ nodeId: initialId, upDepth: 1, downDepth: 1 });
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [focusSug, setFocusSug] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  const { nodes: mn, edges: me } = getSelectorGraph(applied, graphNodes, edgePairs);
  const { nodes: fn, edges: fe } = buildFlow(mn, me, applied.nodeId, theme);
  const [nodes, setNodes, onNC] = useNodesState<Node>(fn);
  const [edges, setEdges, onEC] = useEdgesState<Edge>(fe);

  useEffect(() => {
    const { nodes: mn2, edges: me2 } = getSelectorGraph(applied, graphNodes, edgePairs);
    const { nodes: fn2, edges: fe2 } = buildFlow(mn2, me2, applied.nodeId, theme);
    setNodes(fn2); setEdges(fe2);
  }, [applied, theme, graphNodes, edgePairs]);

  // Autocomplete: extract the model-name part of the query
  function updateSuggestions(raw: string) {
    setQuery(raw);
    const m = raw.trim().replace(/^\+\d*/, '').replace(/\+\d*$/, '').trim();
    if (!m || m.length < 2) { setSuggestions([]); return; }
    setSuggestions(graphNodes.filter(n => n.name.includes(m) && n.name !== m).map(n => n.name).slice(0, 6));
    setFocusSug(-1);
  }

  function applySuggestion(name: string) {
    const prefix = query.trim().match(/^\+\d*/)?.[0] ?? '';
    const suffix = query.trim().match(/\+\d*$/)?.[0] ?? '';
    const newQ = prefix + name + suffix;
    setQuery(newQ); setSuggestions([]); applyQuery(newQ);
  }

  function applyQuery(raw = query) {
    const sel = parseSelector(raw);
    if (!sel) return;
    const found = graphNodes.find(n => n.name === sel.nodeId || n.id === sel.nodeId);
    if (!found) return;
    setApplied({ ...sel, nodeId: found.id });
    setSuggestions([]);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocusSug(p => Math.min(p + 1, suggestions.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setFocusSug(p => Math.max(p - 1, -1)); return; }
      if (e.key === 'Enter' && focusSug >= 0) { applySuggestion(suggestions[focusSug]); return; }
      if (e.key === 'Escape') { setSuggestions([]); return; }
    }
    if (e.key === 'Enter') applyQuery();
  }

  const selNode = graphNodes.find(n => n.id === applied.nodeId);
  const parsed  = parseSelector(query);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.65)' }}>
      <div className="w-[92vw] h-[88vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl border" style={{ background: T.panel, borderColor: T.border }}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0" style={{ borderColor: T.border, background: T.secondary }}>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold" style={{ color: T.text }}>Lineage Explorer</span>
            {selNode && <span className="text-xs px-2 py-0.5 rounded" style={{ background: layerBg(selNode.layer, theme), color: layerBorder(selNode.layer), border: `1px solid ${layerBorder(selNode.layer)}` }}>{layerLabel(selNode.layer)}</span>}
            <span className="text-xs" style={{ color: T.faint }}>{nodes.length} nodes · {edges.length} edges</span>
          </div>
          <div className="flex items-center gap-3">
            {getUniqueLayers(graphNodes).slice(0, 4).map(l => (
              <span key={l} className="hidden md:flex items-center gap-1.5 text-xs" style={{ color: T.muted }}>
                <span className="w-2 h-2 rounded-sm" style={{ background: layerBorder(l) }} />{layerLabel(l)}
              </span>
            ))}
            <button onClick={onClose} className="ml-2 hover:opacity-70 transition-opacity" style={{ color: T.muted }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── Canvas ── */}
        <div className="flex-1 relative" style={{ background: T.rfBg }}>
          <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNC} onEdgesChange={onEC}
            onNodeClick={(_, n) => { onNavigate(n.id); onClose(); }}
            fitView fitViewOptions={{ padding: 0.15 }} proOptions={{ hideAttribution: true }}>
            <Background variant={BackgroundVariant.Dots} color={T.rfDot} gap={20} />
            <Controls />
          </ReactFlow>
        </div>

        {/* ── Selector bar (bottom, like dbt) ── */}
        <div className="border-t px-4 py-3 flex-shrink-0 relative" style={{ borderColor: T.border, background: T.secondary }}>

          {/* Autocomplete dropdown */}
          {suggestions.length > 0 && (
            <div className="absolute bottom-full left-4 right-4 mb-1 rounded-lg shadow-2xl overflow-hidden border z-10"
              style={{ background: T.panel, borderColor: T.border }}>
              {suggestions.map((s, i) => {
                const n = graphNodes.find(x => x.name === s || x.id === s);
                return (
                  <button key={s} onClick={() => applySuggestion(s)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs transition-colors"
                    style={{ background: i === focusSug ? T.hover : 'transparent', color: T.text }}
                    onMouseEnter={e => (e.currentTarget.style.background = T.hover)}
                    onMouseLeave={e => (e.currentTarget.style.background = i === focusSug ? T.hover : 'transparent')}>
                    {n && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: layerBorder(n.layer) }} />}
                    <span className="font-mono">{s}</span>
                    {n && <span className="ml-auto text-xs" style={{ color: T.faint }}>{layerLabel(n.layer)}</span>}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-3">
            {/* Input */}
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => updateSuggestions(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="+2core_orders+1   (+ = all · +N = N levels · prefix = upstream · suffix = downstream)"
                className={`w-full rounded-lg px-3 py-2 text-xs font-mono border focus:outline-none focus:ring-1 focus:ring-neutral-500 ${T.inputCls}`}
              />
            </div>
            <button onClick={() => applyQuery()}
              className="px-4 py-2 rounded-lg text-xs font-semibold transition-colors hover:opacity-90"
              style={{ background: isDark ? '#ffffff' : '#0a0a0a', color: isDark ? '#0a0a0a' : '#ffffff' }}>
              Show
            </button>

            {/* Current interpretation */}
            <div className="hidden md:flex items-center gap-2 min-w-[220px]">
              {parsed && graphNodes.some(n => n.id === parsed.nodeId || n.name === parsed.nodeId) ? (
                <span className="text-xs font-mono px-2 py-1 rounded" style={{ background: T.panel, color: T.muted, border: `1px solid ${T.border}` }}>
                  {describeSel(parsed)}
                </span>
              ) : (
                <span className="text-xs" style={{ color: T.faint }}>
                  Syntax: <span className="font-mono">+N</span>model<span className="font-mono">+N</span>
                </span>
              )}
            </div>
          </div>

          {/* Depth controls */}
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <span className="text-xs" style={{ color: T.faint }}>Depth:</span>
            {/* Upstream depth */}
            <div className="flex items-center gap-1">
              <span className="text-xs" style={{ color: T.muted }}>↑ Up</span>
              <button
                onClick={() => setApplied(a => ({ ...a, upDepth: Math.max(0, a.upDepth === 99 ? 5 : a.upDepth - 1) }))}
                className="w-6 h-6 rounded text-xs flex items-center justify-center transition-colors hover:opacity-80"
                style={{ background: T.secondary, color: T.text }}>−</button>
              <span className="text-xs font-mono w-6 text-center" style={{ color: T.text }}>
                {applied.upDepth === 99 ? '∞' : applied.upDepth}
              </span>
              <button
                onClick={() => setApplied(a => ({ ...a, upDepth: a.upDepth >= 5 ? 99 : a.upDepth + 1 }))}
                className="w-6 h-6 rounded text-xs flex items-center justify-center transition-colors hover:opacity-80"
                style={{ background: T.secondary, color: T.text }}>+</button>
            </div>
            {/* Downstream depth */}
            <div className="flex items-center gap-1">
              <span className="text-xs" style={{ color: T.muted }}>↓ Down</span>
              <button
                onClick={() => setApplied(a => ({ ...a, downDepth: Math.max(0, a.downDepth === 99 ? 5 : a.downDepth - 1) }))}
                className="w-6 h-6 rounded text-xs flex items-center justify-center transition-colors hover:opacity-80"
                style={{ background: T.secondary, color: T.text }}>−</button>
              <span className="text-xs font-mono w-6 text-center" style={{ color: T.text }}>
                {applied.downDepth === 99 ? '∞' : applied.downDepth}
              </span>
              <button
                onClick={() => setApplied(a => ({ ...a, downDepth: a.downDepth >= 5 ? 99 : a.downDepth + 1 }))}
                className="w-6 h-6 rounded text-xs flex items-center justify-center transition-colors hover:opacity-80"
                style={{ background: T.secondary, color: T.text }}>+</button>
            </div>
            <span className="text-xs" style={{ color: T.faint }}>or use syntax below</span>
          </div>

          {/* Quick examples */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs" style={{ color: T.faint }}>Examples:</span>
            {[
              [initialId,           `${initialId} only`],
              [`${initialId}+`,     'all downstream'],
              [`+${initialId}`,     'all upstream'],
              [`+${initialId}+`,    'full lineage'],
              [`+2${initialId}+1`,  '2 up · 1 down'],
            ].map(([q, label]) => (
              <button key={q} onClick={() => { setQuery(q); applyQuery(q); }}
                className="text-xs font-mono px-2 py-0.5 rounded transition-colors hover:opacity-80"
                style={{ background: T.panel, color: T.text, border: `1px solid ${T.border}` }}>
                {q}
                <span className="ml-1 font-sans" style={{ color: T.faint }}>({label})</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Model Documentation ────────────────────────────────────────────────────────

type DocTab = 'description' | 'columns' | 'sql' | 'lineage';

interface ColLineageEntry {
  output: string;
  exprType: string;
  sourceRefs: { model: string; column: string }[];
}

function ModelDocs({ id, onNavigate, onFocusAI }: {
  id: string; onNavigate: (id: string) => void; onFocusAI: () => void;
}) {
  const { T, theme, isDark } = useTheme();
  const { workspaceId } = useAuth();
  const { nodes: graphNodes, edgePairs } = useGraph();
  const [tab, setTab] = useState<DocTab>('description');
  const [colLineage, setColLineage] = useState<ColLineageEntry[]>([]);
  const [lineageLoading, setLineageLoading] = useState(false);

  useEffect(() => {
    if (tab !== 'lineage' || !workspaceId) return;
    setLineageLoading(true);
    lineageApi.columns(workspaceId, id)
      .then(r => setColLineage((r.data.column_lineage as ColLineageEntry[]) ?? []))
      .catch(() => setColLineage([]))
      .finally(() => setLineageLoading(false));
  }, [tab, id, workspaceId]);
  const [lineageOpen, setLineageOpen] = useState(false);

  const node = graphNodes.find(n => n.id === id) ?? STATIC_NODE_MAP.get(id);
  const meta = getMeta(id, graphNodes, edgePairs);
  const parents  = edgePairs.filter(([, t]) => t === id).map(([s]) => s);
  const children = edgePairs.filter(([s]) => s === id).map(([, t]) => t);
  const { ancestors, descendants } = getFullLineage(id, edgePairs);

  if (!node) return null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative" style={{ background: T.bg }}>
      {/* Header */}
      <div className="px-8 pt-6 pb-0 border-b flex-shrink-0" style={{ borderColor: T.border }}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold font-mono" style={{ color: T.text }}>{node.name}</h1>
              <span className="text-xs px-2 py-0.5 rounded font-medium"
                style={{ background: layerBg(node.layer, theme), color: layerBorder(node.layer), border: `1px solid ${layerBorder(node.layer)}` }}>
                {layerLabel(node.layer)}
              </span>
              <span className="text-xs" style={{ color: T.faint }}>table</span>
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-xs flex-wrap" style={{ color: T.muted }}>
              {parents.length > 0 && (
                <span>↑ {parents.length} upstream: {parents.slice(0,2).map(p => (
                  <button key={p} onClick={() => onNavigate(p)} className="hover:underline ml-1 font-mono" style={{ color: T.text }}>{p}</button>
                ))}{parents.length > 2 && ` +${parents.length-2} more`}</span>
              )}
              {children.length > 0 && (
                <span>↓ {children.length} downstream: {children.slice(0,2).map(c => (
                  <button key={c} onClick={() => onNavigate(c)} className="hover:underline ml-1 font-mono" style={{ color: T.text }}>{c}</button>
                ))}{children.length > 2 && ` +${children.length-2} more`}</span>
              )}
              {parents.length === 0  && <span style={{ color: '#22c55e' }}>● root model</span>}
              {children.length === 0 && <span style={{ color: '#f59e0b' }}>● leaf model</span>}
            </div>
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-0 mt-4">
          {(['description','columns','sql','lineage'] as DocTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2"
              style={{
                color: tab === t ? T.text : T.muted,
                borderColor: tab === t ? T.text : 'transparent',
              }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab body */}
      <div className="flex-1 overflow-y-auto px-8 py-6">

        {tab === 'description' && (
          <div className="max-w-2xl space-y-5">
            <div>
              <h3 className="text-sm font-semibold mb-2" style={{ color: T.text }}>Description</h3>
              <p className="text-sm leading-relaxed" style={{ color: T.muted }}>{meta.description}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2" style={{ color: T.text }}>Details</h3>
              <table className="text-xs w-full">
                <tbody>
                  {[
                    ['Layer',      layerLabel(node.layer)],
                    ['Columns',    String(meta.columns.length)],
                    ['Upstream',   `${parents.length} direct · ${ancestors.length} total`],
                    ['Downstream', `${children.length} direct · ${descendants.length} total`],
                  ].map(([k, v]) => (
                    <tr key={k} className="border-b" style={{ borderColor: T.border }}>
                      <td className="py-2 pr-8 w-28" style={{ color: T.faint }}>{k}</td>
                      <td className="py-2" style={{ color: T.text }}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'columns' && (
          <div className="max-w-3xl">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: T.border }}>
                  {['Tests','Column','Type','Description'].map(h => (
                    <th key={h} className="pb-2 pr-6 font-medium uppercase tracking-wide" style={{ color: T.faint }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {meta.columns.map(col => (
                  <tr key={col.name} className="border-b transition-colors" style={{ borderColor: T.border }}>
                    <td className="py-2.5 pr-4">
                      <div className="flex gap-1">
                        {col.tests.map(t => (
                          <span key={t} title={BADGE_TITLE[t]} className={`px-1 py-0.5 rounded text-[10px] font-bold leading-none ${BADGE_CLS[t]}`}>{t}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 pr-6 font-mono" style={{ color: T.text }}>{col.name}</td>
                    <td className="py-2.5 pr-6 font-mono" style={{ color: T.faint }}>{col.type}</td>
                    <td className="py-2.5" style={{ color: T.muted }}>{col.description ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex gap-4 mt-4">
              {(['P','F','N','U'] as TestBadge[]).map(t => (
                <span key={t} className="flex items-center gap-1 text-xs" style={{ color: T.faint }}>
                  <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${BADGE_CLS[t]}`}>{t}</span>
                  {BADGE_TITLE[t]}
                </span>
              ))}
            </div>
          </div>
        )}

        {tab === 'sql' && (
          <div className="max-w-3xl">
            <div className="rounded-xl overflow-hidden border" style={{ borderColor: T.border }}>
              <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: T.border, background: T.secondary }}>
                <span className="text-xs font-mono" style={{ color: T.muted }}>{node.name}.sql</span>
                <button onClick={() => navigator.clipboard?.writeText(meta.sql)}
                  className="text-xs transition-opacity hover:opacity-70" style={{ color: T.muted }}>Copy</button>
              </div>
              <pre className="p-4 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre"
                style={{ background: T.panel, color: theme === 'dark' ? '#86efac' : '#166534' }}>
                {meta.sql}
              </pre>
            </div>
          </div>
        )}

        {tab === 'lineage' && (
          <div className="max-w-3xl">
            <p className="text-xs mb-4" style={{ color: T.faint }}>
              Column-level lineage shows which upstream model columns feed each output column.
              Only available after running an audit with <span className="font-mono">datapilot audit</span>.
            </p>
            {lineageLoading ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: T.muted }}>
                <div className="w-4 h-4 border-2 border-neutral-400 dark:border-neutral-500 border-t-transparent rounded-full animate-spin" />
                Loading column lineage…
              </div>
            ) : colLineage.length === 0 ? (
              <div className="rounded-xl border p-6 text-center" style={{ borderColor: T.border }}>
                <p className="text-sm" style={{ color: T.muted }}>No column lineage available for this model.</p>
                <p className="text-xs mt-1" style={{ color: T.faint }}>Run an audit to generate AST-based column lineage.</p>
              </div>
            ) : (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b text-left" style={{ borderColor: T.border }}>
                    {['Output Column', 'Type', 'Source Columns'].map(h => (
                      <th key={h} className="pb-2 pr-6 font-medium uppercase tracking-wide" style={{ color: T.faint }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {colLineage.map((entry, i) => (
                    <tr key={i} className="border-b" style={{ borderColor: T.border }}>
                      <td className="py-2.5 pr-6 font-mono font-semibold" style={{ color: T.text }}>{entry.output}</td>
                      <td className="py-2.5 pr-6">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono"
                          style={{ background: entry.exprType === 'aggr_func' ? '#fef3c7' : entry.exprType === 'column_ref' ? '#ede9fe' : '#f1f5f9',
                                   color:      entry.exprType === 'aggr_func' ? '#92400e' : entry.exprType === 'column_ref' ? '#5b21b6' : '#475569' }}>
                          {entry.exprType === 'aggr_func' ? 'aggregate' : entry.exprType === 'column_ref' ? 'pass-through' : entry.exprType}
                        </span>
                      </td>
                      <td className="py-2.5" style={{ color: T.muted }}>
                        {entry.sourceRefs.length === 0
                          ? <span style={{ color: T.faint }}>expression / literal</span>
                          : entry.sourceRefs.map((r, j) => (
                            <span key={j} className="inline-flex items-center gap-1 mr-2">
                              <button onClick={() => onNavigate(r.model)}
                                className="font-mono hover:underline" style={{ color: T.text }}>{r.model}</button>
                              <span style={{ color: T.faint }}>.</span>
                              <span className="font-mono" style={{ color: T.text }}>{r.column}</span>
                            </span>
                          ))
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── FABs: vertical strip on right edge, vertically centred ── */}
      <div className="absolute right-5 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-10">
        {/* AI FAB */}
        <div className="relative group">
          <button onClick={onFocusAI} title="Ask AI"
            className="w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 border"
            style={{ background: isDark ? '#ffffff' : '#0a0a0a', borderColor: isDark ? '#ffffff' : '#0a0a0a', color: isDark ? '#0a0a0a' : '#ffffff' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
          <span className="absolute right-14 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
            style={{ background: T.secondary, color: T.text, border: `1px solid ${T.border}` }}>Ask AI</span>
        </div>
        {/* Lineage FAB */}
        <div className="relative group">
          <button onClick={() => setLineageOpen(true)} title="View Lineage"
            className="w-11 h-11 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95 border"
            style={{ background: layerBorder(node.layer), borderColor: layerBorder(node.layer), color: '#fff' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="5" cy="12" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/>
              <line x1="7" y1="12" x2="17" y2="6"/><line x1="7" y1="12" x2="17" y2="18"/>
            </svg>
          </button>
          <span className="absolute right-14 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity"
            style={{ background: T.secondary, color: T.text, border: `1px solid ${T.border}` }}>View Lineage</span>
        </div>
      </div>

      {/* Full lineage modal */}
      {lineageOpen && (
        <LineageModal initialId={id} onClose={() => setLineageOpen(false)} onNavigate={id2 => { onNavigate(id2); setLineageOpen(false); }} />
      )}
    </div>
  );
}

// ── Model Tree ─────────────────────────────────────────────────────────────────

function ModelTree({ selected, onSelect, width }: { selected: string | null; onSelect: (id: string) => void; width: number }) {
  const { T } = useTheme();
  const { nodes: graphNodes, loading: graphLoading } = useGraph();
  const [search, setSearch]   = useState('');
  const [collapsed, setCollapsed] = useState<Set<Layer>>(new Set());
  const toggle = (l: Layer) => setCollapsed(p => { const s = new Set(p); s.has(l) ? s.delete(l) : s.add(l); return s; });
  const filtered = graphNodes.filter(n => n.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col h-full border-r flex-shrink-0" style={{ width, background: T.panel, borderColor: T.border }}>
      <div className="px-3 py-3 border-b flex-shrink-0" style={{ borderColor: T.border }}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: T.faint }}>Models</p>
        <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
          className={`w-full rounded px-2 py-1.5 text-xs border focus:outline-none ${T.inputCls}`} />
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {getUniqueLayers(graphNodes).map(layer => {
          const models = filtered.filter(n => n.layer === layer);
          if (!models.length) return null;
          const isCol = collapsed.has(layer);
          return (
            <div key={layer}>
              <button onClick={() => toggle(layer)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors"
                style={{ color: T.muted }}
                onMouseEnter={e => (e.currentTarget.style.background = T.hover)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <span className="text-xs w-2" style={{ color: T.faint }}>{isCol ? '▶' : '▼'}</span>
                <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: layerBorder(layer) }} />
                <span className="text-xs font-semibold" style={{ color: T.text }}>{layerLabel(layer)}</span>
                <span className="ml-auto text-xs" style={{ color: T.faint }}>{models.length}</span>
              </button>
              {!isCol && models.map(n => (
                <button key={n.id} onClick={() => onSelect(n.id)}
                  className="w-full flex items-center gap-2 px-4 py-1 text-left transition-colors"
                  style={{ background: selected === n.id ? T.hover : 'transparent' }}
                  onMouseEnter={e => { if (selected !== n.id) e.currentTarget.style.background = T.hover; }}
                  onMouseLeave={e => { if (selected !== n.id) e.currentTarget.style.background = 'transparent'; }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: selected === n.id ? layerBorder(layer) : T.faint, border: `1px solid ${layerBorder(layer)}` }} />
                  <span className="text-xs truncate" style={{ color: selected === n.id ? T.text : T.muted, fontWeight: selected === n.id ? 600 : 400 }}>
                    {n.name.replace(/^[a-z]+_/, '')}
                  </span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <div className="px-3 py-2 border-t flex items-center gap-2" style={{ borderColor: T.border }}>
        {graphLoading
          ? <div className="w-3 h-3 border-2 border-neutral-400 dark:border-neutral-500 border-t-transparent rounded-full animate-spin" />
          : <p className="text-xs" style={{ color: T.faint }}>{graphNodes.length} models</p>
        }
      </div>
    </div>
  );
}

// ── AI Chat ────────────────────────────────────────────────────────────────────

function buildContext(id: string, graphNodes: ModelNode[], edgePairs: [string, string][]) {
  const n = graphNodes.find(x => x.id === id) ?? STATIC_NODE_MAP.get(id); if (!n) return '';
  const { ancestors, descendants } = getFullLineage(id, edgePairs);
  const parents  = edgePairs.filter(([,t]) => t === id).map(([s]) => s);
  const children = edgePairs.filter(([s]) => s === id).map(([,t]) => t);
  return [
    `**Model: \`${id}\`** (${layerLabel(n.layer)} layer)`,
    '',
    parents.length  ? `**Direct upstream (${parents.length}):** ${parents.join(', ')}`   : '**Upstream:** none — root model',
    children.length ? `**Direct downstream (${children.length}):** ${children.join(', ')}` : '**Downstream:** none — leaf model',
    '',
    `**Full ancestry (${ancestors.length}):** ${ancestors.length ? ancestors.join(', ') : 'none'}`,
    `**Full impact (${descendants.length}):** ${descendants.length ? descendants.join(', ') : 'none'}`,
    '',
    'How can I help you with this model?',
  ].join('\n');
}

function AiChat({ selectedModelId, open, onToggle }: {
  selectedModelId: string | null; open: boolean; onToggle: () => void;
}) {
  const { T, isDark } = useTheme();
  const { workspaceId } = useAuth();
  const { nodes: graphNodes, edgePairs } = useGraph();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedModelId) return;
    setMessages([{ role: 'assistant', content: buildContext(selectedModelId, graphNodes, edgePairs), ts: Date.now() }]);
  }, [selectedModelId, graphNodes, edgePairs]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send() {
    if (!input.trim() || loading || !workspaceId) return;
    const msg: ChatMessage = { role: 'user', content: input.trim(), ts: Date.now() };
    setMessages(p => [...p, msg]); setInput(''); setLoading(true);
    try {
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const { data } = await chatApi.send(workspaceId, {
        message: msg.content,
        history,
        context_model_name: selectedModelId ?? undefined,
      });
      setMessages(p => [...p, { role: 'assistant', content: data.reply, ts: Date.now() }]);
    } catch (err: unknown) {
      const raw = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '';
      const reply = raw.toLowerCase().includes('no llm provider') || raw.toLowerCase().includes('not configured')
        ? '⚙️ AI provider not configured yet. Connect your API key in Settings to enable chat.'
        : raw || 'Failed to get a response.';
      setMessages(p => [...p, { role: 'assistant', content: reply, ts: Date.now() }]);
    } finally { setLoading(false); }
  }

  return (
    <div className="flex flex-col flex-shrink-0 border-l transition-all duration-200 overflow-hidden"
      style={{ width: open ? 288 : 44, borderColor: T.border, background: T.panel }}>

      {/* Collapsed strip */}
      {!open && (
        <button onClick={onToggle} className="flex flex-col items-center justify-center h-full gap-3 w-full hover:opacity-80 transition-opacity"
          style={{ color: T.muted }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span className="text-xs font-semibold" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>AI</span>
        </button>
      )}

      {/* Expanded panel */}
      {open && (<>
        <div className="px-4 py-3 border-b flex items-center gap-2 flex-shrink-0" style={{ borderColor: T.border }}>
          <div className="w-2 h-2 rounded-full bg-neutral-400" />
          <p className="text-xs font-semibold flex-1" style={{ color: T.text }}>AI Assistant</p>
          {selectedModelId && (
            <span className="text-xs px-2 py-0.5 rounded truncate max-w-[110px]" style={{ background: T.secondary, color: T.muted }}>{selectedModelId}</span>
          )}
          {/* Minimize button */}
          <button onClick={onToggle} className="ml-1 hover:opacity-70 transition-opacity" style={{ color: T.faint }} title="Minimize">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {!selectedModelId && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="text-2xl mb-3 opacity-20">⬅</div>
              <p className="text-xs" style={{ color: T.faint }}>Select a model to load its context into the conversation.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[92%] rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap"
                style={{ background: m.role === 'user' ? (isDark ? '#ffffff' : '#0a0a0a') : T.secondary, color: m.role === 'user' ? (isDark ? '#0a0a0a' : '#ffffff') : T.text }}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && <div className="flex justify-start"><div className="rounded-lg px-3 py-2 text-xs animate-pulse" style={{ background: T.secondary, color: T.faint }}>Thinking…</div></div>}
          <div ref={bottomRef} />
        </div>

        <div className="px-3 py-3 border-t flex-shrink-0" style={{ borderColor: T.border }}>
          <div className="flex gap-2">
            <input type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
              placeholder={selectedModelId ? `Ask about ${selectedModelId}…` : 'Select a model first…'}
              disabled={!selectedModelId || loading}
              className={`flex-1 rounded px-2 py-1.5 text-xs border focus:outline-none disabled:opacity-40 ${T.inputCls}`} />
            <button onClick={send} disabled={!selectedModelId || !input.trim() || loading}
              className="px-3 py-1.5 rounded text-xs transition-colors disabled:opacity-40"
              style={{ background: isDark ? '#ffffff' : '#0a0a0a', color: isDark ? '#0a0a0a' : '#ffffff' }}>
              Send
            </button>
          </div>
        </div>
      </>)}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function Lineage() {
  const [searchParams] = useSearchParams();
  const focusParam = searchParams.get('focus');
  const { workspaceId } = useAuth();
  const { theme: globalTheme } = useGlobalTheme();
  const theme: Theme = globalTheme === 'dark' ? 'dark' : 'light';

  const [selectedId, setSelected] = useState<string | null>(focusParam ?? null);
  const [aiOpen, setAiOpen]     = useState(true);
  const [treeWidth, setTreeWidth] = useState(240);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, w: 0 });

  // ── API-backed graph state ────────────────────────────────────────────────
  const [graphNodes, setGraphNodes] = useState<ModelNode[]>(NODES);
  const [edgePairs, setEdgePairs]   = useState<[string, string][]>(EDGES_RAW);
  const [graphLoading, setGraphLoading] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    setGraphLoading(true);
    lineageApi.graph(workspaceId)
      .then(r => {
        const data = r.data?.data;
        if (!data) return;
        const apiNodes: ModelNode[] = (data.nodes ?? []).map((n: { id: string; name: string }) => ({
          id: n.id,
          name: n.name,
          layer: inferLayer(n.name),
        }));
        const apiEdges: [string, string][] = (data.edges ?? []).map(
          (e: { source_node_id: string; target_node_id: string }) => [e.source_node_id, e.target_node_id] as [string, string]
        );
        if (apiNodes.length > 0) {
          setGraphNodes(apiNodes);
          setEdgePairs(apiEdges);
        }
      })
      .catch(() => { /* keep static fallback */ })
      .finally(() => setGraphLoading(false));
  }, [workspaceId]);

  const T = THEME[theme];

  useEffect(() => {
    if (focusParam) setSelected(focusParam);
  }, [focusParam]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - dragStart.current.x;
      setTreeWidth(Math.max(160, Math.min(380, dragStart.current.w + delta)));
    };
    const onUp = () => { dragging.current = false; document.body.style.cursor = ''; };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
  }, []);

  const handleSelect = useCallback((id: string) => setSelected(id), []);
  const focusAI = useCallback(() => { setAiOpen(true); }, []);

  return (
    <ThemeCtx.Provider value={{ theme, T, isDark: theme === 'dark' }}>
    <GraphCtx.Provider value={{ nodes: graphNodes, edgePairs, loading: graphLoading }}>
      <div className="flex h-full overflow-hidden relative" style={{ background: T.bg }}>

        {/* ── Left: Model tree ── */}
        <ModelTree selected={selectedId} onSelect={handleSelect} width={treeWidth} />

        {/* ── Drag handle ── */}
        <div
          className="w-1 flex-shrink-0 cursor-col-resize transition-colors hover:bg-neutral-500/20 active:bg-neutral-500/30"
          style={{ background: T.border }}
          onMouseDown={e => { dragging.current = true; dragStart.current = { x: e.clientX, w: treeWidth }; document.body.style.cursor = 'col-resize'; }}
        />

        {/* ── Center: Docs or empty state ── */}
        <div className="flex-1 overflow-hidden">
          {selectedId ? (
            <ModelDocs id={selectedId} onNavigate={handleSelect} onFocusAI={focusAI} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8" style={{ background: T.bg }}>
              <div className="text-5xl mb-5 opacity-10">⬡</div>
              <p className="text-sm font-medium mb-2" style={{ color: T.faint }}>No model selected</p>
              <p className="text-xs max-w-xs" style={{ color: T.faint }}>Pick a model from the tree to view its documentation, columns, SQL, and lineage.</p>
            </div>
          )}
        </div>

        {/* ── Right: AI Chat (collapsible) ── */}
        <AiChat selectedModelId={selectedId} open={aiOpen} onToggle={() => setAiOpen(v => !v)} />
      </div>
    </GraphCtx.Provider>
    </ThemeCtx.Provider>
  );
}
