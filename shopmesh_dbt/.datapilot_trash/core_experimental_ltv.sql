-- PLANTED PROBLEM: ORPHANED — superseded by core_customers.estimated_ltv

-- PLANTED PROBLEM: ORPHANED — hackathon experiment

with

customers as (

    select customer_id, gross_revenue, customer_lifespan_days
    from {{ ref('core_customers') }}

)

, final as (

    select
          customer_id
        , gross_revenue
        , gross_revenue * 2.5                        as experimental_ltv
        , {{ safe_divide('gross_revenue','nullif(customer_lifespan_days,0)') }}
          * 365                                      as annualised_revenue_rate
    from customers

)

select * from final
