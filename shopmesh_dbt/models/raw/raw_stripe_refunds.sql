with

source as (

    select * from {{ source('stripe', 'refunds') }}

)

, final as (

    select
          id  as refund_id
        , payment_id  as payment_id
        , amount  as amount_cents
        , reason  as reason
        , created_at  as created_at
        , status  as status
    from source

)

select * from final
