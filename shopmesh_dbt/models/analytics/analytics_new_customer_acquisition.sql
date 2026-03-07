with

new_orders as (

    select * from {{ ref('core_new_vs_returning') }}
    where customer_type = 'new'

)

, web as (

    select * from {{ ref('core_web_engagement') }}

)

, final as (

    select
          cast(n.order_created_at as date)           as acquisition_date
        , w.traffic_source                           as acquisition_channel
        , count(distinct n.customer_id)              as new_customers
        , sum(n.order_total_amount)                  as new_customer_revenue
        , avg(n.order_total_amount)                  as avg_first_order_value
    from new_orders     as n
    left join web       as w
        on cast(n.order_created_at as date) = w.session_date
    group by cast(n.order_created_at as date), w.traffic_source
    order by acquisition_date desc

)

select * from final
