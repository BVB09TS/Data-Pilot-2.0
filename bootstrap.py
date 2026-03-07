# -*- coding: utf-8 -*-
import os, json, glob, sys
BASE = os.path.dirname(os.path.abspath(__file__))

def write(path, content):
    full = os.path.join(BASE, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content.lstrip("\n"))
    print(f"  OK  {path}")

def mkdir(path):
    os.makedirs(os.path.join(BASE, path), exist_ok=True)

print("\n" + "="*55)
print("  DataPilot / ShopMesh  Bootstrap")
print("="*55 + "\n")

for folder in [
    "shopmesh_dbt/models/raw",
    "shopmesh_dbt/models/source",
    "shopmesh_dbt/models/core",
    "shopmesh_dbt/models/analytics",
    "shopmesh_dbt/seeds",
    "shopmesh_dbt/tests",
    "shopmesh_dbt/macros",
    "shopmesh_dbt/docs",
    "scripts",
    "agent",
]:
    mkdir(folder)
    print(f"  OK  {folder}/")

write("shopmesh_dbt/dbt_project.yml", """
name: 'shopmesh'
version: '1.0.0'
config-version: 2
profile: 'shopmesh'
model-paths:  ["models"]
seed-paths:   ["seeds"]
test-paths:   ["tests"]
macro-paths:  ["macros"]
docs-paths:   ["docs"]
target-path:  "target"
clean-targets: ["target", "dbt_packages"]
models:
  shopmesh:
    raw:
      +materialized: view
      +schema: raw
      +tags: ["raw"]
    source:
      +materialized: view
      +schema: source
      +tags: ["source"]
    core:
      +materialized: table
      +schema: core
      +tags: ["core"]
    analytics:
      +materialized: table
      +schema: analytics
      +tags: ["analytics"]
seeds:
  shopmesh:
    +schema: seeds
    +quote_columns: false
""")

write("shopmesh_dbt/profiles.yml", """
shopmesh:
  target: dev
  outputs:
    dev:
      type: duckdb
      path: "shopmesh.duckdb"
      threads: 4
""")

write("shopmesh_dbt/packages.yml", """
packages:
  - package: dbt-labs/dbt_utils
    version: [">=1.0.0", "<2.0.0"]
""")

write(".sqlfluff", """
[sqlfluff]
templater = dbt
dialect = duckdb
sql_file_exts = .sql
max_line_length = 100
[sqlfluff:templater:dbt]
project_dir = shopmesh_dbt
""")

if not os.path.exists(os.path.join(BASE, ".env")):
    write(".env", "ANTHROPIC_API_KEY=your_api_key_here\n")

write("requirements.txt", """
dbt-duckdb>=1.8.0
anthropic>=0.20.0
networkx>=3.0
pandas>=2.0
rich>=13.0
duckdb>=0.10.0
pyyaml>=6.0
python-dotenv>=1.0
kuzu>=0.4.0
sqlglot>=23.0
""")

write("README.md", """
# ShopMesh dbt Project

## 4-Layer Architecture
  raw/        Receive JSON from source systems. Zero logic.
  source/     Light transforms: rename, cast, clean only.
  core/       All business logic, joins, calculations.
  analytics/  Business-ready tables. Light merging only.

## Naming conventions
  raw_        raw_shopify_orders
  src_        src_shopify_orders
  core_       core_orders
  analytics_  analytics_revenue_daily

## Run
  cd shopmesh_dbt
  dbt deps && dbt seed && dbt run && dbt test
""")

# ── MACROS ────────────────────────────────────────────────────
write("shopmesh_dbt/macros/safe_divide.sql", """
{% macro safe_divide(numerator, denominator) %}
    case
        when {{ denominator }} = 0 or {{ denominator }} is null then null
        else {{ numerator }} / {{ denominator }}
    end
{% endmacro %}
""")

write("shopmesh_dbt/macros/cents_to_dollars.sql", """
{% macro cents_to_dollars(column_name) %}
    round({{ column_name }} / 100.0, 2)
{% endmacro %}
""")

write("shopmesh_dbt/macros/is_valid_email.sql", """
{% macro is_valid_email(column_name) %}
    {{ column_name }} like '%@%.%'
    and {{ column_name }} not like '% %'
    and length({{ column_name }}) > 5
{% endmacro %}
""")

write("shopmesh_dbt/macros/generate_schema_name.sql", """
{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- set default_schema = target.schema -%}
    {%- if custom_schema_name is none -%}
        {{ default_schema }}
    {%- else -%}
        {{ custom_schema_name | trim }}
    {%- endif -%}
{%- endmacro %}
""")

write("shopmesh_dbt/macros/surrogate_key.sql", """
{% macro surrogate_key(field_list) %}
    md5(cast(concat_ws('-'
        {% for field in field_list %}
            , coalesce(cast({{ field }} as varchar), 'NULL')
        {% endfor %}
    ) as varchar))
{% endmacro %}
""")

write("shopmesh_dbt/macros/union_relations.sql", """
{% macro union_relations(relations) %}
    {% for relation in relations %}
        select * from {{ relation }}
        {% if not loop.last %} union all {% endif %}
    {% endfor %}
{% endmacro %}
""")

write("shopmesh_dbt/macros/not_null_proportion.sql", """
{% macro not_null_proportion(column_name, at_least=0.95) %}
    (sum(case when {{ column_name }} is not null then 1 else 0 end)
     / cast(count(*) as decimal)) >= {{ at_least }}
{% endmacro %}
""")

# ── SEEDS ─────────────────────────────────────────────────────
write("shopmesh_dbt/seeds/currency_rates.csv", """currency_code,rate_to_usd,effective_date
USD,1.00,2024-01-01
EUR,1.08,2024-01-01
GBP,1.27,2024-01-01
CAD,0.74,2024-01-01
AUD,0.65,2024-01-01
JPY,0.0067,2024-01-01
""")

write("shopmesh_dbt/seeds/plan_definitions.csv", """plan_id,plan_name,plan_tier,monthly_price_usd,annual_price_usd,max_seats
plan_starter,Starter,starter,9.99,99.00,1
plan_growth,Growth,growth,29.99,299.00,5
plan_pro,Pro,pro,79.99,799.00,20
plan_enterprise,Enterprise,enterprise,199.99,1999.00,999
""")

write("shopmesh_dbt/seeds/product_categories.csv", """product_type,normalized_category,department
Apparel,clothing,fashion
T-Shirt,clothing,fashion
Electronics,electronics,tech
Gadget,electronics,tech
Home,home_goods,lifestyle
Beauty,beauty,health
Other,other,general
""")

write("shopmesh_dbt/seeds/market_regions.csv", """country_code,country_name,region,currency
US,United States,Americas,USD
GB,United Kingdom,Europe,GBP
DE,Germany,Europe,EUR
FR,France,Europe,EUR
CA,Canada,Americas,CAD
AU,Australia,Oceania,AUD
JP,Japan,Asia,JPY
""")

# ══════════════════════════════════════════════════════════════
# RAW LAYER  (24 models)
# Expose columns from source systems. Zero transformation.
# ══════════════════════════════════════════════════════════════
print("\nRAW layer...")

def raw(name, source_system, source_table, desc, columns, planted=None):
    col_select = "\n".join(
        f"        , {c[0]}  as {c[1]}" for c in columns[1:]
    )
    note = f"-- PLANTED PROBLEM: {planted}\n\n" if planted else ""
    sql = f"""{note}with

source as (

    select * from {{{{ source('{source_system}', '{source_table}') }}}}

)

, final as (

    select
          {columns[0][0]}  as {columns[0][1]}
{col_select}
    from source

)

select * from final
"""
    tests_block = ""
    for c in columns:
        if len(c) > 2:
            tests = "\n".join(f"          - {t}" for t in c[2])
            tests_block += f"""      - name: {c[1]}
        description: "{c[3] if len(c)>3 else ''}"
        tests:
{tests}
"""
        else:
            tests_block += f"""      - name: {c[1]}
        description: "{c[3] if len(c)>3 else ''}"
"""
    yml = f"""version: 2
models:
  - name: {name}
    description: "{desc}"
    config:
      tags: ["raw", "{source_system}"]
    columns:
{tests_block}"""
    write(f"shopmesh_dbt/models/raw/{name}.sql", sql)
    write(f"shopmesh_dbt/models/raw/{name}.yml", yml)

raw("raw_shopify_orders","shopify","orders",
    "Raw Shopify orders. Zero transformation. One row per order.",
    [("id","order_id",["unique","not_null"],"Shopify order PK"),
     ("customer_id","customer_id",[],"FK to customers"),
     ("created_at","created_at",[],"Order creation timestamp"),
     ("updated_at","updated_at",[],"Last update timestamp"),
     ("total_price","total_price",[],"Total as string"),
     ("financial_status","financial_status",[],"paid/pending/refunded"),
     ("fulfillment_status","fulfillment_status",[],"fulfilled/partial/null"),
     ("cancelled_at","cancelled_at",[],"Cancellation timestamp"),
     ("currency","currency",[],"ISO currency code"),
     ("tags","order_tags",[],"Comma-separated tags")])

raw("raw_shopify_order_items","shopify","order_line_items",
    "Raw Shopify order line items.",
    [("id","line_item_id",["unique","not_null"],"Line item PK"),
     ("order_id","order_id",[],"FK to orders"),
     ("product_id","product_id",[],"FK to products"),
     ("variant_id","variant_id",[],"FK to variants"),
     ("quantity","quantity",[],"Units ordered"),
     ("price","price",[],"Unit price string"),
     ("discount_amount","discount_amount",[],"Discount applied"),
     ("sku","sku",[],"SKU code"),
     ("title","product_title",[],"Product title at purchase time")])

raw("raw_shopify_customers","shopify","customers",
    "Raw Shopify customer records.",
    [("id","customer_id",["unique","not_null"],"Customer PK"),
     ("email","email",[],"Email address"),
     ("created_at","created_at",[],"Account creation timestamp"),
     ("total_spent","total_spent",[],"Lifetime spend string"),
     ("orders_count","orders_count",[],"Total orders"),
     ("tags","customer_tags",[],"Shopify tags"),
     ("first_name","first_name",[],"First name"),
     ("last_name","last_name",[],"Last name"),
     ("verified_email","verified_email",[],"Email verified flag")])

raw("raw_shopify_products","shopify","products",
    "Raw Shopify product catalog.",
    [("id","product_id",["unique","not_null"],"Product PK"),
     ("title","title",[],"Product title"),
     ("vendor","vendor",[],"Vendor name"),
     ("product_type","product_type",[],"Product category"),
     ("created_at","created_at",[],"Creation timestamp"),
     ("status","status",[],"active/draft/archived"),
     ("tags","product_tags",[],"Product tags")])

raw("raw_shopify_product_variants","shopify","product_variants",
    "Raw Shopify product variants.",
    [("id","variant_id",["unique","not_null"],"Variant PK"),
     ("product_id","product_id",[],"FK to products"),
     ("sku","sku",[],"SKU"),
     ("price","price",[],"Price string"),
     ("inventory_quantity","inventory_quantity",[],"Stock units"),
     ("option1","option_size",[],"Size variant"),
     ("option2","option_color",[],"Color variant")])

raw("raw_shopify_refunds","shopify","refunds",
    "Raw Shopify refund records.",
    [("id","refund_id",["unique","not_null"],"Refund PK"),
     ("order_id","order_id",[],"FK to orders"),
     ("created_at","created_at",[],"Refund timestamp"),
     ("note","refund_note",[],"Internal note")])

raw("raw_stripe_payments","stripe","payments",
    "Raw Stripe payment intents. Amounts in cents.",
    [("id","payment_id",["unique","not_null"],"Stripe payment PK"),
     ("order_id","order_id",[],"FK to Shopify orders"),
     ("amount","amount_cents",[],"Amount in cents"),
     ("currency","currency",[],"ISO currency"),
     ("status","status",[],"succeeded/failed/pending"),
     ("created_at","created_at",[],"Payment timestamp"),
     ("refunded_amount","refunded_amount_cents",[],"Refunded cents"),
     ("payment_method","payment_method",[],"card/bank/wallet")])

raw("raw_stripe_refunds","stripe","refunds",
    "Raw Stripe refund transactions.",
    [("id","refund_id",["unique","not_null"],"Refund PK"),
     ("payment_id","payment_id",[],"FK to payments"),
     ("amount","amount_cents",[],"Refund cents"),
     ("reason","reason",[],"duplicate/fraudulent/requested_by_customer"),
     ("created_at","created_at",[],"Refund timestamp"),
     ("status","status",[],"succeeded/pending/failed")])

