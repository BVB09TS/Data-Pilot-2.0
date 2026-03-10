with

source as (

    select * from {{ ref('raw_salesforce_opportunities') }}

)

, final as (

    select
          opportunity_id
        , account_id
        , opportunity_name
        , stage
        , cast(amount_usd as decimal(15, 2))         as opportunity_value
        , cast(close_date as date)                   as expected_close_date
        , cast(created_at as timestamp)              as opportunity_created_at
        , cast(win_probability as integer)           as win_probability
    from source

)

select * from final
