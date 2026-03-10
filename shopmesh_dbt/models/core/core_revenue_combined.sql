-- PLANTED PROBLEM: WRONG GRAIN JOIN — DAILY x MONTHLY causes ~30x inflation of subscription_revenue

with

daily as (

    select * from {{ ref('core_revenue_daily') }}

)

, monthly_subs as (

    select * from {{ ref('core_revenue_monthly') }}

)

-- PLANTED PROBLEM: WRONG GRAIN JOIN
-- core_revenue_daily  = DAILY grain
-- core_revenue_monthly = MONTHLY grain
-- Every daily row gets the full monthly MRR, inflating it ~30x
, final as (

    select
          d.revenue_date
        , d.gross_revenue                            as order_revenue
        , d.net_revenue                              as net_order_revenue
        , m.monthly_recurring_revenue                as subscription_revenue
        , d.gross_revenue
          + m.monthly_recurring_revenue              as total_revenue
    from daily             as d
    left join monthly_subs as m
        on date_trunc('month', d.revenue_date) = m.revenue_month

)

select * from final
