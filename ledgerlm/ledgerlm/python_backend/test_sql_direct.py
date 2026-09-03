#!/usr/bin/env python3
"""
LedgerLM Direct SQL Generation Test
=====================================
Calls the Python service DIRECTLY (no HTTP, no OpenAI wait).
Tests SQL generation for all query types: KPI, GB P&L, Entity P&L, MoM, comparison, last-N.

Usage:
    cd /home/runner/workspace/ledgerlm/ledgerlm/python_backend
    python3 test_sql_direct.py

    # Run one section only:
    python3 test_sql_direct.py --section mom
    python3 test_sql_direct.py --section kpi
    python3 test_sql_direct.py --section gbpl
    python3 test_sql_direct.py --section entitypl
    python3 test_sql_direct.py --section comparison
    python3 test_sql_direct.py --section lastn

    # Custom query (auto-routes to correct builder):
    python3 test_sql_direct.py --query "show me month on month revenue Jan to June 2026"
"""

import sys
import os
import argparse
import textwrap
import json
from datetime import datetime

# ─── Colours ───────────────────────────────────────────────────────────────────
GREEN  = "\033[92m"; RED  = "\033[91m"; YELLOW = "\033[93m"
CYAN   = "\033[96m"; BOLD = "\033[1m";  RESET  = "\033[0m"

def ok(m):      print(f"  {GREEN}✅ {m}{RESET}")
def fail(m):    print(f"  {RED}❌ {m}{RESET}")
def warn(m):    print(f"  {YELLOW}⚠️  {m}{RESET}")
def info(m):    print(f"  {CYAN}ℹ️  {m}{RESET}")
def header(m):  print(f"\n{BOLD}{CYAN}{'─'*72}\n  {m}\n{'─'*72}{RESET}")
def sub(m):     print(f"\n  {BOLD}🔹 {m}{RESET}")

# ─── Bootstrap ─────────────────────────────────────────────────────────────────
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

# ─── Helpers ───────────────────────────────────────────────────────────────────

def _show_periods():
    """Print available year/month combos from the DB."""
    header("STEP 0 — Available Data Periods in Database")
    try:
        tp = SVC.get_available_time_periods(CUBE_ID)
        periods = tp.get("year_months", [])
        years   = tp.get("years", [])
        if periods:
            ok(f"Found {len(periods)} period(s): {periods}")
            if len(years) < 2:
                warn(f"Only 1 year in DB ({years}) → MoM needs ≥2 months; comparison needs ≥2 years")
                warn("On Azure with 2025+2026 data these tests will all return full results")
            else:
                ok(f"Multiple years: {years} — MoM + comparison will work")
        else:
            warn("No time periods found in cube_fact_data")
    except Exception as e:
        fail(f"Could not query time periods: {e}")


def _compile(intent: dict, label: str = "") -> dict:
    """Wrap compile_sql with error handling."""
    try:
        return SVC.compile_sql(intent, CUBE_ID, domain=DOMAIN)
    except Exception as e:
        return {"success": False, "error": str(e)}


def _show_sql(result: dict):
    """Print the generated SQL from a compile_sql result."""
    if not result.get("success"):
        fail(f"compile_sql failed: {result.get('error', 'unknown')}")
        return
    sql = result.get("sql") or result.get("generated_sql") or ""
    params = result.get("params") or result.get("parameters") or []
    if sql:
        ok("SQL generated:")
        for line in sql.strip().splitlines():
            print(f"       {line}")
        if params:
            info(f"Params: {params}")
    else:
        # dump the whole result to show what came back
        warn("No 'sql' key in result — dumping result:")
        for k, v in result.items():
            if k not in ("intent",):
                print(f"       {k}: {v}")


def _intent_flags(intent: dict):
    """Print the key boolean flags on an intent."""
    flags = {k: intent.get(k) for k in
             ("mom_mode","avg_monthly_mode","comparison_mode","mom_lag_mode",
              "use_calculation","query_type","group_by","filters") if intent.get(k) is not None}
    info(f"Intent flags: {json.dumps(flags, default=str)}")


