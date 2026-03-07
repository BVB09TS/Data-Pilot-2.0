with

source as (

    select * from {{ source('email_tool', 'events') }}

)

, final as (

    select
          event_id  as event_id
        , campaign_id  as campaign_id
        , customer_email  as customer_email
        , event_type  as event_type
        , event_at  as event_at
        , url_clicked  as url_clicked
    from source

)

select * from final
