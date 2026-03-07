with

web as (

    select * from {{ ref('core_web_engagement') }}

)

, final as (

    select
          session_date
        , traffic_source
        , traffic_medium
        , device_type
        , country_code
        , session_count
        , unique_visitors
        , avg_session_duration
        , avg_pageviews
        , engaged_sessions
        , {{ safe_divide('engaged_sessions','session_count') }} as engagement_rate
    from web

)

select * from final
