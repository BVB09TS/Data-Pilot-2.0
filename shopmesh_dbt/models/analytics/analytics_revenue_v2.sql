with

combined as (

    select * from {{ ref('core_revenue_combined') }}

)

, final as (

    select
          revenue_date
        , order_revenue
        , subscription_revenue
        , total_revenue
        , net_order_revenue
    from combined

)

select * from final
