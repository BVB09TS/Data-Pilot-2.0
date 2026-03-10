with

orders as (

    select * from {{ ref('src_shopify_orders') }}

)

, payments as (

    select * from {{ ref('src_stripe_payments') }}

)

, items_agg as (

    select
          order_id
        , sum(gross_line_amount)                     as total_items_gross
        , sum(discount_amount)                       as total_discount_amount
        , count(*)                                   as line_item_count
    from {{ ref('src_shopify_order_items') }}
    group by order_id

)

, final as (

    select
          o.order_id
        , o.customer_id
        , o.order_created_at
        , cast(o.order_created_at as date)           as order_date
        , date_trunc('week',  o.order_created_at)    as order_week
        , date_trunc('month', o.order_created_at)    as order_month
        , o.order_total_amount
        , o.financial_status
        , o.fulfillment_status
        , o.is_cancelled
        , o.currency
        , p.payment_id
        , p.payment_amount
        , p.net_payment_amount
        , p.refunded_amount
        , p.payment_method
        , i.total_items_gross
        , i.total_discount_amount
        , i.line_item_count
    from orders         as o
    left join payments  as p on o.order_id = p.order_id
    left join items_agg as i on o.order_id = i.order_id

)

select * from final
