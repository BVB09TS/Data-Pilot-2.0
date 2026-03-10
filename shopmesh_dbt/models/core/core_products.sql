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
