{% macro is_valid_email(column_name) %}
    {{ column_name }} like '%@%.%'
    and {{ column_name }} not like '% %'
    and length({{ column_name }}) > 5
{% endmacro %}
