with

ad_spend as (

    select
          performance_date
        , sum(ad_spend)                              as daily_spend
    from {{ ref('core_ad_performance') }}
    group by performance_date

)

, new_customers as (

    select
          cast(first_order_at as date)               as acquisition_date
        , count(*)                                   as new_customers
    from {{ ref('core_customers') }}
    group by cast(first_order_at as date)

)

, final as (

    select
          a.performance_date
        , a.daily_spend
        , nc.new_customers
        , {{ safe_divide('a.daily_spend','nc.new_customers') }} as estimated_cac
    from ad_spend           as a
    left join new_customers as nc on a.performance_date = nc.acquisition_date

)

select * from final
