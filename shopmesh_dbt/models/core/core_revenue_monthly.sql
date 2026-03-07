with

subs as (

    select * from {{ ref('src_stripe_subscriptions') }}

)

, final as (

    select
          date_trunc('month', subscription_started_at) as revenue_month
        , count(*)                                      as active_subscriptions
        , sum(monthly_amount)                           as monthly_recurring_revenue
        , avg(monthly_amount)                           as avg_subscription_value
    from subs
    where is_active = true
    group by date_trunc('month', subscription_started_at)

)

select * from final