raw("raw_stripe_subscriptions","stripe","subscriptions",
    "Raw Stripe subscription records.",
    [("id","subscription_id",["unique","not_null"],"Subscription PK"),
     ("customer_id","customer_id",[],"Stripe customer ID"),
     ("plan_id","plan_id",[],"FK to plan_definitions"),
     ("status","status",[],"active/cancelled/trialing"),
     ("started_at","started_at",[],"Start timestamp"),
     ("cancelled_at","cancelled_at",[],"Cancellation timestamp"),
     ("monthly_amount","monthly_amount_cents",[],"Monthly charge cents"),
     ("trial_end","trial_ends_at",[],"Trial end timestamp")])

raw("raw_google_ads_campaigns","google_ads","campaigns",
    "Raw Google Ads campaign definitions.",
    [("campaign_id","campaign_id",["unique","not_null"],"Campaign PK"),
     ("campaign_name","campaign_name",[],"Display name"),
     ("status","status",[],"ENABLED/PAUSED/REMOVED"),
     ("daily_budget","daily_budget_cents",[],"Daily budget cents"),
     ("start_date","start_date",[],"Campaign start"),
     ("channel_type","channel_type",[],"SEARCH/DISPLAY/SHOPPING")])

raw("raw_google_ads_performance","google_ads","ad_performance",
    "Raw Google Ads daily performance. Grain: campaign_id + date.",
    [("campaign_id","campaign_id",[],"FK to campaigns"),
     ("date","report_date",[],"Performance date"),
     ("impressions","impressions",[],"Total impressions"),
     ("clicks","clicks",[],"Total clicks"),
     ("cost","cost_cents",[],"Spend in cents"),
     ("conversions","conversions",[],"Tracked conversions")])

raw("raw_salesforce_accounts","salesforce","accounts",
    "Raw Salesforce account (company) records.",
    [("id","account_id",["unique","not_null"],"Account PK"),
     ("name","account_name",[],"Company name"),
     ("industry","industry",[],"Industry"),
     ("annual_revenue","annual_revenue_usd",[],"Self-reported revenue"),
     ("created_at","created_at",[],"Creation timestamp"),
     ("account_type","account_type",[],"Customer/Partner/Prospect")])

raw("raw_salesforce_contacts","salesforce","contacts",
    "Raw Salesforce contact records.",
    [("id","contact_id",["unique","not_null"],"Contact PK"),
     ("account_id","account_id",[],"FK to accounts"),
     ("email","email",[],"Contact email"),
     ("first_name","first_name",[],"First name"),
     ("last_name","last_name",[],"Last name"),
     ("created_at","created_at",[],"Creation timestamp"),
     ("title","job_title",[],"Job title")])

raw("raw_salesforce_opportunities","salesforce","opportunities",
    "Raw Salesforce opportunity pipeline.",
    [("id","opportunity_id",["unique","not_null"],"Opportunity PK"),
     ("account_id","account_id",[],"FK to accounts"),
     ("name","opportunity_name",[],"Opportunity title"),
     ("stage","stage",[],"Pipeline stage"),
     ("amount","amount_usd",[],"Deal value USD"),
     ("close_date","close_date",[],"Expected close date"),
     ("created_at","created_at",[],"Creation timestamp"),
     ("probability","win_probability",[],"Win probability 0-100")])

raw("raw_mobile_events","mobile_app","events",
    "Raw mobile app events. Grain: event_id.",
    [("event_id","event_id",["unique","not_null"],"Event PK"),
     ("user_id","user_id",[],"App user ID"),
     ("event_type","event_type",[],"Event name"),
     ("event_timestamp","event_timestamp",[],"Event timestamp"),
     ("session_id","session_id",[],"Session ID"),
     ("platform","platform",[],"ios/android/web"),
     ("properties","properties_json",[],"Event properties JSON"),
     ("app_version","app_version",[],"App version")])

raw("raw_email_campaigns","email_tool","campaigns",
    "Raw email campaign definitions.",
    [("campaign_id","campaign_id",["unique","not_null"],"Campaign PK"),
     ("campaign_name","campaign_name",[],"Display name"),
     ("subject_line","subject_line",[],"Email subject"),
     ("sent_at","sent_at",[],"Send timestamp"),
     ("campaign_type","campaign_type",[],"promotional/transactional/newsletter"),
     ("total_sent","total_sent",[],"Emails sent")])

raw("raw_email_events","email_tool","events",
    "Raw email engagement events (opens, clicks, bounces).",
    [("event_id","event_id",["unique","not_null"],"Event PK"),
     ("campaign_id","campaign_id",[],"FK to campaigns"),
     ("customer_email","customer_email",[],"Recipient email"),
     ("event_type","event_type",[],"sent/opened/clicked/bounced/unsubscribed"),
     ("event_at","event_at",[],"Event timestamp"),
     ("url_clicked","url_clicked",[],"URL if clicked")])

raw("raw_web_sessions","web_analytics","sessions",
    "Raw web sessions from analytics platform.",
    [("session_id","session_id",["unique","not_null"],"Session PK"),
     ("user_id","user_id",[],"Identified user if logged in"),
     ("anonymous_id","anonymous_id",[],"Anonymous visitor ID"),
     ("started_at","started_at",[],"Session start"),
     ("ended_at","ended_at",[],"Session end"),
     ("source","traffic_source",[],"organic/paid/email/direct"),
     ("medium","traffic_medium",[],"Traffic medium"),
     ("campaign","utm_campaign",[],"UTM campaign"),
     ("device_type","device_type",[],"desktop/mobile/tablet"),
     ("country","country_code",[],"ISO country code"),
     ("pageviews","pageview_count",[],"Pages viewed")])

raw("raw_inventory_snapshots","warehouse_ops","inventory_snapshots",
    "Daily warehouse inventory snapshots.",
    [("snapshot_id","snapshot_id",["unique","not_null"],"Snapshot PK"),
     ("variant_id","variant_id",[],"FK to variants"),
     ("snapshot_date","snapshot_date",[],"Date of snapshot"),
     ("quantity","quantity",[],"Units on hand"),
     ("warehouse_id","warehouse_id",[],"Warehouse ID"),
     ("reorder_point","reorder_point",[],"Reorder threshold"),
     ("on_order","units_on_order",[],"Units in transit")])

# PLANTED: deprecated raw models
raw("raw_erp_products","legacy_erp","products_legacy",
    "DEPRECATED: Legacy ERP products. Source decommissioned 2024-01-01. Use raw_shopify_products.",
    [("prod_id","prod_id",[],"Legacy product ID"),
     ("prod_name","prod_name",[],"Legacy name"),
     ("unit_cost","unit_cost",[],"Unit cost"),
     ("supplier_code","supplier_code",[],"Supplier code"),
     ("last_updated","last_updated",[],"Last updated")],
    planted="DEPRECATED SOURCE — legacy_erp decommissioned 2024-01-01")

raw("raw_erp_warehouses","legacy_erp","warehouses_legacy",
    "DEPRECATED: Legacy ERP warehouses. Source decommissioned 2024-01-01.",
    [("warehouse_id","warehouse_id",[],"Warehouse ID"),
     ("warehouse_name","warehouse_name",[],"Warehouse name"),
     ("location_code","location_code",[],"Location code"),
     ("capacity","capacity",[],"Max capacity")],
    planted="DEPRECATED SOURCE — legacy_erp decommissioned 2024-01-01")

# PLANTED: orphaned raw models
raw("raw_mobile_sessions","mobile_app","sessions",
    "ORPHANED: Mobile session aggregations. Superseded by deriving sessions from raw_mobile_events. No downstream refs.",
    [("session_id","session_id",[],"Session ID"),
     ("user_id","user_id",[],"User ID"),
     ("started_at","started_at",[],"Session start"),
     ("ended_at","ended_at",[],"Session end"),
     ("event_count","event_count",[],"Events in session")],
    planted="ORPHANED — superseded by deriving sessions from raw_mobile_events")

raw("raw_shopify_gift_cards","shopify","gift_cards",
    "ORPHANED: Gift card data. Gift card feature was paused Q3 2023. No downstream models.",
    [("id","gift_card_id",[],"Gift card ID"),
     ("code","code",[],"Redemption code"),
     ("balance","balance",[],"Remaining balance"),
     ("created_at","created_at",[],"Issue timestamp"),
     ("expires_on","expires_on",[],"Expiry date")],
    planted="ORPHANED — gift card feature paused, no downstream refs")


# ══════════════════════════════════════════════════════════════
# SOURCE LAYER  (24 models)
# Light transforms only: rename, cast, clean. Refs raw/ only.
# ══════════════════════════════════════════════════════════════
print("\nSOURCE layer...")

def src(name, ref_model, desc, select_body, columns, planted=None):
    note = f"-- PLANTED PROBLEM: {planted}\n\n" if planted else ""
    sql = f"""{note}with

source as (

    select * from {{{{ ref('{ref_model}') }}}}

)

, final as (

{select_body}

)

select * from final
"""
    col_yml = ""
    for c in columns:
        col_yml += f"      - name: {c[0]}\n        description: \"{c[1]}\"\n"
        if len(c) > 2 and c[2]:
            col_yml += "        tests:\n" + "\n".join(f"          - {t}" for t in c[2]) + "\n"
    yml = f"""version: 2
models:
  - name: {name}
    description: "{desc}"
    config:
      tags: ["source"]
    columns:
{col_yml}"""
    write(f"shopmesh_dbt/models/source/{name}.sql", sql)
    write(f"shopmesh_dbt/models/source/{name}.yml", yml)

src("src_shopify_orders","raw_shopify_orders",
    "Shopify orders with typed amounts and is_cancelled flag.",
    """\
    select
          order_id
        , customer_id
        , cast(created_at as timestamp)              as order_created_at
        , cast(updated_at as timestamp)              as order_updated_at
        , cast(total_price as decimal(12, 2))        as order_total_amount
        , financial_status
        , fulfillment_status
        , cast(cancelled_at as timestamp)            as cancelled_at
        , currency
        , order_tags
        , case
            when cancelled_at is not null then true
            else false
          end                                        as is_cancelled
    from source""",
    [("order_id","Shopify order PK",["unique","not_null"]),
     ("customer_id","FK to src_shopify_customers",["not_null"]),
     ("order_created_at","Typed timestamp",["not_null"]),
     ("order_total_amount","Typed decimal",["not_null"]),
     ("financial_status","paid/pending/refunded",[]),
     ("is_cancelled","Boolean cancellation flag",[])])

src("src_shopify_order_items","raw_shopify_order_items",
    "Order line items with typed quantities and computed gross amount.",
    """\
    select
          line_item_id
        , order_id
        , product_id
        , variant_id
        , sku
        , cast(quantity as integer)                  as quantity
        , cast(price as decimal(12, 2))              as unit_price
        , cast(discount_amount as decimal(12, 2))    as discount_amount
        , product_title
        , cast(price as decimal(12, 2))
          * cast(quantity as integer)                as gross_line_amount
    from source""",
    [("line_item_id","Line item PK",["unique","not_null"]),
     ("order_id","FK to src_shopify_orders",[]),
     ("quantity","Typed integer",[]),
     ("unit_price","Typed decimal",[]),
     ("gross_line_amount","unit_price * quantity",[])])

src("src_shopify_customers","raw_shopify_customers",
    "Shopify customers with typed fields and derived full name.",
    """\
    select
          customer_id
        , email                                      as customer_email
        , first_name
        , last_name
        , trim(first_name || ' ' || last_name)       as full_name
        , cast(created_at as timestamp)              as customer_created_at
        , cast(total_spent as decimal(12, 2))        as lifetime_spend_shopify
        , cast(orders_count as integer)              as shopify_order_count
        , customer_tags
        , cast(verified_email as boolean)            as is_email_verified
    from source""",
    [("customer_id","Customer PK",["unique","not_null"]),
     ("customer_email","Email address",["not_null"]),
     ("lifetime_spend_shopify","Typed LTS",[]),
     ("is_email_verified","Boolean email verification",[])])

src("src_shopify_products","raw_shopify_products",
    "Shopify products with typed dates.",
    """\
    select
          product_id
        , title                                      as product_name
        , vendor                                     as product_vendor
        , product_type
        , cast(created_at as timestamp)              as product_created_at
        , status                                     as product_status
        , product_tags
    from source""",
    [("product_id","Product PK",["unique","not_null"]),
     ("product_name","Cleaned product name",[]),
     ("product_status","active/draft/archived",[])])

src("src_shopify_product_variants","raw_shopify_product_variants",
    "Product variants with typed price and inventory.",
    """\
    select
          variant_id
        , product_id
        , sku
        , cast(price as decimal(12, 2))              as variant_price
        , cast(inventory_quantity as integer)        as inventory_quantity
        , option_size
        , option_color
    from source""",
    [("variant_id","Variant PK",["unique","not_null"]),
     ("variant_price","Typed decimal price",[]),
     ("inventory_quantity","Typed integer stock",[])])

src("src_shopify_refunds","raw_shopify_refunds",
    "Shopify refunds with typed timestamps.",
    """\
    select
          refund_id
        , order_id
        , cast(created_at as timestamp)              as refunded_at
        , refund_note
    from source""",
    [("refund_id","Refund PK",["unique","not_null"]),
     ("order_id","FK to src_shopify_orders",[]),
     ("refunded_at","Typed timestamp",[])])

