#!/usr/bin/env python3
"""
LedgerLM — 100 Query Regression Test
======================================
Data coverage: Jan 2025 – Dec 2025  AND  Jan 2026 – Mar 2026

Sections
--------
 1. Revenue — date variants        (20 cases)
 2. Other KPI metrics              (10 cases)
 3. Cost metrics                   ( 8 cases)
 4. GB P&L — date variants         (12 cases)
 5. Entity P&L — date variants     (12 cases)
 6. Month on Month (MoM)           (10 cases)
 7. Year Comparison 2025 vs 2026   ( 8 cases)
 8. Last-N months + Avg Monthly    (10 cases)
 9. Entity-specific queries        (10 cases)
                                  ─────────
                                   100 total

Usage
-----
    cd /home/runner/workspace/ledgerlm/ledgerlm/python_backend
    python3 test_100_queries.py                    # all 100
    python3 test_100_queries.py --section 1        # section 1 only
    python3 test_100_queries.py --section 6        # MoM section
    python3 test_100_queries.py --query "..."      # single ad-hoc query
    python3 test_100_queries.py --no-sql           # intent flags only, no SQL compile
"""

import sys, os, re, json, argparse, textwrap
from datetime import datetime

# ── colours ────────────────────────────────────────────────────────────────────
GREEN  = "\033[92m"; RED    = "\033[91m"; YELLOW = "\033[93m"
CYAN   = "\033[96m"; BOLD   = "\033[1m";  RESET  = "\033[0m"

def ok(m):     print(f"  {GREEN}✅  {m}{RESET}")
def fail(m):   print(f"  {RED}❌  {m}{RESET}")
def warn(m):   print(f"  {YELLOW}⚠️   {m}{RESET}")
def info(m):   print(f"  {CYAN}ℹ️   {m}{RESET}")
def header(m): print(f"\n{BOLD}{CYAN}{'─'*76}\n  {m}\n{'─'*76}{RESET}")
def sub(m):    print(f"\n  {BOLD}🔹 {m}{RESET}")

# ── bootstrap ──────────────────────────────────────────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DATABASE_URL", os.environ.get("DATABASE_URL", ""))

from services.semantic_sql_service import (
    SemanticSQLService,
    detect_mom_intent,
    detect_avg_monthly_intent,
    detect_comparison_query,
    is_gb_pl_query,
    is_entity_pl_query,
    detect_entity_category_from_query,
)

SVC     = SemanticSQLService()
CUBE_ID = "526c3389-68e2-4028-9a15-aa1c00e12d29"
DOMAIN  = "bosch.com"

# ── helpers ────────────────────────────────────────────────────────────────────

SHOW_SQL = True          # toggled by --no-sql flag


def _compile(intent: dict) -> dict:
    try:
        return SVC.compile_sql(intent, CUBE_ID, domain=DOMAIN)
    except Exception as e:
        return {"success": False, "error": str(e)}


def _show_sql(result: dict):
    if not SHOW_SQL:
        return
    if not result.get("success"):
        fail(f"compile_sql failed: {result.get('error', 'unknown')}")
        return
    sql    = result.get("sql") or result.get("generated_sql") or ""
    params = result.get("params") or result.get("parameters") or []
    if sql:
        ok("SQL generated")
        for line in sql.strip().splitlines():
            print(f"       {line}")
        if params:
            info(f"Params: {params}")
    else:
        warn("No 'sql' key — raw result:")
        for k, v in result.items():
            if k != "intent":
                print(f"       {k}: {v}")


def _flags(intent: dict):
    keys = ("mom_mode","avg_monthly_mode","comparison_mode","mom_lag_mode",
            "use_calculation","query_type","group_by","filters",
            "year","month","entity_category")
    flags = {k: intent[k] for k in keys if intent.get(k) is not None}
    info(f"Intent: {json.dumps(flags, default=str)}")


def run_case(label: str, query: str, intent: dict):
    sub(label)
    print(f"\n  {BOLD}Query :{RESET} {query}")
    _flags(intent)
    result = _compile(intent)
    _show_sql(result)
    return result


# ── intent factory helpers ─────────────────────────────────────────────────────

def with_defaults(intent: dict) -> dict:
    return SVC.apply_default_time_filters(intent, CUBE_ID, "default")


def kpi(query: str, calc: str = "Revenue", filters=None) -> dict:
    return SVC._build_kpi_intent_fast(query, calc, filters or [], None)