def run_case(label: str, query: str, intent: dict):
    """Standard test case: show intent flags → compile → show SQL."""
    sub(label)
    print(f"\n  {BOLD}Query :{RESET} {query}")
    _intent_flags(intent)
    result = _compile(intent)
    _show_sql(result)
    return result


# ─── Intent builders (bypass LLM) ──────────────────────────────────────────────

def gb_pl_intent(query: str) -> dict:
    return SVC._build_gb_pl_cost_breakdown_intent(query)

def entity_pl_intent(query: str) -> dict:
    cat = detect_entity_category_from_query(query)
    return SVC._build_entity_pl_intent(query, cat)

def kpi_intent(query: str, calc_name: str = "Revenue", entity_filters=None) -> dict:
    return SVC._build_kpi_intent_fast(query, calc_name, entity_filters or [], None)

def with_defaults(intent: dict) -> dict:
    """Apply default time filters (same as the real pipeline does)."""
    return SVC.apply_default_time_filters(intent, CUBE_ID, "default")

def auto_intent(query: str) -> dict:
    """Route to the correct intent builder based on the query text."""
    if is_gb_pl_query(query):
        return with_defaults(gb_pl_intent(query))
    if is_entity_pl_query(query):
        return with_defaults(entity_pl_intent(query))
    # Default: KPI / Revenue
    return with_defaults(kpi_intent(query, "Revenue"))


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1 — KPI METRIC
# ═══════════════════════════════════════════════════════════════════════════════

def test_kpi():
    header("SECTION 1 — KPI METRIC Queries")

    cases = [
        ("1.1  Revenue — no date (auto defaults to latest year)",
         "show me revenue",
         lambda q: with_defaults(kpi_intent(q, "Revenue"))),
        ("1.2  Revenue — specific year 2026",
         "show me revenue for 2026",
         lambda q: kpi_intent(q, "Revenue")),
        ("1.3  Revenue — by month 2026",
         "show me revenue by month for 2026",
         lambda q: kpi_intent(q, "Revenue")),
        ("1.4  Revenue — by Planning GB",
         "show me revenue by planning GB for 2026",
         lambda q: kpi_intent(q, "Revenue")),
        ("1.5  Revenue — by Project GB",
         "show me revenue by project GB for 2026",
         lambda q: kpi_intent(q, "Revenue")),
        ("1.6  Revenue — Onsite vs Offshore",
         "show me onsite and offshore revenue for 2026",
         lambda q: kpi_intent(q, "Revenue")),
        ("1.7  Revenue — by SDS",
         "show me revenue by SDS for 2026",
         lambda q: kpi_intent(q, "Revenue")),
        ("1.8  Revenue — by Org level",
         "show me revenue by organization level for 2026",
         lambda q: kpi_intent(q, "Revenue")),
        ("1.9  Revenue — Fixed Price and T&M",
         "show me fixed price and TM revenue for 2026",
         lambda q: kpi_intent(q, "Revenue")),
        ("1.10 Headcount — 2026",
         "show me headcount for 2026",
         lambda q: kpi_intent(q, "Headcount")),
        ("1.11 Billing Utilization — 2026",
         "show me billing utilization for 2026",
         lambda q: kpi_intent(q, "Billing Utilization")),
    ]
    for label, query, builder in cases:
        run_case(label, query, builder(query))


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2 — GB P&L
# ═══════════════════════════════════════════════════════════════════════════════

