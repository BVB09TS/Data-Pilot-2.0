with

source as (

    select * from {{ ref('raw_shopify_products') }}

)

, final as (

    select
          product_id
        , title                                      as product_name
        , vendor                                     as product_vendor
        , product_type
        , cast(created_at as timestamp)              as product_created_at
        , status                                     as product_status
        , product_tags
    from source

)

select * from final
