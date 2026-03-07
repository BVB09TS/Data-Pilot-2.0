with

source as (

    select * from {{ source('shopify', 'order_line_items') }}

)

, final as (

    select
          id  as line_item_id
        , order_id  as order_id
        , product_id  as product_id
        , variant_id  as variant_id
        , quantity  as quantity
        , price  as price
        , discount_amount  as discount_amount
        , sku  as sku
        , title  as product_title
    from source

)

select * from final
