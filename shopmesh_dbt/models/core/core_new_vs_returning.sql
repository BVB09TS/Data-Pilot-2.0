with

orders as (

    select * from {{ ref('src_shopify_orders') }}

)

, first_orders as (

    select
          customer_id
        , min(order_created_at)                      as first_order_at
    from orders
    group by customer_id

)

, final as (

    select
          o.order_id
        , o.customer_id
        , o.order_created_at
        , o.order_total_amount
        , case
            when o.order_created_at = fo.first_order_at then 'new'
            else 'returning'
          end                                        as customer_type
    from orders            as o
    left join first_orders as fo on o.customer_id = fo.customer_id

)

select * from final
