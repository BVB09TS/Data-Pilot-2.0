with

monthly as (

    select * from {{ ref('core_revenue_monthly') }}

)

, final as (

    select
          revenue_month
        , active_subscriptions
        , monthly_recurring_revenue
        , monthly_recurring_revenue * 12             as arr
        , monthly_recurring_revenue
          - lag(monthly_recurring_revenue) over (
              order by revenue_month
            )                                        as mrr_change
    from monthly
    order by revenue_month desc

)

select * from final
