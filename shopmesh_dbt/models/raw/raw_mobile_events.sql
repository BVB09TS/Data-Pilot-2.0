with

source as (

    select * from {{ source('mobile_app', 'events') }}

)

, final as (

    select
          event_id  as event_id
        , user_id  as user_id
        , event_type  as event_type
        , event_timestamp  as event_timestamp
        , session_id  as session_id
        , platform  as platform
        , properties  as properties_json
        , app_version  as app_version
    from source

)

select * from final
