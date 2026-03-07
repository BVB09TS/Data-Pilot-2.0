-- PLANTED PROBLEM: ORPHANED — superseded by deriving sessions from raw_mobile_events

with

source as (

    select * from {{ source('mobile_app', 'sessions') }}

)

, final as (

    select
          session_id  as session_id
        , user_id  as user_id
        , started_at  as started_at
        , ended_at  as ended_at
        , event_count  as event_count
    from source

)

select * from final
