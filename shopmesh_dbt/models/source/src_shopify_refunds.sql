with

source as (

    select * from {{ ref('raw_shopify_refunds') }}

)

, final as (

    select
          refund_id
        , order_id
        , cast(created_at as timestamp)              as refunded_at
        , refund_note
    from source

)

select * from final