src("src_stripe_payments","raw_stripe_payments",
    "Stripe payments with amounts converted from cents to dollars.",
    """\
    select
          payment_id
        , order_id
        , {{ cents_to_dollars('amount_cents') }}         as payment_amount
        , currency
        , status                                         as payment_status
        , cast(created_at as timestamp)                  as payment_created_at
        , {{ cents_to_dollars('refunded_amount_cents') }} as refunded_amount
        , {{ cents_to_dollars('amount_cents') }}
          - {{ cents_to_dollars('refunded_amount_cents') }} as net_payment_amount
        , payment_method
    from source""",
    [("payment_id","Stripe payment PK",["unique","not_null"]),
     ("payment_amount","Amount in USD",[]),
     ("refunded_amount","Refunded in USD",[]),
     ("net_payment_amount","payment_amount - refunded_amount",[])])

src("src_stripe_refunds","raw_stripe_refunds",
    "Stripe refund transactions with amounts in dollars.",
    """\
    select
          refund_id
        , payment_id
        , {{ cents_to_dollars('amount_cents') }}     as refund_amount
        , reason                                     as refund_reason
        , cast(created_at as timestamp)              as refunded_at
        , status                                     as refund_status
    from source""",
    [("refund_id","Refund PK",["unique","not_null"]),
     ("refund_amount","Refund in USD",[]),
     ("refund_reason","duplicate/fraudulent/requested_by_customer",[])])

src("src_stripe_subscriptions","raw_stripe_subscriptions",
    "Stripe subscriptions with amounts in dollars and typed timestamps.",
    """\
    select
          subscription_id
        , customer_id
        , plan_id
        , status                                     as subscription_status
        , cast(started_at as timestamp)              as subscription_started_at
        , cast(cancelled_at as timestamp)            as subscription_cancelled_at
        , {{ cents_to_dollars('monthly_amount_cents') }} as monthly_amount
        , cast(trial_ends_at as timestamp)           as trial_ends_at
        , case when status = 'active' then true else false end as is_active
    from source""",
    [("subscription_id","Subscription PK",["unique","not_null"]),
     ("subscription_status","active/cancelled/trialing",[]),
     ("monthly_amount","Monthly charge USD",[]),
     ("is_active","Boolean active flag",[])])

src("src_google_ads_campaigns","raw_google_ads_campaigns",
    "Google Ads campaigns with budget in dollars.",
    """\
    select
          campaign_id
        , campaign_name
        , status                                         as campaign_status
        , {{ cents_to_dollars('daily_budget_cents') }}   as daily_budget
        , cast(start_date as date)                       as campaign_start_date
        , channel_type
    from source""",
    [("campaign_id","Campaign PK",["unique","not_null"]),
     ("campaign_status","ENABLED/PAUSED/REMOVED",[]),
     ("daily_budget","Daily budget USD",[])])

src("src_google_ads_performance","raw_google_ads_performance",
    "Google Ads daily performance with CTR derived. Grain: campaign_id + date.",
    """\
    select
          campaign_id
        , cast(report_date as date)                  as performance_date
        , cast(impressions as integer)               as impressions
        , cast(clicks as integer)                    as clicks
        , {{ cents_to_dollars('cost_cents') }}       as ad_spend
        , cast(conversions as integer)               as conversions
        , {{ safe_divide('cast(clicks as decimal)','cast(impressions as decimal)') }} as click_through_rate
    from source""",
    [("campaign_id","FK to campaigns",[]),
     ("performance_date","Report date",["not_null"]),
     ("ad_spend","Spend in USD",[]),
     ("click_through_rate","clicks / impressions via safe_divide",[])])

src("src_salesforce_accounts","raw_salesforce_accounts",
    "Salesforce accounts with typed revenue.",
    """\
    select
          account_id
        , account_name
        , industry
        , cast(annual_revenue_usd as decimal(15, 2)) as annual_revenue
        , cast(created_at as timestamp)              as account_created_at
        , account_type
    from source""",
    [("account_id","Salesforce account PK",["unique","not_null"]),
     ("account_name","Company name",[]),
     ("account_type","Customer/Partner/Prospect",[])])

src("src_salesforce_contacts","raw_salesforce_contacts",
    "Salesforce contacts with derived full name.",
    """\
    select
          contact_id
        , account_id
        , email                                      as contact_email
        , first_name
        , last_name
        , trim(first_name || ' ' || last_name)       as full_name
        , cast(created_at as timestamp)              as contact_created_at
        , job_title
    from source""",
    [("contact_id","Contact PK",["unique","not_null"]),
     ("contact_email","Contact email",[]),
     ("full_name","first_name || last_name",[])])

src("src_salesforce_opportunities","raw_salesforce_opportunities",
    "Salesforce pipeline opportunities with typed fields.",
    """\
    select
          opportunity_id
        , account_id
        , opportunity_name
        , stage
        , cast(amount_usd as decimal(15, 2))         as opportunity_value
        , cast(close_date as date)                   as expected_close_date
        , cast(created_at as timestamp)              as opportunity_created_at
        , cast(win_probability as integer)           as win_probability
    from source""",
    [("opportunity_id","Opportunity PK",["unique","not_null"]),
     ("stage","Pipeline stage",[]),
     ("opportunity_value","Deal value USD",[])])

src("src_mobile_events","raw_mobile_events",
    "Mobile events with typed timestamps. Grain: event_id.",
    """\
    select
          event_id
        , user_id
        , event_type
        , cast(event_timestamp as timestamp)         as event_at
        , session_id
        , platform
        , properties_json
        , app_version
    from source""",
    [("event_id","Event PK",["unique","not_null"]),
     ("event_type","Event name",[]),
     ("platform","ios/android/web",[]),
     ("event_at","Typed timestamp",["not_null"])])

src("src_email_campaigns","raw_email_campaigns",
    "Email campaigns with typed timestamps.",
    """\
    select
          campaign_id
        , campaign_name
        , subject_line
        , cast(sent_at as timestamp)                 as sent_at
        , campaign_type
        , cast(total_sent as integer)                as total_sent
    from source""",
    [("campaign_id","Campaign PK",["unique","not_null"]),
     ("campaign_type","promotional/transactional/newsletter",[]),
     ("total_sent","Typed integer send count",[])])

src("src_email_events","raw_email_events",
    "Email engagement events with typed timestamps.",
    """\
    select
          event_id
        , campaign_id
        , customer_email
        , event_type
        , cast(event_at as timestamp)                as event_at
        , url_clicked
    from source""",
    [("event_id","Event PK",["unique","not_null"]),
     ("event_type","sent/opened/clicked/bounced/unsubscribed",[])])

src("src_web_sessions","raw_web_sessions",
    "Web sessions with typed timestamps and derived duration.",
    """\
    select
          session_id
        , user_id
        , anonymous_id
        , cast(started_at as timestamp)              as session_started_at
        , cast(ended_at as timestamp)                as session_ended_at
        , traffic_source
        , traffic_medium
        , utm_campaign
        , device_type
        , country_code
        , cast(pageview_count as integer)            as pageview_count
        , datediff('second',
              cast(started_at as timestamp),
              cast(ended_at as timestamp))           as session_duration_seconds
    from source""",
    [("session_id","Session PK",["unique","not_null"]),
     ("traffic_source","organic/paid/email/direct",[]),
     ("session_duration_seconds","Derived session length",[])])

src("src_inventory_snapshots","raw_inventory_snapshots",
    "Daily inventory snapshots with typed quantities.",
    """\
    select
          snapshot_id
        , variant_id
        , cast(snapshot_date as date)                as snapshot_date
        , cast(quantity as integer)                  as quantity_on_hand
        , warehouse_id
        , cast(reorder_point as integer)             as reorder_point
        , cast(units_on_order as integer)            as units_on_order
    from source""",
    [("snapshot_id","Snapshot PK",["unique","not_null"]),
     ("snapshot_date","Inventory date",[]),
     ("quantity_on_hand","Typed integer units",[])])

src("src_subscription_events","src_stripe_subscriptions",
    "Subscription lifecycle events derived from stripe subscriptions.",
    """\
    select
          subscription_id
        , customer_id
        , 'subscription_started'                     as event_type
        , subscription_started_at                    as event_at
        , monthly_amount
    from source

    union all

    select
          subscription_id
        , customer_id
        , 'subscription_cancelled'                   as event_type
        , subscription_cancelled_at                  as event_at
        , monthly_amount
    from source
    where subscription_cancelled_at is not null""",
    [("subscription_id","Subscription reference",[]),
     ("event_type","subscription_started/subscription_cancelled",[]),
     ("event_at","Event timestamp",[])])

# PLANTED: deprecated source
src("src_erp_products","raw_erp_products",
    "DEPRECATED: Light transform of deprecated ERP product data. Do not use — legacy_erp decommissioned 2024-01-01.",
    """\
    select
          prod_id                                    as legacy_product_id
        , prod_name                                  as legacy_product_name
        , cast(unit_cost as decimal(12, 2))          as unit_cost
        , supplier_code
        , cast(last_updated as timestamp)            as last_updated_at
    from source""",
    [("legacy_product_id","DEPRECATED: ERP product ID",[]),
     ("legacy_product_name","DEPRECATED: ERP name",[])],
    planted="DEPRECATED SOURCE — legacy_erp decommissioned 2024-01-01")

src("src_erp_warehouses","raw_erp_warehouses",
    "DEPRECATED: Light transform of deprecated ERP warehouse data.",
    """\
    select
          warehouse_id
        , warehouse_name
        , location_code
        , cast(capacity as integer)                  as warehouse_capacity
    from source""",
    [("warehouse_id","DEPRECATED: Legacy warehouse ID",[])],
    planted="DEPRECATED SOURCE — legacy_erp decommissioned 2024-01-01")

# PLANTED: duplicate with different column names
src("src_orders_v2","raw_shopify_orders",
    "DUPLICATE: Near-identical to src_shopify_orders with different column names. ordered_at vs order_created_at causes downstream confusion. Never resolved.",
    """\
    select
          order_id
        , customer_id
        , cast(created_at as timestamp)              as ordered_at
        , cast(total_price as decimal(12, 2))        as order_value
        , financial_status
        , fulfillment_status
    from source
    where financial_status != 'voided'""",
    [("order_id","Order PK",[]),
     ("ordered_at","DIFFERENT NAME from src_shopify_orders.order_created_at",[]),
     ("order_value","DIFFERENT NAME from src_shopify_orders.order_total_amount",[])],
    planted="DUPLICATE of src_shopify_orders — different column names cause logic drift")

# PLANTED: broken lineage
src("src_shopify_gift_cards_v2","raw_shopify_gift_cards",
    "BROKEN LINEAGE: Refs raw_shopify_gift_cards which refs shopify.gift_cards source that was never configured.",
    """\
    select
          gift_card_id
        , code
        , cast(balance as decimal(12, 2))            as balance_amount
        , cast(created_at as timestamp)              as issued_at
        , cast(expires_on as date)                   as expires_on
    from source""",
    [("gift_card_id","BROKEN: upstream source missing",[]),
     ("balance_amount","Remaining balance USD",[])],
    planted="BROKEN LINEAGE — raw_shopify_gift_cards refs non-existent shopify.gift_cards source")





# ══════════════════════════════════════════════════════════════
# CORE LAYER  (25 models)
# All business logic, calculations, joins. Refs source/ only.
# ══════════════════════════════════════════════════════════════
print("\nCORE layer...")

def core(name, desc, sql, columns, planted=None):
    note = f"-- PLANTED PROBLEM: {planted}\n\n" if planted else ""
    col_yml = ""
    for c in columns:
        col_yml += f"      - name: {c[0]}\n        description: \"{c[1]}\"\n"
        if len(c) > 2 and c[2]:
            col_yml += "        tests:\n" + "\n".join(f"          - {t}" for t in c[2]) + "\n"
    yml = f"""version: 2
models:
  - name: {name}
    description: "{desc}"
    config:
      tags: ["core"]
    columns:
{col_yml}"""
    write(f"shopmesh_dbt/models/core/{name}.sql", note + sql)
    write(f"shopmesh_dbt/models/core/{name}.yml", yml)

