with

refunds as (

    select * from {{ ref('core_refunds') }}

)

, final as (

    select
          cast(refunded_at as date)                  as refund_date
        , refund_reason
        , refund_timing
        , count(*)                                   as refund_count
        , sum(refund_amount)                         as total_refunded
        , avg(days_to_refund)                        as avg_days_to_refund
        , avg(refund_rate)                           as avg_refund_rate
    from refunds
    group by cast(refunded_at as date), refund_reason, refund_timing
    order by refund_date desc

)

select * from final
