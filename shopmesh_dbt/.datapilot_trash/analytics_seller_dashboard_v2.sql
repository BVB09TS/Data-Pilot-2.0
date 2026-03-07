-- PLANTED PROBLEM: DEAD MODEL — never used, seller feature killed before launch

with

sellers as (

    select * from {{ ref('core_seller_metrics') }}

)

select seller_id, seller_name, total_orders, gross_gmv, 'v2' as version
from sellers
