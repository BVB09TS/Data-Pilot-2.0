with

cohorts as (

    select * from {{ ref('core_cohort_retention') }}

)

select * from cohorts
