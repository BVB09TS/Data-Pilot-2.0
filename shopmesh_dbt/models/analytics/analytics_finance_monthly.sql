with

revenue as (

    select * from {{ ref('core_revenue_daily') }}

)

, refunds as (

    select
          date_trunc('month', cast(refunded_at as date))  as refund_month
        , sum(refund_amount)                              as total_refunds
        , count(*)                                        as refund_count
    from {{ ref('core_refunds') }}
    group by 1

)

, final as (

    select
          date_trunc('month', r.revenue_date)        as report_month
        , sum(r.gross_revenue)                       as gross_revenue
        , sum(r.net_revenue)                         as net_revenue
        , sum(r.completed_orders)                    as completed_orders
        , coalesce(rf.total_refunds, 0)              as total_refunds
        , sum(r.net_revenue)
          - coalesce(rf.total_refunds, 0)            as net_recognised_revenue
    from revenue    as r
    left join refunds as rf
        on date_trunc('month', r.revenue_date) = rf.refund_month
    group by date_trunc('month', r.revenue_date), rf.total_refunds, rf.refund_count
    order by report_month desc

)

select * from final
