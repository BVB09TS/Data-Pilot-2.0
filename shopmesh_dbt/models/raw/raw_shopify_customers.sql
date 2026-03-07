with

source as (

    select * from {{ source('shopify', 'customers') }}

)

, final as (

    select
          id  as customer_id
        , email  as email
        , created_at  as created_at
        , total_spent  as total_spent
        , orders_count  as orders_count
        , tags  as customer_tags
        , first_name  as first_name
        , last_name  as last_name
        , verified_email  as verified_email
    from source

)

select * from final
