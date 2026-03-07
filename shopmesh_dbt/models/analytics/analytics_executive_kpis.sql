with

orders as (

    select * from {{ ref('core_orders') }}

)

, subs as (

    select
          date_trunc('month', subscription_started_at) as month
        , sum(monthly_amount)                           as mrr
    from {{ ref('core_subscriptions') }}
    where is_active = true
    group by 1

)

, revenue as (

    select
          order_month                                as period
        , sum(net_payment_amount)                    as net_order_revenue
        , sum(order_total_amount)                    as gross_order_revenue
        , count(distinct order_id)                   as order_count
        , count(distinct customer_id)                as unique_customers
    from orders
    where not is_cancelled
    group by order_month

)

, final as (

    select
          r.period
        , r.order_count
        , r.unique_customers
        , r.net_order_revenue
        , coalesce(s.mrr, 0)                         as subscription_revenue
        , r.net_order_revenue
          + coalesce(s.mrr, 0)                       as total_revenue
        , r.gross_order_revenue
    from revenue    as r
    left join subs  as s on r.period = s.month
    order by r.period desc

)

select * from final
