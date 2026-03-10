with

customers as (

    select * from {{ ref('core_customers') }}

)

, segments as (

    select * from {{ ref('core_customer_segments') }}

)

, mobile as (

    select * from {{ ref('core_mobile_engagement') }}

)

, final as (

    select
          c.customer_id
        , c.customer_email
        , c.full_name
        , c.ltv_tier
        , s.churn_status
        , s.account_size
        , c.total_orders
        , c.gross_revenue
        , c.net_revenue
        , c.estimated_ltv
        , c.first_order_at
        , c.last_order_at
        , c.days_since_last_order
        , c.annual_subscription_value
        , m.total_sessions                           as app_sessions
        , m.active_days                              as app_active_days
        , m.last_seen_at                             as last_app_activity_at
    from customers      as c
    left join segments  as s on c.customer_id = s.customer_id
    left join mobile    as m on cast(c.customer_id as varchar) = m.user_id

)

select * from final
