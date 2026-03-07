{% macro union_relations(relations) %}
    {% for relation in relations %}
        select * from {{ relation }}
        {% if not loop.last %} union all {% endif %}
    {% endfor %}
{% endmacro %}
