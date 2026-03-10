with

source as (

    select * from {{ ref('src_stripe_subscriptions') }}

)

, final as (

    select
          subscription_id
        , customer_id
        , 'subscription_started'                     as event_type
        , subscription_started_at                    as event_at
        , monthly_amount
    from source

    union all

    select
          subscription_id
        , customer_id
        , 'subscription_cancelled'                   as event_type
        , subscription_cancelled_at                  as event_at
        , monthly_amount
    from source
    where subscription_cancelled_at is not null

)

select * from final
