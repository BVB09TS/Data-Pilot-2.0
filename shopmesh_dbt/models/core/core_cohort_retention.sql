with

cohort_base as (

    select
          customer_id
        , date_trunc('month', first_order_at)        as cohort_month
    from {{ ref('core_customers') }}
    where first_order_at is not null

)

, orders as (

    select customer_id, order_created_at, order_total_amount
    from {{ ref('core_orders') }}
    where not is_cancelled

)

, cohort_orders as (

    select
          cb.cohort_month
        , cb.customer_id
        , datediff('month', cb.cohort_month,
              date_trunc('month', o.order_created_at)) as months_since_cohort
        , o.order_total_amount
    from cohort_base    as cb
    left join orders    as o on cb.customer_id = o.customer_id

)

, final as (

    select
          cohort_month
        , months_since_cohort
        , count(distinct customer_id)                as active_customers
        , sum(order_total_amount)                    as cohort_revenue
    from cohort_orders
    group by cohort_month, months_since_cohort

)

select * from final
