-- PLANTED PROBLEM: DEPRECATED SOURCE CHAIN — legacy_erp decommissioned, migration overdue since 2024-03-01

-- PLANTED PROBLEM: DEPRECATED SOURCE CHAIN
-- src_erp_products -> legacy_erp (decommissioned 2024-01-01)

with

erp as (

    select * from {{ ref('src_erp_products') }}

)

, final as (

    select
          legacy_product_id
        , legacy_product_name
        , unit_cost
        , supplier_code
        , last_updated_at
        , 'legacy_erp'                               as data_source
    from erp

)

select * from final
