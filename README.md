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
