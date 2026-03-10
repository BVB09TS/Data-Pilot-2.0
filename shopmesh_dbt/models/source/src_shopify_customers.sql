with

source as (

    select * from {{ ref('raw_shopify_customers') }}

)

, final as (

    select
          customer_id
        , email                                      as customer_email
        , first_name
        , last_name
        , trim(first_name || ' ' || last_name)       as full_name
        , cast(created_at as timestamp)              as customer_created_at
        , cast(total_spent as decimal(12, 2))        as lifetime_spend_shopify
        , cast(orders_count as integer)              as shopify_order_count
        , customer_tags
        , cast(verified_email as boolean)            as is_email_verified
    from source

)

select * from final