def gbpl(query: str) -> dict:
    return SVC._build_gb_pl_cost_breakdown_intent(query)


def entitypl(query: str) -> dict:
    cat = detect_entity_category_from_query(query)
    return SVC._build_entity_pl_intent(query, cat)


def auto(query: str) -> dict:
    if is_gb_pl_query(query):
        return with_defaults(gbpl(query))
    if is_entity_pl_query(query):
        return with_defaults(entitypl(query))
    return with_defaults(kpi(query, "Revenue"))


def lastn(query: str, calc: str = "Revenue") -> dict:
    intent = kpi(query, calc)
    try:
        intent = SVC._detect_last_n_months_and_inject(intent, CUBE_ID, query)
    except Exception as e:
        warn(f"_detect_last_n_months_and_inject: {e}")
    return intent


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — REVENUE: DATE VARIANTS  (20 cases)
# Data: Jan–Dec 2025  +  Jan–Mar 2026
# ══════════════════════════════════════════════════════════════════════════════

def section_1():
    header("SECTION 1 — Revenue: Date Variants  (20 cases)")
    warn("Full 2025 and partial 2026 (Jan–Mar) are expected to return data on Azure.")
    warn("Replit local DB has Jan 2026 only — SQL is correct, result set will be partial.")
    print()

    cases = [
        # ── No explicit date (auto-default) ──────────────────────────────────
        ("1.01  Revenue — no date specified (auto-defaults to latest year)",
         "show me revenue",
         lambda q: with_defaults(kpi(q))),

        # ── Full-year 2025 ────────────────────────────────────────────────────
        ("1.02  Revenue — full year 2025",
         "show me revenue for 2025",
         lambda q: kpi(q)),
        ("1.03  Revenue — by month 2025",
         "show me revenue by month for 2025",
         lambda q: kpi(q)),
        ("1.04  Revenue — by Planning GB 2025",
         "show me revenue by planning GB for 2025",
         lambda q: kpi(q)),
        ("1.05  Revenue — by Project GB 2025",
         "show me revenue by project GB for 2025",
         lambda q: kpi(q)),
        ("1.06  Revenue — Onsite vs Offshore 2025",
         "show me onsite and offshore revenue for 2025",
         lambda q: kpi(q)),
        ("1.07  Revenue — by SDS 2025",
         "show me revenue by SDS for 2025",
         lambda q: kpi(q)),
        ("1.08  Revenue — by Org Level 2025",
         "show me revenue by organization level for 2025",
         lambda q: kpi(q)),
        ("1.09  Revenue — Fixed Price and T&M 2025",
         "show me fixed price and TM revenue for 2025",
         lambda q: kpi(q)),

        # ── Specific months 2025 ──────────────────────────────────────────────
        ("1.10  Revenue — January 2025",
         "show me revenue for January 2025",
         lambda q: kpi(q)),
        ("1.11  Revenue — March 2025",
         "show me revenue for March 2025",
         lambda q: kpi(q)),
        ("1.12  Revenue — June 2025",
         "show me revenue for June 2025",
         lambda q: kpi(q)),
        ("1.13  Revenue — December 2025",
         "show me revenue for December 2025",
         lambda q: kpi(q)),

        # ── Month ranges 2025 ─────────────────────────────────────────────────
        ("1.14  Revenue — Jan to Mar 2025 (Q1 range)",
         "show me revenue from January to March 2025",
         lambda q: kpi(q)),
        ("1.15  Revenue — Apr to Jun 2025 (Q2 range)",
         "show me revenue from April to June 2025",
         lambda q: kpi(q)),
        ("1.16  Revenue — Jul to Sep 2025 (Q3 range)",
         "show me revenue from July to September 2025",
         lambda q: kpi(q)),
        ("1.17  Revenue — Oct to Dec 2025 (Q4 range)",
         "show me revenue from October to December 2025",
         lambda q: kpi(q)),

        # ── Quarter aliases 2025 ──────────────────────────────────────────────
        ("1.18  Revenue — Q2 2025",
         "show me revenue for Q2 2025",
         lambda q: kpi(q)),
        ("1.19  Revenue — Q4 2025",
         "show me revenue for Q4 2025",
         lambda q: kpi(q)),

        # ── 2026 (Jan–Mar data available) ─────────────────────────────────────
        ("1.20  Revenue — Q1 2026  (Jan–Mar 2026, full data available)",
         "show me revenue for Q1 2026",
         lambda q: kpi(q)),
    ]

    for label, query, builder in cases:
        run_case(label, query, builder(query))


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — OTHER KPI METRICS  (10 cases)
# ══════════════════════════════════════════════════════════════════════════════

