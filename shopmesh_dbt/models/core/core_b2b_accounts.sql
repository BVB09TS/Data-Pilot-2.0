with

sf_accounts as (

    select * from {{ ref('src_salesforce_accounts') }}

)

, sf_contacts as (

    select * from {{ ref('src_salesforce_contacts') }}

)

, customers as (

    select * from {{ ref('core_customers') }}

)

, matched as (

    select
          sa.account_id
        , sa.account_name
        , sa.industry
        , sa.annual_revenue
        , sa.account_type
        , cust.customer_id
        , cust.gross_revenue
        , cust.net_revenue
        , cust.total_orders
    from sf_contacts            as sc
    left join sf_accounts       as sa   on sc.account_id = sa.account_id
    left join customers         as cust on sc.contact_email = cust.customer_email

)

, final as (

    select
          account_id
        , account_name
        , industry
        , annual_revenue
        , account_type
        , sum(gross_revenue)                         as total_shopmesh_revenue
        , sum(net_revenue)                           as total_net_revenue
        , sum(total_orders)                          as total_orders
        , count(distinct customer_id)                as purchasing_contacts
        , {{ safe_divide('sum(gross_revenue)','max(annual_revenue)') }} as wallet_share
    from matched
    group by account_id, account_name, industry, annual_revenue, account_type

)

select * from final
