with

refunds as (

    select * from {{ ref('src_stripe_refunds') }}

)

, payments as (

    select * from {{ ref('src_stripe_payments') }}

)

, orders as (

    select order_id, customer_id, order_created_at, order_total_amount
    from {{ ref('core_orders') }}

)

, final as (

    select
          r.refund_id
        , r.payment_id
        , p.order_id
        , o.customer_id
        , r.refund_amount
        , r.refund_reason
        , r.refunded_at
        , o.order_created_at
        , o.order_total_amount                       as original_order_amount
        , datediff('day', o.order_created_at, r.refunded_at) as days_to_refund
        , {{ safe_divide('r.refund_amount','o.order_total_amount') }} as refund_rate
        , case
            when datediff('day', o.order_created_at, r.refunded_at) <= 7  then 'immediate'
            when datediff('day', o.order_created_at, r.refunded_at) <= 30 then 'standard'
            else 'late'
          end                                        as refund_timing
    from refunds        as r
    left join payments  as p on r.payment_id = p.payment_id
    left join orders    as o on p.order_id = o.order_id

)

select * from final
