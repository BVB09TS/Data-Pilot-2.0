-- PLANTED PROBLEM: DUPLICATE of src_shopify_orders — different column names cause logic drift

with

source as (

    select * from {{ ref('raw_shopify_orders') }}

)

, final as (

    select
          order_id
        , customer_id
        , cast(created_at as timestamp)              as ordered_at
        , cast(total_price as decimal(12, 2))        as order_value
        , financial_status
        , fulfillment_status
    from source
    where financial_status != 'voided'

)

select * from final
