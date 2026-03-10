-- PLANTED PROBLEM: DEAD MODEL + DEPRECATED SOURCE CHAIN — replaced by analytics_inventory_current, last queried 2024-04-01

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
