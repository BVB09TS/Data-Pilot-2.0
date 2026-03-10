with

performance as (

    select * from {{ ref('src_google_ads_performance') }}

)

, campaigns as (

    select * from {{ ref('src_google_ads_campaigns') }}

)

, final as (

    select
          p.campaign_id
        , p.performance_date
        , c.campaign_name
        , c.campaign_status
        , c.channel_type
        , p.impressions
        , p.clicks
        , p.ad_spend
        , p.conversions
        , p.click_through_rate
        , {{ safe_divide('p.ad_spend','p.clicks') }}        as cost_per_click
        , {{ safe_divide('p.ad_spend','p.conversions') }}   as cost_per_conversion
    from performance    as p
    left join campaigns as c on p.campaign_id = c.campaign_id

)

select * from final
