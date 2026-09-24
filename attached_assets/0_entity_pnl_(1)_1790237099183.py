"""
Read-only, deterministic Entity P&L reporting.

This route is intentionally separate from Enterprise Data ingestion and the
generic semantic-SQL path. The Node proxy authorizes the cube before a request
can reach this module; this module only reads the selected cube's fact rows and
returns a compact, presentation-ready report.
"""
from __future__ import annotations

import calendar
import logging
from collections import defaultdict
from typing import Any, Dict, List, Literal, Optional, Tuple

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.semantic_sql_service import semantic_sql_service

logger = logging.getLogger(__name__)
router = APIRouter()

ACTUAL_SCENARIO_SQL = "(TRIM(COALESCE(version, 'Actual')) ILIKE 'actual' OR TRIM(COALESCE(version, '')) ILIKE 'act')"
VISIBLE_COST_LINES = [
    ("Employee Benefits", {"employee benefits", "employee benefit"}),
    ("Outsourcing Cost", {"outsourcing cost", "outsourcing costs"}),
    ("Consultancy Charges", {"consultancy charges", "consultancy charge"}),
    (
        "CI Charges & Other Revenue",
        {
            "ci charges & other revenue",
            "ci charges",
            "other revenue sw",
            "revenue software",
            "revenue software ",
        },
    ),
    ("Facilities Cost", {"facilities cost", "facility cost"}),
    ("Other Expenses", {"other expenses", "other expense"}),
]
CAPACITY_LINE_LABELS = [
    "End Capacity On-roll",
    "End Capacity Outsourcing",
    "Total End",
    "Avg Capacity Overall",
    "Avg Capacity Outsourcing",
    "Total Average",
]
CAPACITY_COMPONENT_ON_ROLL = "on_roll"
CAPACITY_COMPONENT_OUTSOURCING = "outsourcing"


class EntityPnlRequest(BaseModel):
    cube_id: str = Field(min_length=1)
    # An empty entity deliberately means "all entity rows in the authorized
    # cube". It is not transformed into an entity <> '' condition, so rows
    # whose source entity is blank remain part of the all-entities total.
    entity: str = Field(default="", max_length=200)
    as_of: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    comparison: Literal["qoq", "yoy"]
    currency: Literal["USD", "INR"] = "USD"
    cf_version: Optional[str] = Field(default=None, max_length=30)


def _previous_month(year: int, month: int, offset: int = 1) -> Tuple[int, int]:
    absolute = year * 12 + month - 1 - offset
    return absolute // 12, absolute % 12 + 1


def _label(year: int, month: int, suffix: str) -> str:
    return f"{calendar.month_abbr[month]} {year} {suffix}"


def _bucket_entity_category(value: str) -> Optional[str]:
    normalized = " ".join((value or "").lower().split())
    for label, aliases in VISIBLE_COST_LINES:
        if normalized in aliases:
            return label
    return None


def _is_revenue_entity_category(value: str) -> bool:
    """Count only explicit Revenue rows; preserve legacy blank categories."""
    normalized = " ".join((value or "").lower().split())
    return normalized in {"", "revenue"}


def _format_amount(value: Optional[float], currency: str) -> str:
    if value is None:
        return "—"
    symbol = "$" if currency == "USD" else "₹"
    return f"{symbol}{value:,.0f}"


def _period_values(
    snapshots: Dict[Tuple[int, int, str, str], float],
    point: Tuple[int, int],
    scenario: str,
    comparison: str,
    line: str,
) -> float:
    year, month = point
    current = snapshots.get((year, month, scenario, line), 0.0)
    if comparison == "qoq":
        prior_year, prior_month = _previous_month(year, month)
        return current - snapshots.get((prior_year, prior_month, scenario, line), 0.0)
    return current


def _capacity_component(resource_type: str, source_sub_category: str) -> Optional[str]:
    """Map governed Internal/External capacity to the Entity P&L presentation."""
    source = " ".join((source_sub_category or "").lower().replace("-", " ").split())
    resource = " ".join((resource_type or "").lower().replace("-", " ").split())
    if source in {"internal", "on roll", "onroll"} or resource in {"internal", "on roll", "onroll"}:
        return CAPACITY_COMPONENT_ON_ROLL
    if source in {"outsourcing", "external"} or resource in {"outsourcing", "external"}:
        return CAPACITY_COMPONENT_OUTSOURCING
    # INDIRECT and unknown resource categories are deliberately out of scope
    # for the requested on-roll / outsourcing capacity presentation.
    return None


