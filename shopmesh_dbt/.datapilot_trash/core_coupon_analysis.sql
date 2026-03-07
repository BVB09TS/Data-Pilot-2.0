-- PLANTED PROBLEM: ORPHANED — Q2 2023 promo analysis, no downstream refs

-- PLANTED PROBLEM: ORPHANED — one-time Q2 2023 promo analysis

with

order_items as (

    select * from {{ ref('src_shopify_order_items') }}

)

, final as (

    select
          order_id
        , sum(discount_amount)                       as total_discount
        , sum(gross_line_amount)                     as pre_discount_value
        , {{ safe_divide('sum(discount_amount)','sum(gross_line_amount)') }} as discount_rate
    from order_items
    where discount_amount > 0
    group by order_id

)

select * from final
