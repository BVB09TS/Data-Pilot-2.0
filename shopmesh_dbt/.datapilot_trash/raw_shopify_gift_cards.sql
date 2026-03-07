-- PLANTED PROBLEM: ORPHANED — gift card feature paused, no downstream refs

with

source as (

    select * from {{ source('shopify', 'gift_cards') }}

)

, final as (

    select
          id  as gift_card_id
        , code  as code
        , balance  as balance
        , created_at  as created_at
        , expires_on  as expires_on
    from source

)

select * from final
