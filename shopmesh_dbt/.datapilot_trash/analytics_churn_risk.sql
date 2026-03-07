-- PLANTED PROBLEM: DEAD MODEL — superseded by analytics_customer_health, last queried 2024-02-10

with

customers as (

    select * from {{ ref('core_customers') }}

)

, final as (

    select
          customer_id
        , customer_email
        , days_since_last_order
        , total_orders
        , gross_revenue
        , case
            when days_since_last_order > 180     then 'high_risk'
            when days_since_last_order > 90      then 'medium_risk'
            else 'low_risk'
          end                                        as churn_risk_level
    from customers
    where days_since_last_order > 60

)

select * from final
