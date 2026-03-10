with

geo as (

    select * from {{ ref('core_geographic_revenue') }}

)

, final as (

    select
          approx_country                             as country_code
        , customer_count
        , gross_revenue
        , net_revenue
        , avg_order_value
        , {{ safe_divide('gross_revenue','sum(gross_revenue) over ()') }} as revenue_share_pct
    from geo
    order by gross_revenue desc

)

select * from final
