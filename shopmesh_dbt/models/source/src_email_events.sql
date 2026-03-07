with

source as (

    select * from {{ ref('raw_email_events') }}

)

, final as (

    select
          event_id
        , campaign_id
        , customer_email
        , event_type
        , cast(event_at as timestamp)                as event_at
        , url_clicked
    from source

)

select * from final