core("core_orders",
"Enriched orders joined with payments and item aggregates. Grain: one row per order.",
"""\
with

orders as (

    select * from {{ ref('src_shopify_orders') }}

)

, payments as (

    select * from {{ ref('src_stripe_payments') }}

)

, items_agg as (

    select
          order_id
        , sum(gross_line_amount)                     as total_items_gross
        , sum(discount_amount)                       as total_discount_amount
        , count(*)                                   as line_item_count
    from {{ ref('src_shopify_order_items') }}
    group by order_id

)

, final as (

    select
          o.order_id
        , o.customer_id
        , o.order_created_at
        , cast(o.order_created_at as date)           as order_date
        , date_trunc('week',  o.order_created_at)    as order_week
        , date_trunc('month', o.order_created_at)    as order_month
        , o.order_total_amount
        , o.financial_status
        , o.fulfillment_status
        , o.is_cancelled
        , o.currency
        , p.payment_id
        , p.payment_amount
        , p.net_payment_amount
        , p.refunded_amount
        , p.payment_method
        , i.total_items_gross
        , i.total_discount_amount
        , i.line_item_count
    from orders         as o
    left join payments  as p on o.order_id = p.order_id
    left join items_agg as i on o.order_id = i.order_id

)

select * from final
""",
[("order_id","Order PK",["unique","not_null"]),
 ("customer_id","FK to core_customers",["not_null"]),
 ("order_total_amount","Total value USD",["not_null"]),
 ("net_payment_amount","payment_amount - refunded_amount",[]),
 ("is_cancelled","Boolean cancellation flag",[]),
 ("order_date","Truncated to day",[]),
 ("order_month","Truncated to month",[])])

core("core_customers",
"Customer master with LTV, segmentation and subscription value. Grain: one row per customer.",
"""\
with

customers as (

    select * from {{ ref('src_shopify_customers') }}

)

, order_summary as (

    select
          customer_id
        , count(*)                                   as total_orders
        , count(case when not is_cancelled then 1 end) as completed_orders
        , sum(order_total_amount)                    as gross_revenue
        , sum(net_payment_amount)                    as net_revenue
        , sum(refunded_amount)                       as total_refunded
        , min(order_created_at)                      as first_order_at
        , max(order_created_at)                      as last_order_at
        , avg(order_total_amount)                    as avg_order_value
    from {{ ref('core_orders') }}
    group by customer_id

)

, subscriptions as (

    select
          customer_id
        , sum(monthly_amount) * 12                   as annual_subscription_value
    from {{ ref('src_stripe_subscriptions') }}
    where is_active = true
    group by customer_id

)

, final as (

    select
          c.customer_id
        , c.customer_email
        , c.full_name
        , c.customer_created_at
        , c.customer_tags
        , c.is_email_verified
        , coalesce(o.total_orders, 0)                as total_orders
        , coalesce(o.completed_orders, 0)            as completed_orders
        , coalesce(o.gross_revenue, 0)               as gross_revenue
        , coalesce(o.net_revenue, 0)                 as net_revenue
        , coalesce(o.total_refunded, 0)              as total_refunded
        , o.first_order_at
        , o.last_order_at
        , o.avg_order_value
        , datediff('day', o.first_order_at, o.last_order_at) as customer_lifespan_days
        , datediff('day', o.last_order_at, current_date)     as days_since_last_order
        , coalesce(s.annual_subscription_value, 0)   as annual_subscription_value
        , coalesce(o.net_revenue, 0)
          + coalesce(s.annual_subscription_value, 0) as estimated_ltv
        , case
            when coalesce(o.net_revenue, 0) > 5000   then 'platinum'
            when coalesce(o.net_revenue, 0) > 1000   then 'gold'
            when coalesce(o.net_revenue, 0) > 200    then 'silver'
            else 'bronze'
          end                                        as ltv_tier
        , case
            when coalesce(o.total_orders, 0) >= 10   then 'high_frequency'
            when coalesce(o.total_orders, 0) >= 3    then 'repeat'
            else 'one_time'
          end                                        as order_frequency_segment
    from customers           as c
    left join order_summary  as o on c.customer_id = o.customer_id
    left join subscriptions  as s on c.customer_id = s.customer_id

)

select * from final
""",
[("customer_id","Customer PK",["unique","not_null"]),
 ("customer_email","Customer email",[]),
 ("estimated_ltv","net_revenue + annual_subscription_value",[]),
 ("ltv_tier","platinum/gold/silver/bronze",[]),
 ("days_since_last_order","Recency metric",[])])

core("core_products",
"Product performance enriched with inventory. Grain: one row per product.",
"""\
with

products as (

    select * from {{ ref('src_shopify_products') }}

)

, sales as (

    select
          product_id
        , count(distinct order_id)                   as orders_with_product
        , sum(quantity)                              as total_units_sold
        , sum(gross_line_amount)                     as gross_product_revenue
        , sum(discount_amount)                       as total_discounts
        , avg(unit_price)                            as avg_selling_price
    from {{ ref('src_shopify_order_items') }}
    group by product_id

)

, inventory as (

    select
          product_id
        , sum(inventory_quantity)                    as total_inventory
        , count(*)                                   as variant_count
    from {{ ref('src_shopify_product_variants') }}
    group by product_id

)

, final as (

    select
          p.product_id
        , p.product_name
        , p.product_vendor
        , p.product_type
        , p.product_status
        , coalesce(s.orders_with_product, 0)         as orders_with_product
        , coalesce(s.total_units_sold, 0)            as total_units_sold
        , coalesce(s.gross_product_revenue, 0)       as gross_product_revenue
        , coalesce(s.total_discounts, 0)             as total_discounts_given
        , s.avg_selling_price
        , coalesce(i.total_inventory, 0)             as total_inventory_quantity
        , coalesce(i.variant_count, 0)               as variant_count
        , case
            when coalesce(i.total_inventory, 0) = 0  then 'out_of_stock'
            when coalesce(i.total_inventory, 0) < 10 then 'low_stock'
            when coalesce(i.total_inventory, 0) > 500 then 'overstock'
            else 'healthy'
          end                                        as stock_status
    from products           as p
    left join sales         as s on p.product_id = s.product_id
    left join inventory     as i on p.product_id = i.product_id

)

select * from final
""",
[("product_id","Product PK",["unique","not_null"]),
 ("gross_product_revenue","Total gross sales revenue",[]),
 ("stock_status","out_of_stock/low_stock/healthy/overstock",[])])

core("core_subscriptions",
"Subscriptions enriched with plan details and customer LTV tier.",
"""\
with

subs as (

    select * from {{ ref('src_stripe_subscriptions') }}

)

, customers as (

    select customer_id, customer_email, ltv_tier
    from {{ ref('core_customers') }}

)

, plans as (

    select * from {{ ref('plan_definitions') }}

)

, final as (

    select
          s.subscription_id
        , s.customer_id
        , c.customer_email
        , c.ltv_tier                                 as customer_ltv_tier
        , s.plan_id
        , p.plan_name
        , p.plan_tier
        , s.subscription_status
        , s.subscription_started_at
        , s.subscription_cancelled_at
        , s.is_active
        , s.monthly_amount
        , s.monthly_amount * 12                      as annual_amount
        , datediff('day', s.subscription_started_at,
              coalesce(s.subscription_cancelled_at, current_date)) as subscription_age_days
    from subs           as s
    left join customers as c on s.customer_id = c.customer_id
    left join plans     as p on s.plan_id = p.plan_id

)

select * from final
""",
[("subscription_id","Subscription PK",["unique","not_null"]),
 ("subscription_status","active/cancelled/trialing",[]),
 ("monthly_amount","Monthly charge USD",[]),
 ("subscription_age_days","Days since start",[])])

core("core_revenue_daily",
"Daily order revenue aggregation. Grain: DAILY — one row per calendar day.",
"""\
with

orders as (

    select * from {{ ref('core_orders') }}

)

, final as (

    select
          order_date                                 as revenue_date
        , count(*)                                   as total_orders
        , count(case when not is_cancelled then 1 end) as completed_orders
        , sum(order_total_amount)                    as gross_revenue
        , sum(net_payment_amount)                    as net_revenue
        , sum(refunded_amount)                       as refund_amount
        , avg(order_total_amount)                    as avg_order_value
        , count(distinct customer_id)                as unique_customers
    from orders
    group by order_date

)

select * from final
""",
[("revenue_date","DAILY grain — one row per calendar day",["unique","not_null"]),
 ("gross_revenue","Sum of order_total_amount",[]),
 ("net_revenue","Sum of net_payment_amount",[]),
 ("completed_orders","Orders not cancelled",[])])

core("core_revenue_monthly",
"Monthly subscription MRR aggregation. Grain: MONTHLY — one row per month.",
"""\
with

subs as (

    select * from {{ ref('src_stripe_subscriptions') }}

)

, final as (

    select
          date_trunc('month', subscription_started_at) as revenue_month
        , count(*)                                      as active_subscriptions
        , sum(monthly_amount)                           as monthly_recurring_revenue
        , avg(monthly_amount)                           as avg_subscription_value
    from subs
    where is_active = true
    group by date_trunc('month', subscription_started_at)

)

select * from final
""",
[("revenue_month","MONTHLY grain — one row per month",["unique","not_null"]),
 ("monthly_recurring_revenue","Total MRR for active subscriptions",[])])

# PLANTED: wrong grain join
core("core_revenue_combined",
"PLANTED — Joins DAILY (core_revenue_daily) to MONTHLY (core_revenue_monthly). Wrong grain causes subscription_revenue to be inflated ~30x.",
"""\
with

daily as (

    select * from {{ ref('core_revenue_daily') }}

)

, monthly_subs as (

    select * from {{ ref('core_revenue_monthly') }}

)

-- PLANTED PROBLEM: WRONG GRAIN JOIN
-- core_revenue_daily  = DAILY grain
-- core_revenue_monthly = MONTHLY grain
-- Every daily row gets the full monthly MRR, inflating it ~30x
, final as (

    select
          d.revenue_date
        , d.gross_revenue                            as order_revenue
        , d.net_revenue                              as net_order_revenue
        , m.monthly_recurring_revenue                as subscription_revenue
        , d.gross_revenue
          + m.monthly_recurring_revenue              as total_revenue
    from daily             as d
    left join monthly_subs as m
        on date_trunc('month', d.revenue_date) = m.revenue_month

)

select * from final
""",
[("revenue_date","Daily grain date",[]),
 ("subscription_revenue","INFLATED: full month MRR applied to each day",[]),
 ("total_revenue","WRONG: order + inflated subscription revenue",[])],
planted="WRONG GRAIN JOIN — DAILY x MONTHLY causes ~30x inflation of subscription_revenue")

core("core_refunds",
"Refunds enriched with original order context.",
"""\
with

refunds as (

    select * from {{ ref('src_stripe_refunds') }}

)

, payments as (

    select * from {{ ref('src_stripe_payments') }}

)

, orders as (

    select order_id, customer_id, order_created_at, order_total_amount
    from {{ ref('core_orders') }}

)

, final as (

    select
          r.refund_id
        , r.payment_id
        , p.order_id
        , o.customer_id
        , r.refund_amount
        , r.refund_reason
        , r.refunded_at
        , o.order_created_at
        , o.order_total_amount                       as original_order_amount
        , datediff('day', o.order_created_at, r.refunded_at) as days_to_refund
        , {{ safe_divide('r.refund_amount','o.order_total_amount') }} as refund_rate
        , case
            when datediff('day', o.order_created_at, r.refunded_at) <= 7  then 'immediate'
            when datediff('day', o.order_created_at, r.refunded_at) <= 30 then 'standard'
            else 'late'
          end                                        as refund_timing
    from refunds        as r
    left join payments  as p on r.payment_id = p.payment_id
    left join orders    as o on p.order_id = o.order_id

)

select * from final
""",
[("refund_id","Refund PK",["unique","not_null"]),
 ("refund_amount","Refund value USD",[]),
 ("days_to_refund","Days between order and refund",[]),
 ("refund_timing","immediate/standard/late",[])])

core("core_new_vs_returning",
"Classifies each order as new or returning customer purchase.",
"""\
with

orders as (

    select * from {{ ref('src_shopify_orders') }}

)

, first_orders as (

    select
          customer_id
        , min(order_created_at)                      as first_order_at
    from orders
    group by customer_id

)

, final as (

    select
          o.order_id
        , o.customer_id
        , o.order_created_at
        , o.order_total_amount
        , case
            when o.order_created_at = fo.first_order_at then 'new'
            else 'returning'
          end                                        as customer_type
    from orders            as o
    left join first_orders as fo on o.customer_id = fo.customer_id

)

select * from final
""",
[("order_id","Order PK",["unique","not_null"]),
 ("customer_type","new (first ever order) / returning",[])])

core("core_cohort_retention",
"Customer cohort retention. Grain: cohort_month + months_since_cohort.",
"""\
with

cohort_base as (

    select
          customer_id
        , date_trunc('month', first_order_at)        as cohort_month
    from {{ ref('core_customers') }}
    where first_order_at is not null

)

, orders as (

    select customer_id, order_created_at, order_total_amount
    from {{ ref('core_orders') }}
    where not is_cancelled

)

, cohort_orders as (

    select
          cb.cohort_month
        , cb.customer_id
        , datediff('month', cb.cohort_month,
              date_trunc('month', o.order_created_at)) as months_since_cohort
        , o.order_total_amount
    from cohort_base    as cb
    left join orders    as o on cb.customer_id = o.customer_id

)

, final as (

    select
          cohort_month
        , months_since_cohort
        , count(distinct customer_id)                as active_customers
        , sum(order_total_amount)                    as cohort_revenue
    from cohort_orders
    group by cohort_month, months_since_cohort

)

select * from final
""",
[("cohort_month","Customer cohort (month of first order)",[]),
 ("months_since_cohort","0=acquisition month",[]),
 ("active_customers","Customers who purchased in period",[])])

