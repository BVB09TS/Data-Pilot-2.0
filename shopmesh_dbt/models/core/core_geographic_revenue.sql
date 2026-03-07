with

customers as (

    select customer_id, customer_email
    from {{ ref('core_customers') }}

)

, orders as (

    select customer_id, order_total_amount, net_payment_amount
    from {{ ref('core_orders') }}
    where not is_cancelled

)

, geo as (

    select
          o.customer_id
        , o.order_total_amount
        , o.net_payment_amount
        , case
            when c.customer_email like '%.co.uk' then 'GB'
            when c.customer_email like '%.de'    then 'DE'
            when c.customer_email like '%.fr'    then 'FR'
            when c.customer_email like '%.ca'    then 'CA'
            when c.customer_email like '%.au'    then 'AU'
            else 'US'
          end                                        as approx_country
    from orders         as o
    left join customers as c on o.customer_id = c.customer_id

)

, final as (

    select
          approx_country
        , count(distinct customer_id)                as customer_count
        , sum(order_total_amount)                    as gross_revenue
        , sum(net_payment_amount)                    as net_revenue
        , avg(order_total_amount)                    as avg_order_value
    from geo
    group by approx_country

)

select * from final
