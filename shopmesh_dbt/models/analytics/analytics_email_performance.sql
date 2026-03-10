with

email_perf as (

    select * from {{ ref('core_email_performance') }}

)

select
      campaign_id
    , campaign_name
    , campaign_type
    , sent_at
    , total_sent
    , opens
    , clicks
    , bounces
    , unsubscribes
    , open_rate
    , click_to_open_rate
    , unsubscribe_rate
from email_perf
order by sent_at desc