core("core_ad_performance",
"Google Ads performance enriched with campaign metadata.",
"""\
with

performance as (

    select * from {{ ref('src_google_ads_performance') }}

)

, campaigns as (

    select * from {{ ref('src_google_ads_campaigns') }}

)

, final as (

    select
          p.campaign_id
        , p.performance_date
        , c.campaign_name
        , c.campaign_status
        , c.channel_type
        , p.impressions
        , p.clicks
        , p.ad_spend
        , p.conversions
        , p.click_through_rate
        , {{ safe_divide('p.ad_spend','p.clicks') }}        as cost_per_click
        , {{ safe_divide('p.ad_spend','p.conversions') }}   as cost_per_conversion
    from performance    as p
    left join campaigns as c on p.campaign_id = c.campaign_id

)

select * from final
""",
[("campaign_id","FK to campaigns",[]),
 ("performance_date","Report date",[]),
 ("ad_spend","Daily spend USD",[]),
 ("cost_per_click","ad_spend / clicks via safe_divide",[]),
 ("cost_per_conversion","ad_spend / conversions",[])])

core("core_customer_segments",
"Customer segmentation based on RFM signals.",
"""\
with

customers as (

    select * from {{ ref('core_customers') }}

)

, final as (

    select
          customer_id
        , ltv_tier
        , order_frequency_segment
        , estimated_ltv
        , days_since_last_order
        , case
            when days_since_last_order <= 30     then 'active'
            when days_since_last_order <= 90     then 'at_risk'
            when days_since_last_order <= 180    then 'churning'
            else 'churned'
          end                                        as churn_status
        , case
            when estimated_ltv > 10000           then 'enterprise'
            when estimated_ltv > 2000            then 'mid_market'
            else 'smb'
          end                                        as account_size
    from customers

)

select * from final
""",
[("customer_id","Customer PK",["unique","not_null"]),
 ("ltv_tier","platinum/gold/silver/bronze",[]),
 ("churn_status","active/at_risk/churning/churned",[]),
 ("account_size","enterprise/mid_market/smb",[])])

core("core_inventory_status",
"Current inventory per variant with health classification.",
"""\
with

latest as (

    select
          variant_id
        , quantity_on_hand
        , snapshot_date
        , reorder_point
        , units_on_order
    from {{ ref('src_inventory_snapshots') }}
    qualify row_number() over (
        partition by variant_id
        order by snapshot_date desc
    ) = 1

)

, variants as (

    select * from {{ ref('src_shopify_product_variants') }}

)

, products as (

    select * from {{ ref('src_shopify_products') }}

)

, final as (

    select
          v.variant_id
        , v.product_id
        , p.product_name
        , p.product_vendor
        , v.sku
        , v.variant_price
        , v.option_size
        , v.option_color
        , l.quantity_on_hand
        , l.reorder_point
        , l.units_on_order
        , l.snapshot_date                            as inventory_as_of
        , v.variant_price * l.quantity_on_hand       as inventory_value
        , case
            when l.quantity_on_hand = 0              then 'out_of_stock'
            when l.quantity_on_hand < l.reorder_point then 'below_reorder'
            when l.quantity_on_hand > 500            then 'overstock'
            else 'healthy'
          end                                        as stock_status
    from variants       as v
    left join products  as p on v.product_id = p.product_id
    left join latest    as l on v.variant_id = l.variant_id

)

select * from final
""",
[("variant_id","Variant PK",["unique","not_null"]),
 ("quantity_on_hand","Current stock level",[]),
 ("stock_status","out_of_stock/below_reorder/healthy/overstock",[]),
 ("inventory_value","variant_price * quantity_on_hand",[])])

core("core_b2b_accounts",
"B2B revenue — joins Salesforce accounts to Shopify revenue via email matching.",
"""\
with

sf_accounts as (

    select * from {{ ref('src_salesforce_accounts') }}

)

, sf_contacts as (

    select * from {{ ref('src_salesforce_contacts') }}

)

, customers as (

    select * from {{ ref('core_customers') }}

)

, matched as (

    select
          sa.account_id
        , sa.account_name
        , sa.industry
        , sa.annual_revenue
        , sa.account_type
        , cust.customer_id
        , cust.gross_revenue
        , cust.net_revenue
        , cust.total_orders
    from sf_contacts            as sc
    left join sf_accounts       as sa   on sc.account_id = sa.account_id
    left join customers         as cust on sc.contact_email = cust.customer_email

)

, final as (

    select
          account_id
        , account_name
        , industry
        , annual_revenue
        , account_type
        , sum(gross_revenue)                         as total_shopmesh_revenue
        , sum(net_revenue)                           as total_net_revenue
        , sum(total_orders)                          as total_orders
        , count(distinct customer_id)                as purchasing_contacts
        , {{ safe_divide('sum(gross_revenue)','max(annual_revenue)') }} as wallet_share
    from matched
    group by account_id, account_name, industry, annual_revenue, account_type

)

select * from final
""",
[("account_id","Salesforce account PK",["unique","not_null"]),
 ("total_shopmesh_revenue","Sum of Shopify revenue",[]),
 ("wallet_share","shopmesh revenue / annual_revenue",[])])

core("core_email_performance",
"Email campaign performance — open rate, click rate, unsubscribe rate.",
"""\
with

campaigns as (

    select * from {{ ref('src_email_campaigns') }}

)

, event_agg as (

    select
          campaign_id
        , count(case when event_type = 'opened'       then 1 end) as opens
        , count(case when event_type = 'clicked'      then 1 end) as clicks
        , count(case when event_type = 'bounced'      then 1 end) as bounces
        , count(case when event_type = 'unsubscribed' then 1 end) as unsubscribes
    from {{ ref('src_email_events') }}
    group by campaign_id

)

, final as (

    select
          c.campaign_id
        , c.campaign_name
        , c.campaign_type
        , c.sent_at
        , c.total_sent
        , ea.opens
        , ea.clicks
        , ea.bounces
        , ea.unsubscribes
        , {{ safe_divide('ea.opens','c.total_sent') }}        as open_rate
        , {{ safe_divide('ea.clicks','ea.opens') }}           as click_to_open_rate
        , {{ safe_divide('ea.unsubscribes','c.total_sent') }} as unsubscribe_rate
    from campaigns      as c
    left join event_agg as ea on c.campaign_id = ea.campaign_id

)

select * from final
""",
[("campaign_id","Campaign PK",["unique","not_null"]),
 ("open_rate","opens / total_sent",[]),
 ("click_to_open_rate","clicks / opens",[]),
 ("unsubscribe_rate","unsubscribes / total_sent",[])])

core("core_web_engagement",
"Web session engagement by source, device, and date.",
"""\
with

sessions as (

    select * from {{ ref('src_web_sessions') }}

)

, final as (

    select
          cast(session_started_at as date)           as session_date
        , traffic_source
        , traffic_medium
        , device_type
        , country_code
        , count(*)                                   as session_count
        , count(distinct coalesce(user_id, anonymous_id)) as unique_visitors
        , avg(session_duration_seconds)              as avg_session_duration
        , avg(pageview_count)                        as avg_pageviews
        , count(case when session_duration_seconds > 60 then 1 end) as engaged_sessions
    from sessions
    group by cast(session_started_at as date), traffic_source, traffic_medium, device_type, country_code

)

select * from final
""",
[("session_date","Date of sessions",[]),
 ("traffic_source","Traffic source grouping",[]),
 ("session_count","Total sessions",[]),
 ("engaged_sessions","Sessions > 60 seconds",[])])

core("core_mobile_engagement",
"Mobile app engagement per user aggregated from events.",
"""\
with

events as (

    select * from {{ ref('src_mobile_events') }}

)

, session_agg as (

    select
          session_id
        , user_id
        , platform
        , min(event_at)                              as session_start_at
        , max(event_at)                              as session_end_at
        , count(*)                                   as event_count
    from events
    group by session_id, user_id, platform

)

, final as (

    select
          user_id
        , platform
        , count(distinct session_id)                 as total_sessions
        , sum(event_count)                           as total_events
        , min(session_start_at)                      as first_seen_at
        , max(session_end_at)                        as last_seen_at
        , count(distinct cast(session_start_at as date)) as active_days
        , avg(datediff('second', session_start_at, session_end_at)) as avg_session_seconds
    from session_agg
    group by user_id, platform

)

select * from final
""",
[("user_id","App user identifier",[]),
 ("platform","ios/android/web",[]),
 ("total_sessions","Lifetime session count",[]),
 ("active_days","Days with at least one session",[])])

core("core_opportunities",
"Salesforce pipeline with weighted value and status classification.",
"""\
with

opps as (

    select * from {{ ref('src_salesforce_opportunities') }}

)

, accounts as (

    select account_id, account_name, industry, annual_revenue
    from {{ ref('src_salesforce_accounts') }}

)

, final as (

    select
          o.opportunity_id
        , o.account_id
        , a.account_name
        , a.industry
        , o.opportunity_name
        , o.stage
        , o.opportunity_value
        , o.expected_close_date
        , o.win_probability
        , o.opportunity_value
          * (o.win_probability / 100.0)              as weighted_pipeline_value
        , case
            when o.stage = 'Closed Won'              then 'won'
            when o.stage = 'Closed Lost'             then 'lost'
            else 'open'
          end                                        as opportunity_status
    from opps           as o
    left join accounts  as a on o.account_id = a.account_id

)

select * from final
""",
[("opportunity_id","Opportunity PK",["unique","not_null"]),
 ("weighted_pipeline_value","opportunity_value * win_probability / 100",[]),
 ("opportunity_status","won/lost/open",[])])

# PLANTED: missing tests + duplicate metric definition 1
core("core_revenue_summary",
"PLANTED — Monthly revenue for Finance. DUPLICATE METRIC: total_revenue = net only. Conflicts with analytics_revenue_v1 (gross) and analytics_executive_kpis (net+subs). MISSING uniqueness test on revenue_month.",
"""\
-- PLANTED PROBLEM: DUPLICATE METRIC (Definition 1) + MISSING TESTS
-- total_revenue = net_revenue only
-- Different from analytics_revenue_v1 and analytics_executive_kpis

with

orders as (

    select * from {{ ref('core_orders') }}

)

, final as (

    select
          order_month                                as revenue_month
        , count(distinct order_id)                   as order_count
        , sum(net_payment_amount)                    as total_revenue
        , sum(order_total_amount)                    as gross_revenue
        , sum(refunded_amount)                       as total_refunds
    from orders
    where not is_cancelled
    group by order_month

)

select * from final
""",
[("revenue_month","Monthly grain — MISSING uniqueness test",[]),
 ("total_revenue","DEFINITION 1: net_revenue only — conflicts with other models",[]),
 ("gross_revenue","Sum of order_total_amount",[])],
planted="DUPLICATE METRIC: total_revenue = net only. MISSING TESTS on revenue_month.")

# PLANTED: orphaned
core("core_coupon_analysis",
"ORPHANED: Built for Q2 2023 promo analysis. No downstream models. Safe to delete.",
"""\
-- PLANTED PROBLEM: ORPHANED — one-time Q2 2023 promo analysis

with

order_items as (

    select * from {{ ref('src_shopify_order_items') }}

)

, final as (

    select
          order_id
        , sum(discount_amount)                       as total_discount
        , sum(gross_line_amount)                     as pre_discount_value
        , {{ safe_divide('sum(discount_amount)','sum(gross_line_amount)') }} as discount_rate
    from order_items
    where discount_amount > 0
    group by order_id

)

select * from final
""",
[("order_id","Order reference",[]),
 ("discount_rate","total_discount / pre_discount_value",[])],
planted="ORPHANED — Q2 2023 promo analysis, no downstream refs")

# PLANTED: orphaned experimental
core("core_experimental_ltv",
"ORPHANED: Experimental LTV from hackathon. Superseded by core_customers.estimated_ltv.",
"""\
-- PLANTED PROBLEM: ORPHANED — hackathon experiment

with

customers as (

    select customer_id, gross_revenue, customer_lifespan_days
    from {{ ref('core_customers') }}

)

, final as (

    select
          customer_id
        , gross_revenue
        , gross_revenue * 2.5                        as experimental_ltv
        , {{ safe_divide('gross_revenue','nullif(customer_lifespan_days,0)') }}
          * 365                                      as annualised_revenue_rate
    from customers

)

select * from final
""",
[("customer_id","Customer reference",[]),
 ("experimental_ltv","DO NOT USE — use core_customers.estimated_ltv",[])],
planted="ORPHANED — superseded by core_customers.estimated_ltv")