def test_gbpl():
    header("SECTION 2 — GB P&L Queries")

    cases = [
        ("2.1  GB P&L — no date (auto defaults)",
         "show me GB P&L",
         lambda q: with_defaults(gb_pl_intent(q))),
        ("2.2  GB P&L — year 2026",
         "show me GB P&L for 2026",
         lambda q: gb_pl_intent(q)),
        ("2.3  GB P&L — by month 2026",
         "show me GB P&L by month for 2026",
         lambda q: gb_pl_intent(q)),
        ("2.4  GB P&L — January 2026",
         "show me GB P&L for January 2026",
         lambda q: gb_pl_intent(q)),
        ("2.5  GB P&L — Jan to March 2026",
         "show me GB P&L from January to March 2026",
         lambda q: gb_pl_intent(q)),
        ("2.6  GB P&L — by Planning GB",
         "show me GB P&L by planning GB for 2026",
         lambda q: gb_pl_intent(q)),
        ("2.7  GB P&L — by Project GB",
         "show me GB P&L by project GB for 2026",
         lambda q: gb_pl_intent(q)),
        ("2.8  GB P&L — average monthly",
         "show me average monthly GB P&L for 2026",
         lambda q: gb_pl_intent(q)),
        ("2.9  GB P&L — Q1 2026",
         "show me GB P&L for Q1 2026",
         lambda q: gb_pl_intent(q)),
    ]
    for label, query, builder in cases:
        run_case(label, query, builder(query))


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3 — ENTITY P&L
# ═══════════════════════════════════════════════════════════════════════════════

def test_entitypl():
    header("SECTION 3 — ENTITY P&L Queries")

    cases = [
        ("3.1  Entity P&L — no date (auto defaults)",
         "show me entity P&L",
         lambda q: with_defaults(entity_pl_intent(q))),
        ("3.2  Entity P&L — year 2026",
         "show me entity P&L for 2026",
         lambda q: entity_pl_intent(q)),
        ("3.3  Entity P&L — by month 2026",
         "show me entity P&L by month for 2026",
         lambda q: entity_pl_intent(q)),
        ("3.4  Entity P&L — January 2026",
         "show me entity P&L for January 2026",
         lambda q: entity_pl_intent(q)),
        ("3.5  Entity P&L — Jan to March 2026",
         "show me entity P&L from January to March 2026",
         lambda q: entity_pl_intent(q)),
        ("3.6  Entity P&L — BGSW only",
         "show me entity P&L for BGSW 2026",
         lambda q: entity_pl_intent(q)),
        ("3.7  Entity P&L — Q1 2026",
         "show me entity P&L for Q1 2026",
         lambda q: entity_pl_intent(q)),
    ]
    for label, query, builder in cases:
        run_case(label, query, builder(query))


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4 — MONTH ON MONTH
# ═══════════════════════════════════════════════════════════════════════════════

