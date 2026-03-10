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
