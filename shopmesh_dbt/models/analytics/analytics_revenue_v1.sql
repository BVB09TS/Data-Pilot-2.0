with

daily as (

    select * from {{ ref('core_revenue_daily') }}

)

, final as (

    select
          revenue_date
        , total_orders
        , completed_orders
        , gross_revenue                              as total_revenue
        , net_revenue
        , refund_amount
        , avg_order_value
    from daily

)

select * from final
