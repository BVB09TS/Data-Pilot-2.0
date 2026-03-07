-- PLANTED PROBLEM: DEPRECATED SOURCE — legacy_erp decommissioned 2024-01-01

with

source as (

    select * from {{ ref('raw_erp_products') }}

)

, final as (

    select
          prod_id                                    as legacy_product_id
        , prod_name                                  as legacy_product_name
        , cast(unit_cost as decimal(12, 2))          as unit_cost
        , supplier_code
        , cast(last_updated as timestamp)            as last_updated_at
    from source

)

select * from final
