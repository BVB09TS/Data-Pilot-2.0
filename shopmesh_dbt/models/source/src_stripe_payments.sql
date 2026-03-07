with

source as (

    select * from {{ ref('raw_stripe_payments') }}

)

, final as (

    select
          payment_id
        , order_id
        , {{ cents_to_dollars('amount_cents') }}         as payment_amount
        , currency
        , status                                         as payment_status
        , cast(created_at as timestamp)                  as payment_created_at
        , {{ cents_to_dollars('refunded_amount_cents') }} as refunded_amount
        , {{ cents_to_dollars('amount_cents') }}
          - {{ cents_to_dollars('refunded_amount_cents') }} as net_payment_amount
        , payment_method
    from source

)

select * from final
