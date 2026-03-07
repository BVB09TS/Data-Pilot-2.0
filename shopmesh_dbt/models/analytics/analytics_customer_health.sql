with

customers as (

    select * from {{ ref('core_customers') }}

)

, segments as (

    select * from {{ ref('core_customer_segments') }}

)

, final as (

    select
          c.customer_id
        , c.customer_email
        , c.ltv_tier
        , s.churn_status
        , s.account_size
        , c.total_orders
        , c.gross_revenue
        , c.estimated_ltv
        , c.days_since_last_order
        , c.annual_subscription_value
    from customers      as c
    left join segments  as s on c.customer_id = s.customer_id
    order by c.estimated_ltv desc

)

select * from final
