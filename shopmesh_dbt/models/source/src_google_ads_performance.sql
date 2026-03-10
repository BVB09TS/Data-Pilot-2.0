with

source as (

    select * from {{ ref('raw_google_ads_performance') }}

)

, final as (

    select
          campaign_id
        , cast(report_date as date)                  as performance_date
        , cast(impressions as integer)               as impressions
        , cast(clicks as integer)                    as clicks
        , {{ cents_to_dollars('cost_cents') }}       as ad_spend
        , cast(conversions as integer)               as conversions
        , {{ safe_divide('cast(clicks as decimal)','cast(impressions as decimal)') }} as click_through_rate
    from source

)

select * from final
