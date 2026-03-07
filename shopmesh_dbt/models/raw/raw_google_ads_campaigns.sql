with

source as (

    select * from {{ source('google_ads', 'campaigns') }}

)

, final as (

    select
          campaign_id  as campaign_id
        , campaign_name  as campaign_name
        , status  as status
        , daily_budget  as daily_budget_cents
        , start_date  as start_date
        , channel_type  as channel_type
    from source

)

select * from final
