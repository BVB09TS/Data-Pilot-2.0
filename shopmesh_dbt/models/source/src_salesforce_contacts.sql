with

source as (

    select * from {{ ref('raw_salesforce_contacts') }}

)

, final as (

    select
          contact_id
        , account_id
        , email                                      as contact_email
        , first_name
        , last_name
        , trim(first_name || ' ' || last_name)       as full_name
        , cast(created_at as timestamp)              as contact_created_at
        , job_title
    from source

)

select * from final
