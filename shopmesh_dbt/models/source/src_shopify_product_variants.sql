with

source as (

    select * from {{ ref('raw_shopify_product_variants') }}

)

, final as (

    select
          variant_id
        , product_id
        , sku
        , cast(price as decimal(12, 2))              as variant_price
        , cast(inventory_quantity as integer)        as inventory_quantity
        , option_size
        , option_color
    from source

)

select * from final
