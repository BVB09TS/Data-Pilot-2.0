with

source as (

    select * from {{ ref('raw_shopify_orders') }}

)

, final as (

    select
          order_id
        , customer_id
        , cast(created_at as timestamp)              as order_created_at
        , cast(updated_at as timestamp)              as order_updated_at
        , cast(total_price as decimal(12, 2))        as order_total_amount
        , financial_status
        , fulfillment_status
        , cast(cancelled_at as timestamp)            as cancelled_at
        , currency
        , order_tags
        , case
            when cancelled_at is not null then true
            else false
          end                                        as is_cancelled
    from source

)

select * from final
