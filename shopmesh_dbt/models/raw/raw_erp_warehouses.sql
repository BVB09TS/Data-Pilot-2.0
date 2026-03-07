-- PLANTED PROBLEM: DEPRECATED SOURCE — legacy_erp decommissioned 2024-01-01

with

source as (

    select * from {{ source('legacy_erp', 'warehouses_legacy') }}

)

, final as (

    select
          warehouse_id  as warehouse_id
        , warehouse_name  as warehouse_name
        , location_code  as location_code
        , capacity  as capacity
    from source

)

select * from final
