with

source as (

    select * from {{ source('shopify', 'product_variants') }}

)

, final as (

    select
          id  as variant_id
        , product_id  as product_id
        , sku  as sku
        , price  as price
        , inventory_quantity  as inventory_quantity
        , option1  as option_size
        , option2  as option_color
    from source

)

select * from final