def test_mom():
    header("SECTION 4 — MONTH ON MONTH (MoM) Queries")
    warn("Replit DB has only Jan 2026 → MoM SQL will be generated but prev_month_value = NULL")
    warn("On Azure (2025+2026, multiple months) → full MoM growth % returned")
    print()

    # ── Detection check first ──────────────────────────────────────────────────
    sub("4.0  detect_mom_intent() — verifying all phrasings are detected")
    mom_phrases = [
        "show me month on month revenue",
        "revenue MoM by month",
        "month-on-month GB P&L",
        "month by month entity P&L",
        "month wise revenue",
        "give me monthly trend revenue",
    ]
    all_ok = True
    for phrase in mom_phrases:
        detected = detect_mom_intent(phrase)
        if detected:
            ok(f"DETECTED  → '{phrase}'")
        else:
            fail(f"MISSED    → '{phrase}'")
            all_ok = False
    if all_ok:
        ok("All MoM phrasings detected correctly ✓")
    print()

    # ── KPI / Revenue MoM ─────────────────────────────────────────────────────
    cases = [
        ("4.1  MoM Revenue — 'month on month' phrasing",
         "show me month on month revenue for 2026",
         lambda q: kpi_intent(q, "Revenue")),
        ("4.2  MoM Revenue — 'MoM' abbreviation",
         "revenue MoM by month 2026",
         lambda q: kpi_intent(q, "Revenue")),
        ("4.3  MoM Revenue — month-by-month",
         "show me month by month revenue 2026",
         lambda q: kpi_intent(q, "Revenue")),
        ("4.4  MoM Revenue — month-wise",
         "give me month wise revenue 2026",
         lambda q: kpi_intent(q, "Revenue")),
        ("4.5  MoM Revenue — Jan to June 2026",
         "show me month on month revenue January to June 2026",
         lambda q: kpi_intent(q, "Revenue")),
        ("4.6  MoM Revenue — by Planning GB",
         "show me month on month revenue by planning GB 2026",
         lambda q: kpi_intent(q, "Revenue")),
        # ── GB P&L MoM ────────────────────────────────────────────────────────
        ("4.7  MoM GB P&L",
         "show me month on month GB P&L for 2026",
         lambda q: gb_pl_intent(q)),
        ("4.8  MoM GB P&L — MoM abbrev",
         "GB P&L MoM 2026",
         lambda q: gb_pl_intent(q)),
        # ── Entity P&L MoM ────────────────────────────────────────────────────
        ("4.9  MoM Entity P&L",
         "show me month on month entity P&L for 2026",
         lambda q: entity_pl_intent(q)),
        ("4.10 MoM Entity P&L — BGSW",
         "show me month on month entity P&L for BGSW 2026",
         lambda q: entity_pl_intent(q)),
    ]

    for label, query, builder in cases:
        intent = builder(query)
        mom_detected = detect_mom_intent(query)
        sub(label)
        print(f"\n  {BOLD}Query      :{RESET} {query}")
        print(f"  {BOLD}mom_mode   :{RESET} {intent.get('mom_mode', False)}  ← "
              f"{'✅ set' if intent.get('mom_mode') else '❌ NOT SET — check intent builder'}")
        print(f"  {BOLD}detect_mom :{RESET} {mom_detected}  ← "
              f"{'✅' if mom_detected else '❌ detect_mom_intent missed this phrase'}")
        _intent_flags(intent)
        result = _compile(intent)
        _show_sql(result)

        # Extra: check if the SQL contains the LAG() window function (MoM wrapper)
        sql = result.get("sql") or result.get("generated_sql") or ""
        if "LAG(" in sql.upper() or "mom_growth_pct" in sql:
            ok("SQL contains LAG() window — MoM wrapper applied correctly ✓")
        elif intent.get("mom_mode"):
            warn("mom_mode=True but LAG() not in SQL — check _apply_mom_lag_sql_wrapper")
        else:
            warn("mom_mode not set → MoM wrapper not applied (phrase not detected)")


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5 — YEAR COMPARISON (2025 vs 2026)
# ═══════════════════════════════════════════════════════════════════════════════

def test_comparison():
    header("SECTION 5 — YEAR COMPARISON (2025 vs 2026)")
    warn("Replit DB has only 2026 — comparison SQL is generated but 2025 rows = 0")
    warn("On Azure with 2025+2026 data → full side-by-side results")
    print()

    sub("5.0  detect_comparison_query() — verifying detection")
    comp_phrases = [
        "revenue 2025 vs 2026",
        "compare revenue 2025 and 2026",
        "entity P&L 2025 versus 2026",
        "what is revenue variance 2025 to 2026",
    ]
    for phrase in comp_phrases:
        detected = detect_comparison_query(phrase)
        if detected:
            ok(f"DETECTED  → '{phrase}'")
        else:
            fail(f"MISSED    → '{phrase}'")
    print()

    cases = [
        ("5.1  Revenue 2025 vs 2026",
         "show me revenue 2025 vs 2026",
         lambda q: kpi_intent(q, "Revenue")),
        ("5.2  GB P&L 2025 vs 2026",
         "show me GB P&L 2025 versus 2026",
         lambda q: gb_pl_intent(q)),
        ("5.3  Entity P&L 2025 vs 2026",
         "show me entity P&L 2025 vs 2026",
         lambda q: entity_pl_intent(q)),
        ("5.4  Revenue Jan 2025 vs Jan 2026",
         "show me revenue January 2025 versus January 2026",
         lambda q: kpi_intent(q, "Revenue")),
        ("5.5  Revenue comparison — all months 2025 and 2026",
         "compare revenue by month for 2025 and 2026",
         lambda q: kpi_intent(q, "Revenue")),
    ]
    for label, query, builder in cases:
        intent = builder(query)
        sub(label)
        print(f"\n  {BOLD}Query           :{RESET} {query}")
        print(f"  {BOLD}comparison_mode :{RESET} {intent.get('comparison_mode', False)}")
        _intent_flags(intent)
        result = _compile(intent)
        _show_sql(result)


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 6 — LAST N MONTHS
# ═══════════════════════════════════════════════════════════════════════════════

