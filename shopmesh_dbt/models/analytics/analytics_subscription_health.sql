with

subs as (

    select * from {{ ref('core_subscriptions') }}

)

, final as (

    select
          plan_id
        , plan_name
        , plan_tier
        , subscription_status
        , count(*)                                   as subscription_count
        , sum(monthly_amount)                        as total_mrr
        , avg(monthly_amount)                        as avg_value
        , avg(subscription_age_days)                 as avg_age_days
    from subs
    group by plan_id, plan_name, plan_tier, subscription_status

)

select * from final
