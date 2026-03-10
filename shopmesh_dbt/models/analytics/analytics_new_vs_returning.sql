with

orders as (

    select * from {{ ref('core_new_vs_returning') }}

)

, final as (

    select
          date_trunc('week', order_created_at)       as order_week
        , customer_type
        , count(distinct order_id)                   as order_count
        , count(distinct customer_id)                as unique_customers
        , sum(order_total_amount)                    as gross_revenue
        , avg(order_total_amount)                    as avg_order_value
    from orders
    group by date_trunc('week', order_created_at), customer_type
    order by order_week desc

)

select * from final