def section_2():
    header("SECTION 2 — Other KPI Metrics  (10 cases)")
    print()

    cases = [
        ("2.01  Headcount — full year 2025",
         "show me headcount for 2025",
         lambda q: kpi(q, "Headcount")),
        ("2.02  Headcount — Q1 2026",
         "show me headcount for Q1 2026",
         lambda q: kpi(q, "Headcount")),
        ("2.03  Headcount — Jan to Mar 2026",
         "show me headcount from January to March 2026",
         lambda q: kpi(q, "Headcount")),
        ("2.04  Billing Utilization — full year 2025",
         "show me billing utilization for 2025",
         lambda q: kpi(q, "Billing Utilization")),
        ("2.05  Billing Utilization — Q1 2026",
         "show me billing utilization for Q1 2026",
         lambda q: kpi(q, "Billing Utilization")),
        ("2.06  EBIT — full year 2025",
         "show me EBIT for 2025",
         lambda q: kpi(q, "EBIT")),
        ("2.07  EBIT — Q1 2026",
         "show me EBIT for Q1 2026",
         lambda q: kpi(q, "EBIT")),
        ("2.08  Gross Margin — full year 2025",
         "show me gross margin for 2025",
         lambda q: kpi(q, "Gross Margin")),
        ("2.09  Gross Margin — Q1 2026",
         "show me gross margin for Q1 2026",
         lambda q: kpi(q, "Gross Margin")),
        ("2.10  Price Mix — full year 2025",
         "show me price mix for 2025",
         lambda q: kpi(q, "Price Mix")),
    ]

    for label, query, builder in cases:
        run_case(label, query, builder(query))


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — COST METRICS  (8 cases)
# ══════════════════════════════════════════════════════════════════════════════

def section_3():
    header("SECTION 3 — Cost Metrics  (8 cases)")
    print()

    cases = [
        ("3.01  Direct Cost — full year 2025",
         "show me direct cost for 2025",
         lambda q: kpi(q, "Direct Cost")),
        ("3.02  Direct Cost — Q1 2026",
         "show me direct cost for Q1 2026",
         lambda q: kpi(q, "Direct Cost")),
        ("3.03  Indirect Cost — full year 2025",
         "show me indirect cost for 2025",
         lambda q: kpi(q, "Indirect Cost")),
        ("3.04  Indirect Cost — Q1 2026",
         "show me indirect cost for Q1 2026",
         lambda q: kpi(q, "Indirect Cost")),
        ("3.05  Resource Cost — full year 2025",
         "show me resource cost for 2025",
         lambda q: kpi(q, "Resource Cost")),
        ("3.06  Resource Cost — Jan to Mar 2026",
         "show me resource cost from January to March 2026",
         lambda q: kpi(q, "Resource Cost")),
        ("3.07  Travel Cost — full year 2025",
         "show me travel cost for 2025",
         lambda q: kpi(q, "Travel Cost")),
        ("3.08  Attrition — full year 2025",
         "show me attrition for 2025",
         lambda q: kpi(q, "Attrition")),
    ]

    for label, query, builder in cases:
        run_case(label, query, builder(query))


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — GB P&L: DATE VARIANTS  (12 cases)
# ══════════════════════════════════════════════════════════════════════════════

