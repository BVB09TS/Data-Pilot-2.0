with

source as (

    select * from {{ source('salesforce', 'contacts') }}

)

, final as (

    select
          id  as contact_id
        , account_id  as account_id
        , email  as email
        , first_name  as first_name
        , last_name  as last_name
        , created_at  as created_at
        , title  as job_title
    from source

)

select * from final
