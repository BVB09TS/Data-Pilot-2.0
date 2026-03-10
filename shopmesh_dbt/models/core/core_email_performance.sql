with

campaigns as (

    select * from {{ ref('src_email_campaigns') }}

)

, event_agg as (

    select
          campaign_id
        , count(case when event_type = 'opened'       then 1 end) as opens
        , count(case when event_type = 'clicked'      then 1 end) as clicks
        , count(case when event_type = 'bounced'      then 1 end) as bounces
        , count(case when event_type = 'unsubscribed' then 1 end) as unsubscribes
    from {{ ref('src_email_events') }}
    group by campaign_id

)

, final as (

    select
          c.campaign_id
        , c.campaign_name
        , c.campaign_type
        , c.sent_at
        , c.total_sent
        , ea.opens
        , ea.clicks
        , ea.bounces
        , ea.unsubscribes
        , {{ safe_divide('ea.opens','c.total_sent') }}        as open_rate
        , {{ safe_divide('ea.clicks','ea.opens') }}           as click_to_open_rate
        , {{ safe_divide('ea.unsubscribes','c.total_sent') }} as unsubscribe_rate
    from campaigns      as c
    left join event_agg as ea on c.campaign_id = ea.campaign_id

)

select * from final
