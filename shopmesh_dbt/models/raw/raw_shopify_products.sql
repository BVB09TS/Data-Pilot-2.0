with

source as (

    select * from {{ source('shopify', 'products') }}

)

, final as (

    select
          id  as product_id
        , title  as title
        , vendor  as vendor
        , product_type  as product_type
        , created_at  as created_at
        , status  as status
        , tags  as product_tags
    from source

)

select * from final
