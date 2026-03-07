with

source as (

    select * from {{ ref('raw_inventory_snapshots') }}

)

, final as (

    select
          snapshot_id
        , variant_id
        , cast(snapshot_date as date)                as snapshot_date
        , cast(quantity as integer)                  as quantity_on_hand
        , warehouse_id
        , cast(reorder_point as integer)             as reorder_point
        , cast(units_on_order as integer)            as units_on_order
    from source

)

select * from final
