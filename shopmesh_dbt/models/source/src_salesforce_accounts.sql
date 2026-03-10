with

source as (

    select * from {{ ref('raw_salesforce_accounts') }}

)

, final as (

    select
          account_id
        , account_name
        , industry
        , cast(annual_revenue_usd as decimal(15, 2)) as annual_revenue
        , cast(created_at as timestamp)              as account_created_at
        , account_type
    from source

)

select * from final
