{% macro surrogate_key(field_list) %}
    md5(cast(concat_ws('-'
        {% for field in field_list %}
            , coalesce(cast({{ field }} as varchar), 'NULL')
        {% endfor %}
    ) as varchar))
{% endmacro %}
