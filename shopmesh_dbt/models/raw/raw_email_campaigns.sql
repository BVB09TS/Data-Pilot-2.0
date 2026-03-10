with

source as (

    select * from {{ source('email_tool', 'campaigns') }}

)

, final as (

    select
          campaign_id  as campaign_id
        , campaign_name  as campaign_name
        , subject_line  as subject_line
        , sent_at  as sent_at
        , campaign_type  as campaign_type
        , total_sent  as total_sent
    from source

)

select * from final