def section_4():
    header("SECTION 4 — GB P&L: Date Variants  (12 cases)")
    print()

    cases = [
        # No date
        ("4.01  GB P&L — no date (auto-defaults)",
         "show me GB P&L",
         lambda q: with_defaults(gbpl(q))),

        # Full-year 2025
        ("4.02  GB P&L — full year 2025",
         "show me GB P&L for 2025",
         lambda q: gbpl(q)),
        ("4.03  GB P&L — by month 2025",
         "show me GB P&L by month for 2025",
         lambda q: gbpl(q)),
        ("4.04  GB P&L — by Planning GB 2025",
         "show me GB P&L by planning GB for 2025",
         lambda q: gbpl(q)),
        ("4.05  GB P&L — by Project GB 2025",
         "show me GB P&L by project GB for 2025",
         lambda q: gbpl(q)),

        # Specific months 2025
        ("4.06  GB P&L — January 2025",
         "show me GB P&L for January 2025",
         lambda q: gbpl(q)),
        ("4.07  GB P&L — Jun 2025",
         "show me GB P&L for June 2025",
         lambda q: gbpl(q)),
        ("4.08  GB P&L — Dec 2025",
         "show me GB P&L for December 2025",
         lambda q: gbpl(q)),

        # Month ranges 2025
        ("4.09  GB P&L — Jan to Mar 2025",
         "show me GB P&L from January to March 2025",
         lambda q: gbpl(q)),
        ("4.10  GB P&L — Jul to Dec 2025  (H2 2025)",
         "show me GB P&L from July to December 2025",
         lambda q: gbpl(q)),

        # Quarter 2025
        ("4.11  GB P&L — Q3 2025",
         "show me GB P&L for Q3 2025",
         lambda q: gbpl(q)),

        # 2026 data (Jan–Mar)
        ("4.12  GB P&L — Q1 2026  (Jan–Mar 2026)",
         "show me GB P&L for Q1 2026",
         lambda q: gbpl(q)),
    ]

    for label, query, builder in cases:
        run_case(label, query, builder(query))


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — ENTITY P&L: DATE VARIANTS  (12 cases)
# ══════════════════════════════════════════════════════════════════════════════

def section_5():
    header("SECTION 5 — Entity P&L: Date Variants  (12 cases)")
    print()

    cases = [
        # No date
        ("5.01  Entity P&L — no date (auto-defaults)",
         "show me entity P&L",
         lambda q: with_defaults(entitypl(q))),

        # Full-year 2025
        ("5.02  Entity P&L — full year 2025",
         "show me entity P&L for 2025",
         lambda q: entitypl(q)),
        ("5.03  Entity P&L — by month 2025",
         "show me entity P&L by month for 2025",
         lambda q: entitypl(q)),

        # Specific months 2025
        ("5.04  Entity P&L — January 2025",
         "show me entity P&L for January 2025",
         lambda q: entitypl(q)),
        ("5.05  Entity P&L — June 2025",
         "show me entity P&L for June 2025",
         lambda q: entitypl(q)),
        ("5.06  Entity P&L — December 2025",
         "show me entity P&L for December 2025",
         lambda q: entitypl(q)),

        # Month ranges 2025
        ("5.07  Entity P&L — Jan to Mar 2025",
         "show me entity P&L from January to March 2025",
         lambda q: entitypl(q)),
        ("5.08  Entity P&L — Apr to Jun 2025  (Q2)",
         "show me entity P&L from April to June 2025",
         lambda q: entitypl(q)),
        ("5.09  Entity P&L — Jul to Sep 2025  (Q3)",
         "show me entity P&L from July to September 2025",
         lambda q: entitypl(q)),
        ("5.10  Entity P&L — Oct to Dec 2025  (Q4)",
         "show me entity P&L from October to December 2025",
         lambda q: entitypl(q)),

        # Quarters 2025
        ("5.11  Entity P&L — Q4 2025",
         "show me entity P&L for Q4 2025",
         lambda q: entitypl(q)),

        # 2026 data (Jan–Mar)
        ("5.12  Entity P&L — Q1 2026  (Jan–Mar 2026)",
         "show me entity P&L for Q1 2026",
         lambda q: entitypl(q)),
    ]

    for label, query, builder in cases:
        run_case(label, query, builder(query))


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 6 — MONTH ON MONTH (MoM)  (10 cases)
# ══════════════════════════════════════════════════════════════════════════════

