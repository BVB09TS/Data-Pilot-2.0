with

orders as (

    select * from {{ ref('core_orders') }}

)

, web as (

    select * from {{ ref('core_web_engagement') }}

)

, final as (

    select
          w.traffic_source                           as channel
        , w.device_type
        , count(distinct o.order_id)                 as order_count
        , sum(o.order_total_amount)                  as attributed_revenue
        , count(distinct o.customer_id)              as unique_customers
    from orders         as o
    left join web       as w
        on cast(o.order_created_at as date) = w.session_date
    group by w.traffic_source, w.device_type

)

select * from final