# PLANTED: deprecated source chain
core("core_inventory_legacy",
"DEPRECATED SOURCE CHAIN: src_erp_products -> legacy_erp (decommissioned 2024-01-01). Migration to core_inventory_status overdue since 2024-03-01.",
"""\
-- PLANTED PROBLEM: DEPRECATED SOURCE CHAIN
-- src_erp_products -> legacy_erp (decommissioned 2024-01-01)

with

erp as (

    select * from {{ ref('src_erp_products') }}

)

, final as (

    select
          legacy_product_id
        , legacy_product_name
        , unit_cost
        , supplier_code
        , last_updated_at
        , 'legacy_erp'                               as data_source
    from erp

)

select * from final
""",
[("legacy_product_id","DEPRECATED: ERP product ID",[]),
 ("data_source","Always legacy_erp — use core_inventory_status instead",[])],
planted="DEPRECATED SOURCE CHAIN — legacy_erp decommissioned, migration overdue since 2024-03-01")

# PLANTED: broken lineage
core("core_seller_metrics",
"BROKEN LINEAGE: refs src_shopify_sellers which does not exist. Seller feature planned but source model never built.",
"""\
-- PLANTED PROBLEM: BROKEN LINEAGE
-- ref('src_shopify_sellers') does not exist

with

sellers as (

    select * from {{ ref('src_shopify_sellers') }}

)

, orders as (

    select * from {{ ref('core_orders') }}

)

, final as (

    select
          s.seller_id
        , s.seller_name
        , s.seller_tier
        , count(distinct o.order_id)                 as total_orders
        , sum(o.order_total_amount)                  as gross_gmv
        , avg(o.order_total_amount)                  as avg_order_value
    from sellers        as s
    left join orders    as o on s.seller_id = o.seller_id
    group by s.seller_id, s.seller_name, s.seller_tier

)

select * from final
""",
[("seller_id","BROKEN: upstream model missing",[]),
 ("gross_gmv","Total GMV for seller",[])],
planted="BROKEN LINEAGE — src_shopify_sellers does not exist")

core("core_geographic_revenue",
"Revenue by geography (approximate via email domain heuristics).",
"""\
with

customers as (

    select customer_id, customer_email
    from {{ ref('core_customers') }}

)

, orders as (

    select customer_id, order_total_amount, net_payment_amount
    from {{ ref('core_orders') }}
    where not is_cancelled

)

, geo as (

    select
          o.customer_id
        , o.order_total_amount
        , o.net_payment_amount
        , case
            when c.customer_email like '%.co.uk' then 'GB'
            when c.customer_email like '%.de'    then 'DE'
            when c.customer_email like '%.fr'    then 'FR'
            when c.customer_email like '%.ca'    then 'CA'
            when c.customer_email like '%.au'    then 'AU'
            else 'US'
          end                                        as approx_country
    from orders         as o
    left join customers as c on o.customer_id = c.customer_id

)

, final as (

    select
          approx_country
        , count(distinct customer_id)                as customer_count
        , sum(order_total_amount)                    as gross_revenue
        , sum(net_payment_amount)                    as net_revenue
        , avg(order_total_amount)                    as avg_order_value
    from geo
    group by approx_country

)

select * from final
""",
[("approx_country","ISO country code — APPROXIMATE via email domain",[]),
 ("gross_revenue","Sum of gross order revenue",[])])













# ══════════════════════════════════════════════════════════════
# ANALYTICS LAYER  (27 models)
# Business-ready. Light merging only. Refs core/ only.
# ══════════════════════════════════════════════════════════════
print("\nANALYTICS layer...")

def analytics(name, desc, sql, columns, planted=None):
    note = f"-- PLANTED PROBLEM: {planted}\n\n" if planted else ""
    col_yml = ""
    for c in columns:
        col_yml += f"      - name: {c[0]}\n        description: \"{c[1]}\"\n"
        if len(c) > 2 and c[2]:
            col_yml += "        tests:\n" + "\n".join(f"          - {t}" for t in c[2]) + "\n"
    yml = f"""version: 2
models:
  - name: {name}
    description: "{desc}"
    config:
      tags: ["analytics"]
    columns:
{col_yml}"""
    write(f"shopmesh_dbt/models/analytics/{name}.sql", note + sql)
    write(f"shopmesh_dbt/models/analytics/{name}.yml", yml)

# PLANTED: duplicate metric definition 2
analytics("analytics_revenue_v1",
"DUPLICATE METRIC — total_revenue DEFINITION 2: gross orders only. Marketing uses this. Conflicts with core_revenue_summary (net) and analytics_executive_kpis (net+subs).",
"""\
with

daily as (

    select * from {{ ref('core_revenue_daily') }}

)

, final as (

    select
          revenue_date
        , total_orders
        , completed_orders
        , gross_revenue                              as total_revenue
        , net_revenue
        , refund_amount
        , avg_order_value
    from daily

)

select * from final
""",
[("revenue_date","Daily revenue date",[]),
 ("total_revenue","DEFINITION 2: gross_revenue only — Marketing definition",[])])

# PLANTED: duplicate metric definition 3 + inherits grain bug
analytics("analytics_revenue_v2",
"DUPLICATE METRIC — total_revenue DEFINITION 3: gross + subs. Uses core_revenue_combined which has the wrong grain join. Inherits inflated subscription revenue.",
"""\
with

combined as (

    select * from {{ ref('core_revenue_combined') }}

)

, final as (

    select
          revenue_date
        , order_revenue
        , subscription_revenue
        , total_revenue
        , net_order_revenue
    from combined

)

select * from final
""",
[("revenue_date","Daily date",[]),
 ("total_revenue","DEFINITION 3: order + subs (INFLATED via grain bug)",[]),
 ("subscription_revenue","INFLATED: full month MRR per day",[])])

analytics("analytics_customer_360",
"Full 360 customer view for BI. Combines orders, subscriptions, segments, mobile.",
"""\
with

customers as (

    select * from {{ ref('core_customers') }}

)

, segments as (

    select * from {{ ref('core_customer_segments') }}

)

, mobile as (

    select * from {{ ref('core_mobile_engagement') }}

)

, final as (

    select
          c.customer_id
        , c.customer_email
        , c.full_name
        , c.ltv_tier
        , s.churn_status
        , s.account_size
        , c.total_orders
        , c.gross_revenue
        , c.net_revenue
        , c.estimated_ltv
        , c.first_order_at
        , c.last_order_at
        , c.days_since_last_order
        , c.annual_subscription_value
        , m.total_sessions                           as app_sessions
        , m.active_days                              as app_active_days
        , m.last_seen_at                             as last_app_activity_at
    from customers      as c
    left join segments  as s on c.customer_id = s.customer_id
    left join mobile    as m on cast(c.customer_id as varchar) = m.user_id

)

select * from final
""",
[("customer_id","Customer PK",["unique","not_null"]),
 ("ltv_tier","platinum/gold/silver/bronze",[]),
 ("churn_status","active/at_risk/churning/churned",[]),
 ("estimated_ltv","net_revenue + annual_subscription_value",[])])

analytics("analytics_customer_health",
"Customer health for Customer Success team. Includes churn risk and LTV.",
"""\
with

customers as (

    select * from {{ ref('core_customers') }}

)

, segments as (

    select * from {{ ref('core_customer_segments') }}

)

, final as (

    select
          c.customer_id
        , c.customer_email
        , c.ltv_tier
        , s.churn_status
        , s.account_size
        , c.total_orders
        , c.gross_revenue
        , c.estimated_ltv
        , c.days_since_last_order
        , c.annual_subscription_value
    from customers      as c
    left join segments  as s on c.customer_id = s.customer_id
    order by c.estimated_ltv desc

)

select * from final
""",
[("customer_id","Customer PK",["unique","not_null"]),
 ("churn_status","active/at_risk/churning/churned",[])])

# PLANTED: dead model
analytics("analytics_churn_risk",
"DEAD MODEL: Superseded by analytics_customer_health which includes churn_status. Last queried 2024-02-10. Still costing $28/month.",
"""\
with

customers as (

    select * from {{ ref('core_customers') }}

)

, final as (

    select
          customer_id
        , customer_email
        , days_since_last_order
        , total_orders
        , gross_revenue
        , case
            when days_since_last_order > 180     then 'high_risk'
            when days_since_last_order > 90      then 'medium_risk'
            else 'low_risk'
          end                                        as churn_risk_level
    from customers
    where days_since_last_order > 60

)

select * from final
""",
[("customer_id","Customer PK",[]),
 ("churn_risk_level","REDUNDANT — use analytics_customer_health.churn_status",[])],
planted="DEAD MODEL — superseded by analytics_customer_health, last queried 2024-02-10")

analytics("analytics_product_performance",
"Product performance dashboard for merchandising team.",
"""\
with

products as (

    select * from {{ ref('core_products') }}

)

select
      product_id
    , product_name
    , product_vendor
    , product_type
    , product_status
    , orders_with_product
    , total_units_sold
    , gross_product_revenue
    , total_discounts_given
    , avg_selling_price
    , total_inventory_quantity
    , stock_status
from products
order by gross_product_revenue desc
""",
[("product_id","Product PK",["unique","not_null"]),
 ("gross_product_revenue","Total gross sales",[]),
 ("stock_status","Inventory classification",[])])

analytics("analytics_subscription_health",
"Subscription KPIs for growth team, by plan and status.",
"""\
with

subs as (

    select * from {{ ref('core_subscriptions') }}

)

, final as (

    select
          plan_id
        , plan_name
        , plan_tier
        , subscription_status
        , count(*)                                   as subscription_count
        , sum(monthly_amount)                        as total_mrr
        , avg(monthly_amount)                        as avg_value
        , avg(subscription_age_days)                 as avg_age_days
    from subs
    group by plan_id, plan_name, plan_tier, subscription_status

)

select * from final
""",
[("plan_id","Plan identifier",[]),
 ("total_mrr","MRR for plan+status",[]),
 ("avg_age_days","Average subscription age",[])])

analytics("analytics_subscription_mrr_trend",
"Monthly MRR trend with period-over-period change.",
"""\
with

monthly as (

    select * from {{ ref('core_revenue_monthly') }}

)

, final as (

    select
          revenue_month
        , active_subscriptions
        , monthly_recurring_revenue
        , monthly_recurring_revenue * 12             as arr
        , monthly_recurring_revenue
          - lag(monthly_recurring_revenue) over (
              order by revenue_month
            )                                        as mrr_change
    from monthly
    order by revenue_month desc

)

select * from final
""",
[("revenue_month","Monthly grain",[]),
 ("monthly_recurring_revenue","Total MRR",[]),
 ("arr","Annualised recurring revenue MRR * 12",[]),
 ("mrr_change","Month-over-month MRR delta",[])])

analytics("analytics_marketing_weekly",
"Weekly paid media performance summary.",
"""\
with

ad_perf as (

    select * from {{ ref('core_ad_performance') }}

)

, final as (

    select
          date_trunc('week', performance_date)       as report_week
        , sum(impressions)                           as total_impressions
        , sum(clicks)                                as total_clicks
        , sum(ad_spend)                              as total_spend
        , sum(conversions)                           as total_conversions
        , avg(click_through_rate)                    as avg_ctr
        , {{ safe_divide('sum(ad_spend)','sum(conversions)') }} as blended_cpa
    from ad_perf
    group by date_trunc('week', performance_date)
    order by report_week desc

)

select * from final
""",
[("report_week","Week start date",[]),
 ("total_spend","Total paid media spend",[]),
 ("blended_cpa","ad_spend / conversions",[])])

analytics("analytics_b2b_pipeline",
"B2B pipeline for sales team with account tier classification.",
"""\
with

b2b as (

    select * from {{ ref('core_b2b_accounts') }}

)

, opps as (

    select
          account_id
        , count(case when opportunity_status = 'open' then 1 end) as open_opportunities
        , sum(case when opportunity_status = 'open'
              then weighted_pipeline_value end)      as weighted_pipeline
    from {{ ref('core_opportunities') }}
    group by account_id

)

, final as (

    select
          b.account_id
        , b.account_name
        , b.industry
        , b.annual_revenue
        , b.total_shopmesh_revenue
        , b.purchasing_contacts
        , b.wallet_share
        , coalesce(o.open_opportunities, 0)          as open_opportunities
        , coalesce(o.weighted_pipeline, 0)           as weighted_pipeline_value
        , case
            when b.wallet_share < 0.01               then 'growth_opportunity'
            when b.wallet_share < 0.05               then 'expanding'
            else 'strategic'
          end                                        as account_tier
    from b2b            as b
    left join opps      as o on b.account_id = o.account_id
    order by b.total_shopmesh_revenue desc

)

select * from final
""",
[("account_id","Account PK",["unique","not_null"]),
 ("wallet_share","ShopMesh / account annual revenue",[]),
 ("account_tier","growth_opportunity/expanding/strategic",[])])

