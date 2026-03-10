with

source as (

    select * from {{ source('stripe', 'payments') }}

)

, final as (

    select
          id  as payment_id
        , order_id  as order_id
        , amount  as amount_cents
        , currency  as currency
        , status  as status
        , created_at  as created_at
        , refunded_amount  as refunded_amount_cents
        , payment_method  as payment_method
    from source

)

select * from final
