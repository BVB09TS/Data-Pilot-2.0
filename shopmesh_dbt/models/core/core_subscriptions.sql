with

subs as (

    select * from {{ ref('src_stripe_subscriptions') }}

)

, customers as (

    select customer_id, customer_email, ltv_tier
    from {{ ref('core_customers') }}

)

, plans as (

    select * from {{ ref('plan_definitions') }}

)

, final as (

    select
          s.subscription_id
        , s.customer_id
        , c.customer_email
        , c.ltv_tier                                 as customer_ltv_tier
        , s.plan_id
        , p.plan_name
        , p.plan_tier
        , s.subscription_status
        , s.subscription_started_at
        , s.subscription_cancelled_at
        , s.is_active
        , s.monthly_amount
        , s.monthly_amount * 12                      as annual_amount
        , datediff('day', s.subscription_started_at,
              coalesce(s.subscription_cancelled_at, current_date)) as subscription_age_days
    from subs           as s
    left join customers as c on s.customer_id = c.customer_id
    left join plans     as p on s.plan_id = p.plan_id

)

select * from final
