with

source as (

    select * from {{ ref('raw_email_campaigns') }}

)

, final as (

    select
          campaign_id
        , campaign_name
        , subject_line
        , cast(sent_at as timestamp)                 as sent_at
        , campaign_type
        , cast(total_sent as integer)                as total_sent
    from source

)

select * from final