def test_lastn():
    header("SECTION 6 — LAST N MONTHS Queries")
    warn("With 1 month in DB, 'last 6 months' = 1 period. On Azure = correct N periods.")
    print()

    cases = [
        ("6.1  Revenue — last 3 months",
         "show me revenue for the last 3 months",
         lambda q: kpi_intent(q, "Revenue")),
        ("6.2  Revenue — last 6 months",
         "show me revenue last 6 months",
         lambda q: kpi_intent(q, "Revenue")),
        ("6.3  Revenue — last 12 months",
         "show me revenue last 12 months",
         lambda q: kpi_intent(q, "Revenue")),
        ("6.4  GB P&L — last 6 months",
         "show me GB P&L last 6 months",
         lambda q: gb_pl_intent(q)),
        ("6.5  Entity P&L — last 6 months",
         "show me entity P&L last 6 months",
         lambda q: entity_pl_intent(q)),
        ("6.6  MoM Revenue — last 3 months",
         "show me month on month revenue last 3 months",
         lambda q: kpi_intent(q, "Revenue")),
    ]
    for label, query, builder in cases:
        intent = builder(query)

        # _detect_last_n_months_and_inject runs inside compile_sql pipeline normally.
        # Apply it explicitly here so the test reflects the real pipeline.
        try:
            intent = SVC._detect_last_n_months_and_inject(intent, CUBE_ID, query)
        except Exception as e:
            warn(f"_detect_last_n_months_and_inject error: {e}")

        run_case(label, query, intent)


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

SECTIONS = {
    "kpi":        test_kpi,
    "gbpl":       test_gbpl,
    "entitypl":   test_entitypl,
    "mom":        test_mom,
    "comparison": test_comparison,
    "lastn":      test_lastn,
}

def main():
    parser = argparse.ArgumentParser(description="LedgerLM Direct SQL Test (no HTTP, no LLM)")
    parser.add_argument("--section", choices=list(SECTIONS.keys()),
                        help="Run one section only")
    parser.add_argument("--query",   type=str,
                        help="Run a single custom query — auto-routes to correct builder")
    args = parser.parse_args()

    print(f"\n{BOLD}{CYAN}{'='*72}")
    print("  LedgerLM Direct SQL Test  (no HTTP, no LLM — instant results)")
    print(f"  Cube   : {CUBE_ID}")
    print(f"  Domain : {DOMAIN}")
    print(f"  Time   : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*72}{RESET}")

    _show_periods()

    if args.query:
        header("CUSTOM QUERY")
        q = args.query
        print(f"\n  {BOLD}Query :{RESET} {q}")
        print(f"  is_gb_pl_query   : {is_gb_pl_query(q)}")
        print(f"  is_entity_pl     : {is_entity_pl_query(q)}")
        print(f"  detect_mom_intent: {detect_mom_intent(q)}")
        print(f"  detect_comparison: {detect_comparison_query(q)}")
        intent = auto_intent(q)
        _intent_flags(intent)
        result = _compile(intent)
        _show_sql(result)
        return

    if args.section:
        SECTIONS[args.section]()
    else:
        for fn in SECTIONS.values():
            fn()

    print(f"\n{BOLD}{GREEN}{'='*72}")
    print("  All tests complete")
    print(f"{'='*72}{RESET}\n")


if __name__ == "__main__":
    main()
