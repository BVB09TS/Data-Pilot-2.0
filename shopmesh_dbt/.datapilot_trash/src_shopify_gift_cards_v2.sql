-- PLANTED PROBLEM: BROKEN LINEAGE — raw_shopify_gift_cards refs non-existent shopify.gift_cards source

with

source as (

    select * from {{ ref('raw_shopify_gift_cards') }}

)

, final as (

    select
          gift_card_id
        , code
        , cast(balance as decimal(12, 2))            as balance_amount
        , cast(created_at as timestamp)              as issued_at
        , cast(expires_on as date)                   as expires_on
    from source

)

select * from final