def section_6():
    header("SECTION 6 — Month on Month (MoM)  (10 cases)")
    warn("Full MoM growth % requires ≥2 consecutive months. On Azure 2025 (12 months) = fully populated.")
    warn("On Replit local (Jan 2026 only) — SQL is correct but prev_month_value = NULL for all rows.")
    print()

    def _mom_case(label, query, builder):
        """Run a MoM case with extra LAG() verification."""
        intent = builder(query)
        sub(label)
        print(f"\n  {BOLD}Query      :{RESET} {query}")
        detected = detect_mom_intent(query)
        print(f"  {BOLD}mom_mode   :{RESET} {intent.get('mom_mode', False)}"
              f"  ← {'✅ set' if intent.get('mom_mode') else '❌ NOT SET'}")
        print(f"  {BOLD}detect_mom :{RESET} {detected}"
              f"  ← {'✅' if detected else '❌ phrase missed'}")
        _flags(intent)
        result = _compile(intent)
        _show_sql(result)
        sql = result.get("sql") or result.get("generated_sql") or ""
        if "LAG(" in sql.upper() or "mom_growth_pct" in sql:
            ok("LAG() window present — MoM wrapper applied ✓")
        elif intent.get("mom_mode"):
            warn("mom_mode=True but LAG() absent — check _apply_mom_lag_sql_wrapper")

    cases = [
        ("6.01  MoM Revenue — full year 2025",
         "show me month on month revenue for 2025",
         lambda q: kpi(q)),
        ("6.02  MoM Revenue — Jan to Mar 2026",
         "show me month on month revenue from January to March 2026",
         lambda q: kpi(q)),
        ("6.03  MoM Revenue — Jan to Jun 2025",
         "show me month on month revenue from January to June 2025",
         lambda q: kpi(q)),
        ("6.04  MoM Revenue — Q3 2025",
         "revenue MoM Q3 2025",
         lambda q: kpi(q)),
        ("6.05  MoM Revenue — Q1 2026",
         "show me monthly trend revenue Q1 2026",
         lambda q: kpi(q)),
        ("6.06  MoM GB P&L — full year 2025",
         "show me month on month GB P&L for 2025",
         lambda q: gbpl(q)),
        ("6.07  MoM GB P&L — Jan to Mar 2026",
         "GB P&L MoM January to March 2026",
         lambda q: gbpl(q)),
        ("6.08  MoM Entity P&L — full year 2025",
         "show me month on month entity P&L for 2025",
         lambda q: entitypl(q)),
        ("6.09  MoM Entity P&L — Q1 2026",
         "show me month by month entity P&L Q1 2026",
         lambda q: entitypl(q)),
        ("6.10  MoM Headcount — full year 2025",
         "show me month on month headcount for 2025",
         lambda q: kpi(q, "Headcount")),
    ]

    for label, query, builder in cases:
        _mom_case(label, query, builder)


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 7 — YEAR COMPARISON: 2025 vs 2026  (8 cases)
# ══════════════════════════════════════════════════════════════════════════════

def section_7():
    header("SECTION 7 — Year Comparison: 2025 vs 2026  (8 cases)")
    warn("2026 has Jan–Mar only. Side-by-side comparison covers overlapping months (Q1).")
    warn("For full-year comparison, 2025 rows fill Apr–Dec; 2026 rows = NULL for those months.")
    print()

    def _comp_case(label, query, builder):
        intent = builder(query)
        sub(label)
        print(f"\n  {BOLD}Query           :{RESET} {query}")
        detected = detect_comparison_query(query)
        print(f"  {BOLD}comparison_mode :{RESET} {intent.get('comparison_mode', False)}"
              f"  ← {'✅' if intent.get('comparison_mode') else '❌ NOT SET'}")
        print(f"  {BOLD}detect_comp     :{RESET} {detected}"
              f"  ← {'✅' if detected else '❌ phrase missed'}")
        _flags(intent)
        result = _compile(intent)
        _show_sql(result)

    cases = [
        ("7.01  Revenue — full year 2025 vs 2026",
         "show me revenue 2025 vs 2026",
         lambda q: kpi(q)),
        ("7.02  Revenue — Jan 2025 vs Jan 2026",
         "show me revenue January 2025 versus January 2026",
         lambda q: kpi(q)),
        ("7.03  Revenue — Jan–Mar 2025 vs Jan–Mar 2026",
         "compare revenue from January to March 2025 versus January to March 2026",
         lambda q: kpi(q)),
        ("7.04  Revenue — Q1 2025 vs Q1 2026",
         "show me revenue Q1 2025 vs Q1 2026",
         lambda q: kpi(q)),
        ("7.05  GB P&L — 2025 vs 2026",
         "show me GB P&L 2025 versus 2026",
         lambda q: gbpl(q)),
        ("7.06  Entity P&L — 2025 vs 2026",
         "show me entity P&L 2025 vs 2026",
         lambda q: entitypl(q)),
        ("7.07  Headcount — 2025 vs 2026",
         "compare headcount 2025 and 2026",
         lambda q: kpi(q, "Headcount")),
        ("7.08  EBIT — Jan 2025 vs Jan 2026",
         "show me EBIT for January 2025 versus January 2026",
         lambda q: kpi(q, "EBIT")),
    ]

    for label, query, builder in cases:
        _comp_case(label, query, builder)


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 8 — LAST-N MONTHS + AVERAGE MONTHLY  (10 cases)
# ══════════════════════════════════════════════════════════════════════════════

