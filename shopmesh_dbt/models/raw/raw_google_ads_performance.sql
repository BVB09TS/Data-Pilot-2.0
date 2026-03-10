with

source as (

    select * from {{ source('google_ads', 'ad_performance') }}

)

, final as (

    select
          campaign_id  as campaign_id
        , date  as report_date
        , impressions  as impressions
        , clicks  as clicks
        , cost  as cost_cents
        , conversions  as conversions
    from source

)

select * from final
