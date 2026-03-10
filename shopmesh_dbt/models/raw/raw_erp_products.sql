-- PLANTED PROBLEM: DEPRECATED SOURCE — legacy_erp decommissioned 2024-01-01

with

source as (

    select * from {{ source('legacy_erp', 'products_legacy') }}

)

, final as (

    select
          prod_id  as prod_id
        , prod_name  as prod_name
        , unit_cost  as unit_cost
        , supplier_code  as supplier_code
        , last_updated  as last_updated
    from source

)

select * from final
