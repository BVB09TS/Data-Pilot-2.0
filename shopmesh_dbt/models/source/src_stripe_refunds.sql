with

source as (

    select * from {{ ref('raw_stripe_refunds') }}

)

, final as (

    select
          refund_id
        , payment_id
        , {{ cents_to_dollars('amount_cents') }}     as refund_amount
        , reason                                     as refund_reason
        , cast(created_at as timestamp)              as refunded_at
        , status                                     as refund_status
    from source

)

select * from final
