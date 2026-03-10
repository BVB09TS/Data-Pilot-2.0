with

mobile as (

    select * from {{ ref('core_mobile_engagement') }}

)

, final as (

    select
          platform
        , count(distinct user_id)                    as total_users
        , avg(total_sessions)                        as avg_sessions_per_user
        , avg(active_days)                           as avg_active_days
        , avg(avg_session_seconds)                   as avg_session_duration_seconds
        , count(case when datediff('day', last_seen_at, current_date) <= 7
                     then 1 end)                     as dau_7d_users
    from mobile
    group by platform

)

select * from final
