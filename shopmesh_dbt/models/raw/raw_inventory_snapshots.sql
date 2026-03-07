with

source as (

    select * from {{ source('warehouse_ops', 'inventory_snapshots') }}

)

, final as (

    select
          snapshot_id  as snapshot_id
        , variant_id  as variant_id
        , snapshot_date  as snapshot_date
        , quantity  as quantity
        , warehouse_id  as warehouse_id
        , reorder_point  as reorder_point
        , on_order  as units_on_order
    from source

)

select * from final
