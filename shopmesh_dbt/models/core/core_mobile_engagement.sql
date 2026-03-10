with

events as (

    select * from {{ ref('src_mobile_events') }}

)

, session_agg as (

    select
          session_id
        , user_id
        , platform
        , min(event_at)                              as session_start_at
        , max(event_at)                              as session_end_at
        , count(*)                                   as event_count
    from events
    group by session_id, user_id, platform

)

, final as (

    select
          user_id
        , platform
        , count(distinct session_id)                 as total_sessions
        , sum(event_count)                           as total_events
        , min(session_start_at)                      as first_seen_at
        , max(session_end_at)                        as last_seen_at
        , count(distinct cast(session_start_at as date)) as active_days
        , avg(datediff('second', session_start_at, session_end_at)) as avg_session_seconds
    from session_agg
    group by user_id, platform

)

select * from final
