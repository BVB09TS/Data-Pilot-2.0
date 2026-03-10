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