analytics("analytics_inventory_current",
"Current inventory status for operations team.",
"""\
with

inventory as (

    select * from {{ ref('core_inventory_status') }}

)

select
      variant_id
    , product_id
    , product_name
    , product_vendor
    , sku
    , variant_price
    , quantity_on_hand
    , reorder_point
    , units_on_order
    , stock_status
    , inventory_value
    , inventory_as_of
from inventory
order by inventory_value desc
""",
[("variant_id","Variant PK",["unique","not_null"]),
 ("stock_status","out_of_stock/below_reorder/healthy/overstock",[]),
 ("inventory_value","variant_price * quantity_on_hand",[])])

analytics("analytics_cohort_retention",
"Cohort retention table for product and growth teams.",
"""\
with

cohorts as (

    select * from {{ ref('core_cohort_retention') }}

)

select * from cohorts
""",
[("cohort_month","Acquisition cohort month",[]),
 ("months_since_cohort","0=acquisition, 1=first retention month",[]),
 ("active_customers","Customers who purchased in period",[])])

analytics("analytics_email_performance",
"Email campaign performance for marketing team.",
"""\
with

email_perf as (

    select * from {{ ref('core_email_performance') }}

)

select
      campaign_id
    , campaign_name
    , campaign_type
    , sent_at
    , total_sent
    , opens
    , clicks
    , bounces
    , unsubscribes
    , open_rate
    , click_to_open_rate
    , unsubscribe_rate
from email_perf
order by sent_at desc
""",
[("campaign_id","Campaign PK",["unique","not_null"]),
 ("open_rate","opens / total_sent",[]),
 ("unsubscribe_rate","unsubscribes / total_sent",[])])

analytics("analytics_web_traffic",
"Web traffic summary by channel and device.",
"""\
with

web as (

    select * from {{ ref('core_web_engagement') }}

)

, final as (

    select
          session_date
        , traffic_source
        , traffic_medium
        , device_type
        , country_code
        , session_count
        , unique_visitors
        , avg_session_duration
        , avg_pageviews
        , engaged_sessions
        , {{ safe_divide('engaged_sessions','session_count') }} as engagement_rate
    from web

)

select * from final
""",
[("session_date","Date of sessions",[]),
 ("engagement_rate","engaged_sessions / session_count",[])])

analytics("analytics_mobile_engagement",
"Mobile app engagement by platform.",
"""\
with

mobile as (

    select * from {{ ref('core_mobile_engagement') }}

)

, final as (

    select
          platform
        , count(distinct user_id)                    as total_users
        , avg(total_sessions)                        as avg_sessions_per_user
        , avg(active_days)                           as avg_active_days
        , avg(avg_session_seconds)                   as avg_session_duration_seconds
        , count(case when datediff('day', last_seen_at, current_date) <= 7
                     then 1 end)                     as dau_7d_users
    from mobile
    group by platform

)

select * from final
""",
[("platform","ios/android/web",[]),
 ("dau_7d_users","Users active in last 7 days",[]),
 ("avg_session_duration_seconds","Average session length",[])])

analytics("analytics_geographic_revenue",
"Revenue by geography for executive team.",
"""\
with

geo as (

    select * from {{ ref('core_geographic_revenue') }}

)

, final as (

    select
          approx_country                             as country_code
        , customer_count
        , gross_revenue
        , net_revenue
        , avg_order_value
        , {{ safe_divide('gross_revenue','sum(gross_revenue) over ()') }} as revenue_share_pct
    from geo
    order by gross_revenue desc

)

select * from final
""",
[("country_code","ISO country code (approximate)",[]),
 ("revenue_share_pct","Country / total gross revenue",[])])

# PLANTED: dead model + deprecated chain
analytics("analytics_inventory_legacy",
"DEAD MODEL + DEPRECATED SOURCE CHAIN: core_inventory_legacy -> src_erp_products -> legacy_erp (decommissioned). Replaced by analytics_inventory_current. Still costing $31/month.",
"""\
with

legacy_inv as (

    select * from {{ ref('core_inventory_legacy') }}

)

select
      legacy_product_id
    , legacy_product_name
    , unit_cost
    , supplier_code
    , data_source
from legacy_inv
""",
[("legacy_product_id","DEPRECATED — use analytics_inventory_current",[])],
planted="DEAD MODEL + DEPRECATED SOURCE CHAIN — replaced by analytics_inventory_current, last queried 2024-04-01")

# PLANTED: dead seller dashboards
analytics("analytics_seller_dashboard_v1",
"DEAD MODEL: Seller dashboard v1. Replaced by v2 Oct 2023, feature killed Q4 2023. Refs broken core_seller_metrics. No queries since 2023-10-03.",
"""\
with

sellers as (

    select * from {{ ref('core_seller_metrics') }}

)

select seller_id, seller_name, total_orders, gross_gmv
from sellers
""",
[("seller_id","BROKEN upstream",[])],
planted="DEAD MODEL — seller feature killed, no queries since 2023-10-03")

analytics("analytics_seller_dashboard_v2",
"DEAD MODEL: Seller dashboard v2. Never used — seller feature killed before launch. Zero production queries ever.",
"""\
with

sellers as (

    select * from {{ ref('core_seller_metrics') }}

)

select seller_id, seller_name, total_orders, gross_gmv, 'v2' as version
from sellers
""",
[("seller_id","DEAD — never used in production",[])],
planted="DEAD MODEL — never used, seller feature killed before launch")

# PLANTED: dead legacy kpis
analytics("analytics_legacy_kpis",
"DEAD MODEL: Original board KPI report. Replaced by analytics_executive_kpis Jan 2024. Last queried 2023-12-15. Still costing $15/month.",
"""\
with

revenue as (

    select * from {{ ref('analytics_revenue_v1') }}

)

, customers as (

    select count(*) as total_customers from {{ ref('core_customers') }}

)

select r.revenue_date, r.total_revenue, r.total_orders, c.total_customers
from revenue    as r
cross join customers as c
""",
[("revenue_date","DEAD — use analytics_executive_kpis",[])],
planted="DEAD MODEL — replaced by analytics_executive_kpis, last queried 2023-12-15")

# PLANTED: duplicate metric definition 4
analytics("analytics_executive_kpis",
"DUPLICATE METRIC — total_revenue DEFINITION 4: net + subscriptions. Executive team definition. Conflicts with core_revenue_summary, analytics_revenue_v1, analytics_revenue_v2.",
"""\
with

orders as (

    select * from {{ ref('core_orders') }}

)

, subs as (

    select
          date_trunc('month', subscription_started_at) as month
        , sum(monthly_amount)                           as mrr
    from {{ ref('core_subscriptions') }}
    where is_active = true
    group by 1

)

, revenue as (

    select
          order_month                                as period
        , sum(net_payment_amount)                    as net_order_revenue
        , sum(order_total_amount)                    as gross_order_revenue
        , count(distinct order_id)                   as order_count
        , count(distinct customer_id)                as unique_customers
    from orders
    where not is_cancelled
    group by order_month

)

, final as (

    select
          r.period
        , r.order_count
        , r.unique_customers
        , r.net_order_revenue
        , coalesce(s.mrr, 0)                         as subscription_revenue
        , r.net_order_revenue
          + coalesce(s.mrr, 0)                       as total_revenue
        , r.gross_order_revenue
    from revenue    as r
    left join subs  as s on r.period = s.month
    order by r.period desc

)

select * from final
""",
[("period","Monthly grain",[]),
 ("total_revenue","DEFINITION 4: net_order_revenue + MRR — Executive definition",[]),
 ("subscription_revenue","Correctly aggregated MRR",[])])

analytics("analytics_refund_analysis",
"Refund analysis by date, reason and timing for finance and ops.",
"""\
with

refunds as (

    select * from {{ ref('core_refunds') }}

)

, final as (

    select
          cast(refunded_at as date)                  as refund_date
        , refund_reason
        , refund_timing
        , count(*)                                   as refund_count
        , sum(refund_amount)                         as total_refunded
        , avg(days_to_refund)                        as avg_days_to_refund
        , avg(refund_rate)                           as avg_refund_rate
    from refunds
    group by cast(refunded_at as date), refund_reason, refund_timing
    order by refund_date desc

)

select * from final
""",
[("refund_date","Date of refunds",[]),
 ("total_refunded","Total refund value",[]),
 ("avg_refund_rate","Average refund / original order ratio",[])])

analytics("analytics_new_vs_returning",
"New vs returning customer revenue split by week.",
"""\
with

orders as (

    select * from {{ ref('core_new_vs_returning') }}

)

, final as (

    select
          date_trunc('week', order_created_at)       as order_week
        , customer_type
        , count(distinct order_id)                   as order_count
        , count(distinct customer_id)                as unique_customers
        , sum(order_total_amount)                    as gross_revenue
        , avg(order_total_amount)                    as avg_order_value
    from orders
    group by date_trunc('week', order_created_at), customer_type
    order by order_week desc

)

select * from final
""",
[("order_week","Week of orders",[]),
 ("customer_type","new/returning",[]),
 ("gross_revenue","Total gross order revenue",[])])

analytics("analytics_finance_monthly",
"Monthly finance report combining order revenue and refunds.",
"""\
with

revenue as (

    select * from {{ ref('core_revenue_daily') }}

)

, refunds as (

    select
          date_trunc('month', cast(refunded_at as date))  as refund_month
        , sum(refund_amount)                              as total_refunds
        , count(*)                                        as refund_count
    from {{ ref('core_refunds') }}
    group by 1

)

, final as (

    select
          date_trunc('month', r.revenue_date)        as report_month
        , sum(r.gross_revenue)                       as gross_revenue
        , sum(r.net_revenue)                         as net_revenue
        , sum(r.completed_orders)                    as completed_orders
        , coalesce(rf.total_refunds, 0)              as total_refunds
        , sum(r.net_revenue)
          - coalesce(rf.total_refunds, 0)            as net_recognised_revenue
    from revenue    as r
    left join refunds as rf
        on date_trunc('month', r.revenue_date) = rf.refund_month
    group by date_trunc('month', r.revenue_date), rf.total_refunds, rf.refund_count
    order by report_month desc

)

select * from final
""",
[("report_month","Monthly grain",["unique","not_null"]),
 ("gross_revenue","Sum of gross order revenue",[]),
 ("net_recognised_revenue","net_revenue minus total_refunds",[])])

# PLANTED: dead cac analysis
analytics("analytics_cac_analysis",
"DEAD MODEL: One-time CAC analysis for Q3 2023 board deck. Never scheduled. No queries since 2023-09-22.",
"""\
with

ad_spend as (

    select
          performance_date
        , sum(ad_spend)                              as daily_spend
    from {{ ref('core_ad_performance') }}
    group by performance_date

)

, new_customers as (

    select
          cast(first_order_at as date)               as acquisition_date
        , count(*)                                   as new_customers
    from {{ ref('core_customers') }}
    group by cast(first_order_at as date)

)

, final as (

    select
          a.performance_date
        , a.daily_spend
        , nc.new_customers
        , {{ safe_divide('a.daily_spend','nc.new_customers') }} as estimated_cac
    from ad_spend           as a
    left join new_customers as nc on a.performance_date = nc.acquisition_date

)

select * from final
""",
[("performance_date","DEAD — Q3 2023 board deck only",[]),
 ("estimated_cac","ad_spend / new_customers",[])])

analytics("analytics_channel_roi",
"Channel ROI — paid vs organic attribution.",
"""\
with

orders as (

    select * from {{ ref('core_orders') }}

)

, web as (

    select * from {{ ref('core_web_engagement') }}

)

, final as (

    select
          w.traffic_source                           as channel
        , w.device_type
        , count(distinct o.order_id)                 as order_count
        , sum(o.order_total_amount)                  as attributed_revenue
        , count(distinct o.customer_id)              as unique_customers
    from orders         as o
    left join web       as w
        on cast(o.order_created_at as date) = w.session_date
    group by w.traffic_source, w.device_type

)

select * from final
""",
[("channel","Traffic channel",[]),
 ("attributed_revenue","Sum of order revenue for channel",[])])

analytics("analytics_new_customer_acquisition",
"Daily new customer acquisition by channel.",
"""\
with

new_orders as (

    select * from {{ ref('core_new_vs_returning') }}
    where customer_type = 'new'

)

, web as (

    select * from {{ ref('core_web_engagement') }}

)

, final as (

    select
          cast(n.order_created_at as date)           as acquisition_date
        , w.traffic_source                           as acquisition_channel
        , count(distinct n.customer_id)              as new_customers
        , sum(n.order_total_amount)                  as new_customer_revenue
        , avg(n.order_total_amount)                  as avg_first_order_value
    from new_orders     as n
    left join web       as w
        on cast(n.order_created_at as date) = w.session_date
    group by cast(n.order_created_at as date), w.traffic_source
    order by acquisition_date desc

)

select * from final
""",
[("acquisition_date","Date of new customer first orders",[]),
 ("acquisition_channel","Acquisition channel",[]),
 ("new_customers","Count of first-time customers",[]),
 ("avg_first_order_value","Average value of first order",[])])

