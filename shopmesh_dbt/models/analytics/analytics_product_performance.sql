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
