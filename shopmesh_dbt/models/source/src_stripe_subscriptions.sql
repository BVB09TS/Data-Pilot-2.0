with

source as (

    select * from {{ ref('raw_stripe_subscriptions') }}

)

, final as (

    select
          subscription_id
        , customer_id
        , plan_id
        , status                                     as subscription_status
        , cast(started_at as timestamp)              as subscription_started_at
        , cast(cancelled_at as timestamp)            as subscription_cancelled_at
        , {{ cents_to_dollars('monthly_amount_cents') }} as monthly_amount
        , cast(trial_ends_at as timestamp)           as trial_ends_at
        , case when status = 'active' then true else false end as is_active
    from source

)

select * from final