def section_8():
    header("SECTION 8 — Last-N Months + Average Monthly  (10 cases)")
    warn("'Last N months' resolves dynamically from max date in DB.")
    warn("On Replit (1 month): last 3 / 6 / 12 may all return 1 period. On Azure: correct N periods.")
    print()

    def _lastn_case(label, query, builder):
        intent = builder(query)
        sub(label)
        print(f"\n  {BOLD}Query :{RESET} {query}")
        _flags(intent)
        result = _compile(intent)
        _show_sql(result)

    def _avg_case(label, query, builder):
        intent = builder(query)
        sub(label)
        print(f"\n  {BOLD}Query          :{RESET} {query}")
        detected = detect_avg_monthly_intent(query)
        print(f"  {BOLD}avg_monthly    :{RESET} {intent.get('avg_monthly_mode', False)}"
              f"  ← {'✅' if intent.get('avg_monthly_mode') else '❌ NOT SET'}")
        print(f"  {BOLD}detect_avg     :{RESET} {detected}"
              f"  ← {'✅' if detected else '❌ phrase missed'}")
        _flags(intent)
        result = _compile(intent)
        _show_sql(result)

    lastn_cases = [
        ("8.01  Revenue — last 3 months",
         "show me revenue for the last 3 months",
         lambda q: lastn(q, "Revenue")),
        ("8.02  Revenue — last 6 months",
         "show me revenue last 6 months",
         lambda q: lastn(q, "Revenue")),
        ("8.03  Revenue — last 12 months",
         "show me revenue last 12 months",
         lambda q: lastn(q, "Revenue")),
        ("8.04  GB P&L — last 3 months",
         "show me GB P&L last 3 months",
         lambda q: (SVC._detect_last_n_months_and_inject(gbpl(q), CUBE_ID, q)
                    if True else gbpl(q))),
        ("8.05  Entity P&L — last 6 months",
         "show me entity P&L last 6 months",
         lambda q: (SVC._detect_last_n_months_and_inject(entitypl(q), CUBE_ID, q)
                    if True else entitypl(q))),
    ]

    avg_cases = [
        ("8.06  Average Monthly Revenue — full year 2025",
         "show me average monthly revenue for 2025",
         lambda q: kpi(q)),
        ("8.07  Average Monthly Revenue — Jan to Mar 2026",
         "show me average monthly revenue January to March 2026",
         lambda q: kpi(q)),
        ("8.08  Average Monthly GB P&L — full year 2025",
         "show me average monthly GB P&L for 2025",
         lambda q: gbpl(q)),
        ("8.09  Average Monthly Entity P&L — full year 2025",
         "show me average monthly entity P&L for 2025",
         lambda q: entitypl(q)),
        ("8.10  Average Monthly Headcount — full year 2025",
         "show me average monthly headcount for 2025",
         lambda q: kpi(q, "Headcount")),
    ]

    for label, query, builder in lastn_cases:
        _lastn_case(label, query, builder)
    for label, query, builder in avg_cases:
        _avg_case(label, query, builder)


# ══════════════════════════════════════════════════════════════════════════════
# SECTION 9 — ENTITY-SPECIFIC QUERIES  (10 cases)
# Entities: BGSW (India), BGSV (Vietnam), BGSJ (Japan), BGSG (Germany)
# ══════════════════════════════════════════════════════════════════════════════

