with

sessions as (

    select * from {{ ref('src_web_sessions') }}

)

, final as (

    select
          cast(session_started_at as date)           as session_date
        , traffic_source
        , traffic_medium
        , device_type
        , country_code
        , count(*)                                   as session_count
        , count(distinct coalesce(user_id, anonymous_id)) as unique_visitors
        , avg(session_duration_seconds)              as avg_session_duration
        , avg(pageview_count)                        as avg_pageviews
        , count(case when session_duration_seconds > 60 then 1 end) as engaged_sessions
    from sessions
    group by cast(session_started_at as date), traffic_source, traffic_medium, device_type, country_code

)

select * from final