def _capacity_values(
    capacity: Dict[Tuple[int, int, str, str], float],
    point: Tuple[int, int],
    comparison: str,
    scenario: str = "actual",
    component: str = CAPACITY_COMPONENT_ON_ROLL,
) -> Tuple[float, float]:
    year, month = point
    end_value = capacity.get((year, month, scenario, component), 0.0)
    # Capacity is a point-in-time measure. Average capacity is the scenario's
    # month-end average year-to-date, never a sum of capacity snapshots.
    months = [capacity.get((year, index, scenario, component), 0.0) for index in range(1, month + 1)]
    available = [value for value in months if value != 0]
    return end_value, (sum(available) / len(available) if available else 0.0)


def _selected_points(request: EntityPnlRequest) -> List[Tuple[int, int]]:
    year, month = map(int, request.as_of.split("-"))
    points = {(year, month)}
    if request.comparison == "qoq":
        points.add(_previous_month(year, month))
        compare = _previous_month(year, month, 3)
        points.add(compare)
        points.add(_previous_month(*compare))
    else:
        points.add((year - 1, month))
        compare = (year - 1, month)
    # Average capacity is a YTD average of month-end values. Pull every month
    # in each displayed year-to-date span rather than averaging only the two
    # comparison snapshots.
    for point_year, point_month in {(year, month), compare, (year - 1, 12)}:
        for index in range(1, point_month + 1):
            points.add((point_year, index))
    return sorted(points)


