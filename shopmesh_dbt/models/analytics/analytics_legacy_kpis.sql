-- PLANTED PROBLEM: DEAD MODEL — replaced by analytics_executive_kpis, last queried 2023-12-15

with

revenue as (

    select * from {{ ref('analytics_revenue_v1') }}

)

, customers as (

    select count(*) as total_customers from {{ ref('core_customers') }}

)

select r.revenue_date, r.total_revenue, r.total_orders, c.total_customers
from revenue    as r
cross join customers as c
