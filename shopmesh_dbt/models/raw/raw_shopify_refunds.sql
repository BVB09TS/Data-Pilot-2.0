with

source as (

    select * from {{ source('shopify', 'refunds') }}

)

, final as (

    select
          id  as refund_id
        , order_id  as order_id
        , created_at  as created_at
        , note  as refund_note
    from source

)

select * from final
