{% macro not_null_proportion(column_name, at_least=0.95) %}
    (sum(case when {{ column_name }} is not null then 1 else 0 end)
     / cast(count(*) as decimal)) >= {{ at_least }}
{% endmacro %}
