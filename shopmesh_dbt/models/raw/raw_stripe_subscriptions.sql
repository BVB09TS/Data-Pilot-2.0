with

source as (

    select * from {{ source('stripe', 'subscriptions') }}

)

, final as (

    select
          id  as subscription_id
        , customer_id  as customer_id
        , plan_id  as plan_id
        , status  as status
        , started_at  as started_at
        , cancelled_at  as cancelled_at
        , monthly_amount  as monthly_amount_cents
        , trial_end  as trial_ends_at
    from source

)

select * from final
