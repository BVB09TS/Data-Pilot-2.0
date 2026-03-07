with

customers as (

    select * from {{ ref('core_customers') }}

)

, final as (

    select
          customer_id
        , ltv_tier
        , order_frequency_segment
        , estimated_ltv
        , days_since_last_order
        , case
            when days_since_last_order <= 30     then 'active'
            when days_since_last_order <= 90     then 'at_risk'
            when days_since_last_order <= 180    then 'churning'
            else 'churned'
          end                                        as churn_status
        , case
            when estimated_ltv > 10000           then 'enterprise'
            when estimated_ltv > 2000            then 'mid_market'
            else 'smb'
          end                                        as account_size
    from customers

)

select * from final
