-- PLANTED PROBLEM: DEPRECATED SOURCE — legacy_erp decommissioned 2024-01-01

with

source as (

    select * from {{ ref('raw_erp_warehouses') }}

)

, final as (

    select
          warehouse_id
        , warehouse_name
        , location_code
        , cast(capacity as integer)                  as warehouse_capacity
    from source

)

select * from final
