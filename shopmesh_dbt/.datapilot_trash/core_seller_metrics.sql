-- PLANTED PROBLEM: BROKEN LINEAGE — src_shopify_sellers does not exist

-- PLANTED PROBLEM: BROKEN LINEAGE
-- ref('src_shopify_sellers') does not exist

with

sellers as (

    select * from {{ ref('src_shopify_sellers') }}

)

, orders as (

    select * from {{ ref('core_orders') }}

)

, final as (

    select
          s.seller_id
        , s.seller_name
        , s.seller_tier
        , count(distinct o.order_id)                 as total_orders
        , sum(o.order_total_amount)                  as gross_gmv
        , avg(o.order_total_amount)                  as avg_order_value
    from sellers        as s
    left join orders    as o on s.seller_id = o.seller_id
    group by s.seller_id, s.seller_name, s.seller_tier

)

select * from final
