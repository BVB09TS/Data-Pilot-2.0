with

source as (

    select * from {{ source('salesforce', 'opportunities') }}

)

, final as (

    select
          id  as opportunity_id
        , account_id  as account_id
        , name  as opportunity_name
        , stage  as stage
        , amount  as amount_usd
        , close_date  as close_date
        , created_at  as created_at
        , probability  as win_probability
    from source

)

select * from final
