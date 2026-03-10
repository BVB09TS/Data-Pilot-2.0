with

b2b as (

    select * from {{ ref('core_b2b_accounts') }}

)

, opps as (

    select
          account_id
        , count(case when opportunity_status = 'open' then 1 end) as open_opportunities
        , sum(case when opportunity_status = 'open'
              then weighted_pipeline_value end)      as weighted_pipeline
    from {{ ref('core_opportunities') }}
    group by account_id

)

, final as (

    select
          b.account_id
        , b.account_name
        , b.industry
        , b.annual_revenue
        , b.total_shopmesh_revenue
        , b.purchasing_contacts
        , b.wallet_share
        , coalesce(o.open_opportunities, 0)          as open_opportunities
        , coalesce(o.weighted_pipeline, 0)           as weighted_pipeline_value
        , case
            when b.wallet_share < 0.01               then 'growth_opportunity'
            when b.wallet_share < 0.05               then 'expanding'
            else 'strategic'
          end                                        as account_tier
    from b2b            as b
    left join opps      as o on b.account_id = o.account_id
    order by b.total_shopmesh_revenue desc

)

select * from final
