with

opps as (

    select * from {{ ref('src_salesforce_opportunities') }}

)

, accounts as (

    select account_id, account_name, industry, annual_revenue
    from {{ ref('src_salesforce_accounts') }}

)

, final as (

    select
          o.opportunity_id
        , o.account_id
        , a.account_name
        , a.industry
        , o.opportunity_name
        , o.stage
        , o.opportunity_value
        , o.expected_close_date
        , o.win_probability
        , o.opportunity_value
          * (o.win_probability / 100.0)              as weighted_pipeline_value
        , case
            when o.stage = 'Closed Won'              then 'won'
            when o.stage = 'Closed Lost'             then 'lost'
            else 'open'
          end                                        as opportunity_status
    from opps           as o
    left join accounts  as a on o.account_id = a.account_id

)

select * from final