def section_9():
    header("SECTION 9 — Entity-Specific Queries  (10 cases)")
    info("Entity mapping: BGSW=India, BGSV=Vietnam, BGSJ=Japan, BGSG=Germany, BGSW/NE-MX=Mexico")
    print()

    cases = [
        # Revenue by entity — 2025
        ("9.01  Revenue — BGSW (India) full year 2025",
         "show me revenue for BGSW in 2025",
         lambda q: kpi(q)),
        ("9.02  Revenue — BGSV (Vietnam) full year 2025",
         "show me revenue for BGSV in 2025",
         lambda q: kpi(q)),
        ("9.03  Revenue — BGSJ (Japan) full year 2025",
         "show me revenue for BGSJ in 2025",
         lambda q: kpi(q)),
        ("9.04  Revenue — BGSG (Germany) full year 2025",
         "show me revenue for BGSG in 2025",
         lambda q: kpi(q)),

        # Country-name aliases
        ("9.05  Revenue — India alias for BGSW, 2025",
         "show me revenue for India in 2025",
         lambda q: kpi(q)),
        ("9.06  Revenue — Vietnam alias for BGSV, Jan–Mar 2026",
         "show me revenue for Vietnam from January to March 2026",
         lambda q: kpi(q)),

        # Entity P&L by entity
        ("9.07  Entity P&L — BGSW full year 2025",
         "show me entity P&L for BGSW 2025",
         lambda q: entitypl(q)),
        ("9.08  Entity P&L — BGSV full year 2025",
         "show me entity P&L for BGSV 2025",
         lambda q: entitypl(q)),

        # MoM entity-specific
        ("9.09  MoM Revenue — BGSW full year 2025",
         "show me month on month revenue for BGSW 2025",
         lambda q: kpi(q)),

        # GB P&L entity-specific
        ("9.10  GB P&L — BGSW Jan to Mar 2026",
         "show me GB P&L for BGSW from January to March 2026",
         lambda q: gbpl(q)),
    ]

    for label, query, builder in cases:
        run_case(label, query, builder(query))


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

SECTIONS = {
    "1": ("Revenue: Date Variants",        section_1),
    "2": ("Other KPI Metrics",             section_2),
    "3": ("Cost Metrics",                  section_3),
    "4": ("GB P&L: Date Variants",         section_4),
    "5": ("Entity P&L: Date Variants",     section_5),
    "6": ("Month on Month (MoM)",          section_6),
    "7": ("Year Comparison 2025 vs 2026",  section_7),
    "8": ("Last-N Months + Avg Monthly",   section_8),
    "9": ("Entity-Specific Queries",       section_9),
}


def main():
    global SHOW_SQL

    parser = argparse.ArgumentParser(
        description="LedgerLM 100-Query Regression Test (no HTTP, no LLM)"
    )
    parser.add_argument("--section", choices=list(SECTIONS.keys()),
                        help="Run one section only (1–9)")
    parser.add_argument("--query",   type=str,
                        help="Run a single ad-hoc query (auto-routed)")
    parser.add_argument("--no-sql",  action="store_true",
                        help="Print intent flags only; skip SQL compilation")
    args = parser.parse_args()

    if args.no_sql:
        SHOW_SQL = False

    print(f"\n{BOLD}{CYAN}{'='*76}")
    print("  LedgerLM — 100-Query Regression Test  (no HTTP, no LLM, instant)")
    print(f"  Cube   : {CUBE_ID}")
    print(f"  Domain : {DOMAIN}")
    print(f"  Data   : Jan 2025 – Dec 2025  +  Jan 2026 – Mar 2026")
    print(f"  Time   : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*76}{RESET}")

    # Show available DB periods
    header("DB: Available Time Periods")
    try:
        tp = SVC.get_available_time_periods(CUBE_ID)
        periods = tp.get("year_months", [])
        years   = tp.get("years", [])
        if periods:
            ok(f"Found {len(periods)} period(s): {periods}")
            ok(f"Years: {years}")
        else:
            warn("No periods found in cube_fact_data")
    except Exception as e:
        fail(f"Could not query time periods: {e}")

    if args.query:
        header("AD-HOC QUERY")
        q = args.query
        print(f"\n  {BOLD}Query           :{RESET} {q}")
        print(f"  is_gb_pl_query  : {is_gb_pl_query(q)}")
        print(f"  is_entity_pl    : {is_entity_pl_query(q)}")
        print(f"  detect_mom      : {detect_mom_intent(q)}")
        print(f"  detect_avg      : {detect_avg_monthly_intent(q)}")
        print(f"  detect_comp     : {detect_comparison_query(q)}")
        intent = auto(q)
        _flags(intent)
        result = _compile(intent)
        _show_sql(result)
        return

    if args.section:
        _, fn = SECTIONS[args.section]
        fn()
    else:
        for num, (title, fn) in SECTIONS.items():
            fn()

    print(f"\n{BOLD}{GREEN}{'='*76}")
    print("  All tests complete — 100 queries across 9 sections")
    print(f"{'='*76}{RESET}\n")


if __name__ == "__main__":
    main()
