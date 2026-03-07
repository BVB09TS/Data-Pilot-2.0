with

ad_perf as (

    select * from {{ ref('core_ad_performance') }}

)

, final as (

    select
          date_trunc('week', performance_date)       as report_week
        , sum(impressions)                           as total_impressions
        , sum(clicks)                                as total_clicks
        , sum(ad_spend)                              as total_spend
        , sum(conversions)                           as total_conversions
        , avg(click_through_rate)                    as avg_ctr
        , {{ safe_divide('sum(ad_spend)','sum(conversions)') }} as blended_cpa
    from ad_perf
    group by date_trunc('week', performance_date)
    order by report_week desc

)

select * from final
