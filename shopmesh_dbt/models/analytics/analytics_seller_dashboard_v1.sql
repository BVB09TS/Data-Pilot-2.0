-- PLANTED PROBLEM: DEAD MODEL — seller feature killed, no queries since 2023-10-03

with

sellers as (

    select * from {{ ref('core_seller_metrics') }}

)

select seller_id, seller_name, total_orders, gross_gmv
from sellers
