with

source as (

    select * from {{ source('shopify', 'orders') }}

)

, final as (

    select
          id  as order_id
        , customer_id  as customer_id
        , created_at  as created_at
        , updated_at  as updated_at
        , total_price  as total_price
        , financial_status  as financial_status
        , fulfillment_status  as fulfillment_status
        , cancelled_at  as cancelled_at
        , currency  as currency
        , tags  as order_tags
    from source

)

select * from final