# ── QUERY HISTORY ─────────────────────────────────────────────
print("\nWriting query_history.json...")

qh = {
  "metadata": {"warehouse": "SHOPMESH_WH", "period": "last_180_days"},
  "model_query_history": [
    {"model":"core_orders",                    "query_count_30d":412,"query_count_90d":1204,"last_queried_at":"2025-01-31"},
    {"model":"analytics_customer_360",         "query_count_30d":387,"query_count_90d":1102,"last_queried_at":"2025-01-31"},
    {"model":"analytics_executive_kpis",       "query_count_30d":302,"query_count_90d":890, "last_queried_at":"2025-01-31"},
    {"model":"core_customers",                 "query_count_30d":289,"query_count_90d":841, "last_queried_at":"2025-01-31"},
    {"model":"analytics_customer_health",      "query_count_30d":201,"query_count_90d":589, "last_queried_at":"2025-01-30"},
    {"model":"analytics_revenue_v1",           "query_count_30d":189,"query_count_90d":534, "last_queried_at":"2025-01-31"},
    {"model":"analytics_revenue_v2",           "query_count_30d":156,"query_count_90d":441, "last_queried_at":"2025-01-30"},
    {"model":"core_revenue_summary",           "query_count_30d":143,"query_count_90d":398, "last_queried_at":"2025-01-30"},
    {"model":"analytics_subscription_health",  "query_count_30d":134,"query_count_90d":389, "last_queried_at":"2025-01-31"},
    {"model":"analytics_product_performance",  "query_count_30d":98, "query_count_90d":287, "last_queried_at":"2025-01-28"},
    {"model":"analytics_inventory_current",    "query_count_30d":71, "query_count_90d":198, "last_queried_at":"2025-01-29"},
    {"model":"analytics_finance_monthly",      "query_count_30d":64, "query_count_90d":181, "last_queried_at":"2025-01-28"},
    {"model":"analytics_email_performance",    "query_count_30d":58, "query_count_90d":164, "last_queried_at":"2025-01-27"},
    {"model":"analytics_churn_risk",           "query_count_30d":0,  "query_count_90d":0,   "last_queried_at":"2024-02-10","note":"DEAD"},
    {"model":"analytics_legacy_kpis",          "query_count_30d":0,  "query_count_90d":0,   "last_queried_at":"2023-12-15","note":"DEAD"},
    {"model":"analytics_seller_dashboard_v1",  "query_count_30d":0,  "query_count_90d":0,   "last_queried_at":"2023-10-03","note":"DEAD"},
    {"model":"analytics_seller_dashboard_v2",  "query_count_30d":0,  "query_count_90d":0,   "last_queried_at":None,        "note":"DEAD - never used"},
    {"model":"analytics_cac_analysis",         "query_count_30d":0,  "query_count_90d":0,   "last_queried_at":"2023-09-22","note":"DEAD"},
    {"model":"analytics_inventory_legacy",     "query_count_30d":0,  "query_count_90d":0,   "last_queried_at":"2024-04-01","note":"DEAD + DEPRECATED CHAIN"},
    {"model":"core_coupon_analysis",           "query_count_30d":0,  "query_count_90d":0,   "last_queried_at":"2023-06-14","note":"ORPHANED"},
    {"model":"core_experimental_ltv",          "query_count_30d":0,  "query_count_90d":0,   "last_queried_at":"2023-11-30","note":"ORPHANED"},
    {"model":"raw_mobile_sessions",            "query_count_30d":0,  "query_count_90d":0,   "last_queried_at":None,        "note":"ORPHANED"},
    {"model":"raw_shopify_gift_cards",         "query_count_30d":0,  "query_count_90d":0,   "last_queried_at":None,        "note":"ORPHANED"},
    {"model":"core_seller_metrics",            "query_count_30d":0,  "query_count_90d":0,   "last_queried_at":None,        "note":"BROKEN LINEAGE"},
    {"model":"src_shopify_gift_cards_v2",      "query_count_30d":0,  "query_count_90d":0,   "last_queried_at":None,        "note":"BROKEN LINEAGE"},
    {"model":"src_orders_v2",                  "query_count_30d":3,  "query_count_90d":9,   "last_queried_at":"2024-12-28","note":"DUPLICATE - low usage"},
    {"model":"core_inventory_legacy",          "query_count_30d":2,  "query_count_90d":6,   "last_queried_at":"2024-12-15","note":"DEPRECATED CHAIN"},
    {"model":"src_erp_products",               "query_count_30d":1,  "query_count_90d":3,   "last_queried_at":"2024-12-01","note":"DEPRECATED SOURCE"},
    {"model":"src_erp_warehouses",             "query_count_30d":0,  "query_count_90d":2,   "last_queried_at":"2024-11-20","note":"DEPRECATED SOURCE"},
  ],
  "cost_estimate_monthly_usd": {
    "analytics_churn_risk":28,"analytics_legacy_kpis":15,
    "analytics_seller_dashboard_v1":22,"analytics_seller_dashboard_v2":22,
    "analytics_cac_analysis":18,"analytics_inventory_legacy":31,
    "core_inventory_legacy":12,"core_coupon_analysis":9,
    "core_experimental_ltv":6,"raw_mobile_sessions":4,
    "raw_shopify_gift_cards":3,"total_waste_monthly_usd":170
  }
}

with open(os.path.join(BASE, "shopmesh_dbt/query_history.json"), "w", encoding="utf-8") as f:
    json.dump(qh, f, indent=2)
print("  OK  shopmesh_dbt/query_history.json")

# ── SCRIPTS ───────────────────────────────────────────────────
write("scripts/answer_key.py", """
PLANTED_PROBLEMS = [
    # DEAD MODELS (7)
    {"id":"DEAD-001","type":"dead_model","model":"analytics_seller_dashboard_v1","cost_usd":22},
    {"id":"DEAD-002","type":"dead_model","model":"analytics_seller_dashboard_v2","cost_usd":22},
    {"id":"DEAD-003","type":"dead_model","model":"analytics_legacy_kpis","cost_usd":15},
    {"id":"DEAD-004","type":"dead_model","model":"analytics_cac_analysis","cost_usd":18},
    {"id":"DEAD-005","type":"dead_model","model":"analytics_inventory_legacy","cost_usd":31},
    {"id":"DEAD-006","type":"dead_model","model":"analytics_churn_risk","cost_usd":28},
    {"id":"DEAD-007","type":"dead_model","model":"core_inventory_legacy","cost_usd":12},
    # BROKEN LINEAGE (2)
    {"id":"BROKEN-001","type":"broken_lineage","model":"core_seller_metrics","reason":"ref src_shopify_sellers does not exist"},
    {"id":"BROKEN-002","type":"broken_lineage","model":"src_shopify_gift_cards_v2","reason":"shopify.gift_cards source never configured"},
    # LOGIC DRIFT (1)
    {"id":"DRIFT-001","type":"logic_drift","model":"src_orders_v2","reason":"duplicate of src_shopify_orders with different column names"},
    # DEPRECATED SOURCES (3)
    {"id":"DEPRECATED-001","type":"deprecated_source","model":"src_erp_products","source":"legacy_erp"},
    {"id":"DEPRECATED-002","type":"deprecated_source","model":"src_erp_warehouses","source":"legacy_erp"},
    {"id":"DEPRECATED-003","type":"deprecated_chain","model":"analytics_inventory_legacy","chain":"analytics_inventory_legacy->core_inventory_legacy->src_erp_products->legacy_erp"},
    # DUPLICATE METRICS (2)
    {"id":"DUPLICATE-001","type":"duplicate_metric","metric":"total_revenue",
     "models":["core_revenue_summary","analytics_revenue_v1","analytics_revenue_v2","analytics_executive_kpis"],
     "definitions":{"core_revenue_summary":"net only","analytics_revenue_v1":"gross only","analytics_revenue_v2":"gross+subs (inflated)","analytics_executive_kpis":"net+subs"}},
    {"id":"DUPLICATE-002","type":"redundant_model","model":"src_orders_v2","superseded_by":"src_shopify_orders"},
    # ORPHANED (6)
    {"id":"ORPHAN-001","type":"orphaned_model","model":"core_coupon_analysis"},
    {"id":"ORPHAN-002","type":"orphaned_model","model":"core_experimental_ltv"},
    {"id":"ORPHAN-003","type":"orphaned_model","model":"raw_mobile_sessions"},
    {"id":"ORPHAN-004","type":"orphaned_model","model":"raw_shopify_gift_cards"},
    {"id":"ORPHAN-005","type":"orphaned_model","model":"src_erp_products"},
    {"id":"ORPHAN-006","type":"orphaned_model","model":"src_erp_warehouses"},
    # WRONG GRAIN JOIN (1)
    {"id":"GRAIN-001","type":"wrong_grain_join","model":"core_revenue_combined",
     "description":"DAILY joined to MONTHLY causes subscription_revenue ~30x inflation. Cascades to analytics_revenue_v2."},
    # MISSING TESTS (4)
    {"id":"TEST-001","type":"missing_tests","model":"core_orders","severity":"critical","missing":["unique+not_null on order_id"]},
    {"id":"TEST-002","type":"missing_tests","model":"core_customers","severity":"critical","missing":["uniqueness tests"]},
    {"id":"TEST-003","type":"missing_tests","model":"core_revenue_summary","severity":"high","missing":["uniqueness on revenue_month"]},
    {"id":"TEST-004","type":"missing_tests","model":"core_revenue_combined","severity":"high","missing":["row count assertion to catch grain fan-out"]},
]

TOTAL = len(PLANTED_PROBLEMS)
PASS_THRESHOLD = 0.70

if __name__ == "__main__":
    from collections import Counter
    print(f"Total planted problems: {TOTAL}")
    print(f"Pass = 70% = {int(TOTAL * 0.7)} problems")
    print()
    for t, c in Counter(p["type"] for p in PLANTED_PROBLEMS).most_common():
        print(f"  {t}: {c}")
    waste = sum(p.get("cost_usd",0) for p in PLANTED_PROBLEMS if p["type"]=="dead_model")
    print(f"\\nWasted spend (dead models): ${waste}/month")
""")

write("scripts/validate_env.py", """
import sys, os

def check(label, fn):
    try:
        fn()
        print(f"  OK  {label}")
        return True
    except Exception as e:
        print(f"  FAIL  {label} - {e}")
        return False

print("\\n" + "="*45)
print("  DataPilot -- Environment Check")
print("="*45 + "\\n")

results = []
results.append(check("Python 3.10+",
    lambda: None if sys.version_info>=(3,10) else (_ for _ in ()).throw(Exception("Need 3.10+"))))
results.append(check("dbt-duckdb",    lambda: __import__("dbt.version")))
results.append(check("DuckDB",        lambda: __import__("duckdb").connect().execute("SELECT 42").fetchone()))
results.append(check("Anthropic SDK", lambda: __import__("anthropic")))
results.append(check("KuzuDB",        lambda: __import__("kuzu")))
results.append(check("NetworkX",      lambda: __import__("networkx")))

def check_key():
    from dotenv import load_dotenv; load_dotenv()
    k = os.getenv("ANTHROPIC_API_KEY","")
    assert k and k != "your_api_key_here", "Not set - open .env and add key"
results.append(check("API key in .env", check_key))

def check_structure():
    for p in ["shopmesh_dbt/dbt_project.yml","shopmesh_dbt/models/raw",
              "shopmesh_dbt/models/source","shopmesh_dbt/models/core",
              "shopmesh_dbt/models/analytics","shopmesh_dbt/macros",
              "shopmesh_dbt/query_history.json","scripts/answer_key.py"]:
        assert os.path.exists(p), f"Missing: {p}"
results.append(check("Project structure", check_structure))

def count_models():
    import glob
    sql = glob.glob("shopmesh_dbt/models/**/*.sql", recursive=True)
    assert len(sql) >= 100, f"Only {len(sql)} SQL files"
    print(f"         {len(sql)} SQL models found")
results.append(check("100+ models", count_models))

print()
passed = sum(results)
total  = len(results)
print(f"  {passed}/{total} passed {'-- ready for Phase 2!' if passed==total else '-- fix FAIL items above'}")
print()
""")

# ── FINAL SUMMARY ─────────────────────────────────────────────
sql_files = glob.glob(os.path.join(BASE,"shopmesh_dbt/models/**/*.sql"), recursive=True)
yml_files = glob.glob(os.path.join(BASE,"shopmesh_dbt/models/**/*.yml"), recursive=True)
print("\n" + "="*55)
print(f"  DONE  {len(sql_files)} SQL models   {len(yml_files)} YML files")
print()
for layer in ["raw","source","core","analytics"]:
    n = len([f for f in sql_files if f"/models/{layer}/" in f.replace("\\","/")])
    print(f"    {layer:12s} {n} models")
print()
print("  Next:")
print("    1. pip install -r requirements.txt")
print("    2. Add API key to .env")
print("    3. python scripts/validate_env.py")
print("="*55)