with

customers as (

    select * from {{ ref('src_shopify_customers') }}

)

, order_summary as (

    select
          customer_id
        , count(*)                                   as total_orders
        , count(case when not is_cancelled then 1 end) as completed_orders
        , sum(order_total_amount)                    as gross_revenue
        , sum(net_payment_amount)                    as net_revenue
        , sum(refunded_amount)                       as total_refunded
        , min(order_created_at)                      as first_order_at
        , max(order_created_at)                      as last_order_at
        , avg(order_total_amount)                    as avg_order_value
    from {{ ref('core_orders') }}
    group by customer_id

)

, subscriptions as (

    select
          customer_id
        , sum(monthly_amount) * 12                   as annual_subscription_value
    from {{ ref('src_stripe_subscriptions') }}
    where is_active = true
    group by customer_id

)

, final as (

    select
          c.customer_id
        , c.customer_email
        , c.full_name
        , c.customer_created_at
        , c.customer_tags
        , c.is_email_verified
        , coalesce(o.total_orders, 0)                as total_orders
        , coalesce(o.completed_orders, 0)            as completed_orders
        , coalesce(o.gross_revenue, 0)               as gross_revenue
        , coalesce(o.net_revenue, 0)                 as net_revenue
        , coalesce(o.total_refunded, 0)              as total_refunded
        , o.first_order_at
        , o.last_order_at
        , o.avg_order_value
        , datediff('day', o.first_order_at, o.last_order_at) as customer_lifespan_days
        , datediff('day', o.last_order_at, current_date)     as days_since_last_order
        , coalesce(s.annual_subscription_value, 0)   as annual_subscription_value
        , coalesce(o.net_revenue, 0)
          + coalesce(s.annual_subscription_value, 0) as estimated_ltv
        , case
            when coalesce(o.net_revenue, 0) > 5000   then 'platinum'
            when coalesce(o.net_revenue, 0) > 1000   then 'gold'
            when coalesce(o.net_revenue, 0) > 200    then 'silver'
            else 'bronze'
          end                                        as ltv_tier
        , case
            when coalesce(o.total_orders, 0) >= 10   then 'high_frequency'
            when coalesce(o.total_orders, 0) >= 3    then 'repeat'
            else 'one_time'
          end                                        as order_frequency_segment
    from customers           as c
    left join order_summary  as o on c.customer_id = o.customer_id
    left join subscriptions  as s on c.customer_id = s.customer_id

)

select * from final
