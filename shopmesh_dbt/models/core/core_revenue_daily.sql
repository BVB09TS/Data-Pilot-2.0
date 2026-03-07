with

orders as (

    select * from {{ ref('core_orders') }}

)

, final as (

    select
          order_date                                 as revenue_date
        , count(*)                                   as total_orders
        , count(case when not is_cancelled then 1 end) as completed_orders
        , sum(order_total_amount)                    as gross_revenue
        , sum(net_payment_amount)                    as net_revenue
        , sum(refunded_amount)                       as refund_amount
        , avg(order_total_amount)                    as avg_order_value
        , count(distinct customer_id)                as unique_customers
    from orders
    group by order_date

)

select * from final
