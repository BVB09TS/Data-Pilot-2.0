with

source as (

    select * from {{ ref('raw_web_sessions') }}

)

, final as (

    select
          session_id
        , user_id
        , anonymous_id
        , cast(started_at as timestamp)              as session_started_at
        , cast(ended_at as timestamp)                as session_ended_at
        , traffic_source
        , traffic_medium
        , utm_campaign
        , device_type
        , country_code
        , cast(pageview_count as integer)            as pageview_count
        , datediff('second',
              cast(started_at as timestamp),
              cast(ended_at as timestamp))           as session_duration_seconds
    from source

)

select * from final
