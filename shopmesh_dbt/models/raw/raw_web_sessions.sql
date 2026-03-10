with

source as (

    select * from {{ source('web_analytics', 'sessions') }}

)

, final as (

    select
          session_id  as session_id
        , user_id  as user_id
        , anonymous_id  as anonymous_id
        , started_at  as started_at
        , ended_at  as ended_at
        , source  as traffic_source
        , medium  as traffic_medium
        , campaign  as utm_campaign
        , device_type  as device_type
        , country  as country_code
        , pageviews  as pageview_count
    from source

)

select * from final