def _query_entities(cube_id: str) -> List[str]:
    conn = semantic_sql_service.get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT DISTINCT TRIM(region_entity)
              FROM cube_fact_data
             WHERE cube_id = %s
               AND TRIM(COALESCE(region_entity, '')) <> ''
             ORDER BY 1
             LIMIT 500
            """,
            (cube_id,),
        )
        return [row[0] for row in cursor.fetchall() if row[0]]
    finally:
        cursor.close()
        conn.close()


@router.get("/entity-pnl/cubes/{cube_id}/entities")
async def get_entities(cube_id: str):
    """Return only selectable entity names, never fact rows."""
    try:
        return {"entities": _query_entities(cube_id)}
    except Exception as error:
        logger.exception("Entity P&L entity lookup failed")
        raise HTTPException(status_code=500, detail="Could not read entity values for this cube.") from error


@router.post("/entity-pnl/report-data")
async def build_entity_pnl(request: EntityPnlRequest):
    """
    Fetch the selected cube read-only and calculate the governed Entity P&L.

    QoQ derives each MTD amount from consecutive cumulative YTD snapshots.
    YoY uses the two requested cumulative YTD snapshots directly. Forecast
    values are pulled as a distinct scenario and cannot affect Actual totals.
    """
    points = _selected_points(request)
    year, month = map(int, request.as_of.split("-"))
    currency_column = "amount_usd" if request.currency == "USD" else "amount_inr"
    selected_entity = request.entity.strip()

    point_filter = " OR ".join("(year = %s AND month = %s)" for _ in points)
    point_params: List[Any] = [value for point in points for value in point]
    scenario_sql = ACTUAL_SCENARIO_SQL
    scenario_params: List[Any] = []
    if request.cf_version:
        scenario_sql = f"({ACTUAL_SCENARIO_SQL} OR TRIM(COALESCE(version, '')) = %s)"
        scenario_params.append(request.cf_version.strip())

    entity_filter = ""
    entity_params: List[Any] = []
    if selected_entity:
        entity_filter = "AND LOWER(TRIM(COALESCE(region_entity, ''))) = LOWER(TRIM(%s))"
        entity_params.append(selected_entity)

    sql = f"""
        SELECT
          year,
          month,
          CASE
            WHEN {ACTUAL_SCENARIO_SQL} THEN 'actual'
            ELSE TRIM(COALESCE(version, ''))
          END AS scenario,
          TRIM(COALESCE(cost_category, '')) AS cost_category,
          TRIM(COALESCE(entity_category, '')) AS entity_category,
           TRIM(COALESCE(resource_type, '')) AS resource_type,
           TRIM(COALESCE(row_data ->> 'source_sub_category', '')) AS source_sub_category,
          COALESCE(SUM(COALESCE({currency_column}, 0)), 0) AS amount,
          COALESCE(SUM(COALESCE(capacity, 0)), 0) AS capacity
        FROM cube_fact_data
        WHERE cube_id = %s
          {entity_filter}
          AND ({point_filter})
          AND {scenario_sql}
          AND (
            TRIM(COALESCE(cost_category, '')) IN ('Revenue Summary', 'Cost Summary')
            OR TRIM(COALESCE(cost_category, '')) ILIKE '%%END Capacity%%'
          )
        GROUP BY year, month, scenario, cost_category, entity_category, resource_type, source_sub_category
    """

    snapshots: Dict[Tuple[int, int, str, str], float] = defaultdict(float)
    capacity: Dict[Tuple[int, int, str, str], float] = defaultdict(float)
    conn = semantic_sql_service.get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(sql, [request.cube_id, *entity_params, *point_params, *scenario_params])
        rows = cursor.fetchall()
    except Exception as error:
        logger.exception("Entity P&L report query failed")
        raise HTTPException(status_code=500, detail="Could not calculate Entity P&L figures from this cube.") from error
    finally:
        cursor.close()
        conn.close()

    for row in rows:
        (
            row_year,
            row_month,
            scenario,
            cost_category,
            entity_category,
            resource_type,
            source_sub_category,
            amount,
            capacity_value,
        ) = row
        scenario = str(scenario or "").strip()
        if scenario != "actual" and scenario != (request.cf_version or ""):
            continue
        value = float(amount or 0)
        key_prefix = (int(row_year), int(row_month), scenario)
        if "end capacity" in str(cost_category or "").lower():
            component = _capacity_component(str(resource_type or ""), str(source_sub_category or ""))
            if component:
                capacity[(*key_prefix, component)] += float(capacity_value or 0)
            continue
        if cost_category == "Revenue Summary" and _is_revenue_entity_category(entity_category):
            snapshots[(*key_prefix, "Revenue")] += value
        elif cost_category == "Cost Summary":
            # This total deliberately covers every governed Entity P&L cost
            # category, including categories not shown as a visible line.
            snapshots[(*key_prefix, "Total Expenses")] += abs(value)
            visible = _bucket_entity_category(str(entity_category or ""))
            if visible:
                snapshots[(*key_prefix, visible)] += abs(value)

    current_point = (year, month)
    comparison_point = _previous_month(year, month, 3) if request.comparison == "qoq" else (year - 1, month)
    current_label = _label(year, month, "MTD" if request.comparison == "qoq" else "YTD")
    comparison_label = _label(
        comparison_point[0],
        comparison_point[1],
        "MTD" if request.comparison == "qoq" else "YTD",
    )
    columns = [current_label, comparison_label]
    if request.cf_version:
        columns.append(f"{request.cf_version} {'MTD' if request.comparison == 'qoq' else 'YTD'}")
    year_end_point = (year - 1, 12)
    columns.append(_label(*year_end_point, "YE"))

    line_labels = [
        "Revenue",
        *[label for label, _aliases in VISIBLE_COST_LINES],
        "Total Expenses",
        "EBIT",
        "EBIT%",
        *CAPACITY_LINE_LABELS,
    ]
    values: Dict[str, Dict[str, Optional[float]]] = {label: {} for label in line_labels}
    for label in ["Revenue", *[line for line, _ in VISIBLE_COST_LINES], "Total Expenses"]:
        values[label][current_label] = _period_values(snapshots, current_point, "actual", request.comparison, label)
        values[label][comparison_label] = _period_values(snapshots, comparison_point, "actual", request.comparison, label)
        values[label][_label(*year_end_point, "YE")] = _period_values(snapshots, year_end_point, "actual", "yoy", label)
        if request.cf_version:
            values[label][columns[2]] = _period_values(
                snapshots, current_point, request.cf_version, request.comparison, label
            )

    for column in columns:
        revenue = values["Revenue"].get(column) or 0.0
        expenses = values["Total Expenses"].get(column) or 0.0
        ebit = revenue - expenses
        values["EBIT"][column] = ebit
        values["EBIT%"][column] = (ebit / revenue * 100) if revenue else None

    for point, column in [
        (current_point, current_label),
        (comparison_point, comparison_label),
        (year_end_point, _label(*year_end_point, "YE")),
    ]:
        on_roll_end, on_roll_average = _capacity_values(
            capacity, point, request.comparison, component=CAPACITY_COMPONENT_ON_ROLL
        )
        outsourcing_end, outsourcing_average = _capacity_values(
            capacity, point, request.comparison, component=CAPACITY_COMPONENT_OUTSOURCING
        )
        values["End Capacity On-roll"][column] = on_roll_end
        values["End Capacity Outsourcing"][column] = outsourcing_end
        values["Total End"][column] = on_roll_end + outsourcing_end
        values["Avg Capacity Overall"][column] = on_roll_average
        values["Avg Capacity Outsourcing"][column] = outsourcing_average
        values["Total Average"][column] = on_roll_average + outsourcing_average
    if request.cf_version:
        on_roll_end, on_roll_average = _capacity_values(
            capacity,
            current_point,
            request.comparison,
            request.cf_version,
            CAPACITY_COMPONENT_ON_ROLL,
        )
        outsourcing_end, outsourcing_average = _capacity_values(
            capacity,
            current_point,
            request.comparison,
            request.cf_version,
            CAPACITY_COMPONENT_OUTSOURCING,
        )
        values["End Capacity On-roll"][columns[2]] = on_roll_end
        values["End Capacity Outsourcing"][columns[2]] = outsourcing_end
        values["Total End"][columns[2]] = on_roll_end + outsourcing_end
        values["Avg Capacity Overall"][columns[2]] = on_roll_average
        values["Avg Capacity Outsourcing"][columns[2]] = outsourcing_average
        values["Total Average"][columns[2]] = on_roll_average + outsourcing_average

    lines = [{"label": label, "values": {column: values[label].get(column) for column in columns}} for label in line_labels]
    current_revenue = values["Revenue"][current_label] or 0.0
    prior_revenue = values["Revenue"][comparison_label] or 0.0
    current_ebit = values["EBIT"][current_label] or 0.0
    prior_ebit = values["EBIT"][comparison_label] or 0.0
    mode_text = "quarter-end MTD" if request.comparison == "qoq" else "YTD"
    unit = request.currency
    comparison_delta = current_ebit - prior_ebit
    entity_label = selected_entity or "All entities"
    result = {
        "entity": entity_label,
        "asOf": request.as_of,
        "comparison": request.comparison,
        "currency": request.currency,
        "units": unit,
        "columns": columns,
        "lines": lines,
        "evidence": [
            (
                f"Read-only run from the selected Enterprise cube for {entity_label}."
                if selected_entity
                else "Read-only run from the selected Enterprise cube across all entity rows, including blank entity values."
            ),
            f"{mode_text.upper()} comparison: {current_label} versus {comparison_label}.",
            "Total Expenses uses the full governed Cost Summary population; visible expense rows are a presentation subset.",
            "Actual and CF are queried as separate scenarios and are never combined.",
        ],
    }
    return {
        "success": True,
        "result": {
            "summary": (
                f"{entity_label} reported {_format_amount(current_revenue, request.currency)} revenue and "
                f"{_format_amount(current_ebit, request.currency)} EBIT in {current_label}. "
                f"EBIT moved {_format_amount(comparison_delta, request.currency)} from {comparison_label}."
            ),
            "kpis": [
                {
                    "label": f"Revenue · {current_label}",
                    "value": _format_amount(current_revenue, request.currency),
                    "change": _format_amount(current_revenue - prior_revenue, request.currency) + f" vs {comparison_label}",
                    "direction": "up" if current_revenue >= prior_revenue else "down",
                },
                {
                    "label": f"EBIT · {current_label}",
                    "value": _format_amount(current_ebit, request.currency),
                    "change": _format_amount(comparison_delta, request.currency) + f" vs {comparison_label}",
                    "direction": "up" if comparison_delta >= 0 else "down",
                },
                {
                    "label": f"EBIT% · {current_label}",
                    "value": "—" if values["EBIT%"][current_label] is None else f"{values['EBIT%'][current_label]:.1f}%",
                    "direction": "up" if (values["EBIT%"][current_label] or 0) >= (values["EBIT%"][comparison_label] or 0) else "down",
                },
                {
                    "label": "Total End",
                    "value": f"{values['Total End'][current_label]:,.0f}",
                    "change": f"Total average {values['Total Average'][current_label]:,.0f} YTD",
                    "direction": "flat",
                },
            ],
            "charts": [
                {
                    "title": "Revenue, Expenses and EBIT",
                    "type": "bar",
                    "series": [
                        {
                            "name": line,
                            "points": [{"x": column, "y": values[line].get(column) or 0.0} for column in columns[:2]],
                        }
                        for line in ["Revenue", "Total Expenses", "EBIT"]
                    ],
                }
            ],
            "insights": [
                f"Revenue changed by {_format_amount(current_revenue - prior_revenue, request.currency)} between the two selected {mode_text} periods.",
                f"EBIT changed by {_format_amount(comparison_delta, request.currency)}; the report attributes movement only to governed P&L figures.",
            ],
            "commentary": [
                {
                    "area": "Revenue and EBIT",
                    "explanation": (
                        f"{current_label} revenue is {_format_amount(current_revenue, request.currency)} and EBIT is "
                        f"{_format_amount(current_ebit, request.currency)}. Underlying business causes require owner commentary."
                    ),
                    "recurrence": "",
                }
            ],
            "risks": [],
            "tables": [
                {
                    "title": f"Entity P&L · {entity_label}",
                    "columns": ["Line item", *columns],
                    "rows": [
                        [
                            line["label"],
                            *[
                                (
                                    "—"
                                    if line["values"].get(column) is None
                                    else (
                                        f"{line['values'][column]:.1f}%"
                                        if line["label"] == "EBIT%"
                                        else (
                                            f"{line['values'][column]:,.0f}"
                                            if line["label"] in CAPACITY_LINE_LABELS
                                            else _format_amount(line["values"][column], request.currency)
                                        )
                                    )
                                )
                                for column in columns
                            ],
                        ]
                        for line in lines
                    ],
                }
            ],
            "actions": [],
            "entityPnl": result,
        },
    }