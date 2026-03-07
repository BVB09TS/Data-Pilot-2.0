with

source as (

    select * from {{ ref('raw_google_ads_campaigns') }}

)

, final as (

    select
          campaign_id
        , campaign_name
        , status                                         as campaign_status
        , {{ cents_to_dollars('daily_budget_cents') }}   as daily_budget
        , cast(start_date as date)                       as campaign_start_date
        , channel_type
    from source

)

select * from final
