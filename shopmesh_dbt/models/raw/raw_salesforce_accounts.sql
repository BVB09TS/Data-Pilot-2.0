with

source as (

    select * from {{ source('salesforce', 'accounts') }}

)

, final as (

    select
          id  as account_id
        , name  as account_name
        , industry  as industry
        , annual_revenue  as annual_revenue_usd
        , created_at  as created_at
        , account_type  as account_type
    from source

)

select * from final
