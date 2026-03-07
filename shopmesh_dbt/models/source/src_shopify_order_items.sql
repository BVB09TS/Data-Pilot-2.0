with

source as (

    select * from {{ ref('raw_shopify_order_items') }}

)

, final as (

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
    from source

)

select * from final
