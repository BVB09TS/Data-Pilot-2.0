with

source as (

    select * from {{ ref('raw_mobile_events') }}

)

, final as (

    select
          event_id
        , user_id
        , event_type
        , cast(event_timestamp as timestamp)         as event_at
        , session_id
        , platform
        , properties_json
        , app_version
    from source

)

select * from final
