-- PLANTED PROBLEM: DUPLICATE METRIC: total_revenue = net only. MISSING TESTS on revenue_month.

-- PLANTED PROBLEM: DUPLICATE METRIC (Definition 1) + MISSING TESTS
-- total_revenue = net_revenue only
-- Different from analytics_revenue_v1 and analytics_executive_kpis

with

orders as (

    select * from {{ ref('core_orders') }}

)

, final as (

    select
          order_month                                as revenue_month
        , count(distinct order_id)                   as order_count
        , sum(net_payment_amount)                    as total_revenue
        , sum(order_total_amount)                    as gross_revenue
        , sum(refunded_amount)                       as total_refunds
    from orders
    where not is_cancelled
    group by order_month

)

select * from final
