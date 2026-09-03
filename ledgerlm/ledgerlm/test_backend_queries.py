#!/usr/bin/env python3
"""
LedgerLM Backend Query Test Script
===================================
Tests all natural language query types directly against the Python backend (port 8000).
No frontend needed — pure API testing.

Usage:
    cd /home/runner/workspace/ledgerlm/ledgerlm
    python3 test_backend_queries.py

    # Run only a specific section:
    python3 test_backend_queries.py --section kpi
    python3 test_backend_queries.py --section gbpl
    python3 test_backend_queries.py --section entitypl
    python3 test_backend_queries.py --section mom
    python3 test_backend_queries.py --section comparison
    python3 test_backend_queries.py --section lastn

    # Run a single custom query:
    python3 test_backend_queries.py --query "show me month on month revenue Jan 2026"
"""

import requests
import json
import sys
import argparse
import textwrap
from datetime import datetime

# ─────────────────────────────────────────────
# CONFIG — change CUBE_ID if needed
# ─────────────────────────────────────────────
BASE_URL = "http://localhost:8000/api/v2"
CUBE_ID  = "526c3389-68e2-4028-9a15-aa1c00e12d29"
USER_ID  = "test-script"
DOMAIN   = "bosch.com"   # change to your tenant domain

HEADERS  = {"Content-Type": "application/json"}

# ─────────────────────────────────────────────
# COLOUR HELPERS
# ─────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def ok(msg):    print(f"  {GREEN}✅ {msg}{RESET}")
def fail(msg):  print(f"  {RED}❌ {msg}{RESET}")
def warn(msg):  print(f"  {YELLOW}⚠️  {msg}{RESET}")
def info(msg):  print(f"  {CYAN}ℹ️  {msg}{RESET}")
def header(msg):print(f"\n{BOLD}{CYAN}{'─'*70}\n  {msg}\n{'─'*70}{RESET}")
def subheader(msg): print(f"\n{BOLD}  🔹 {msg}{RESET}")

# ─────────────────────────────────────────────
# QUERY RUNNER
# ─────────────────────────────────────────────
def run_query(natural_language_query: str, label: str = "") -> dict:
    """Send a natural language query to the backend and return the full response."""
    payload = {
        "query":   natural_language_query,
        "cube_id": CUBE_ID,
        "user_id": USER_ID,
        "domain":  DOMAIN,
    }
    try:
        resp = requests.post(
            f"{BASE_URL}/semantic-sql/query-full",
            headers=HEADERS,
            json=payload,
            timeout=60,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.ConnectionError:
        return {"success": False, "error": "Cannot connect to backend — is it running on port 8000?"}
    except requests.exceptions.Timeout:
        return {"success": False, "error": "Request timed out (>60s)"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def parse_intent(natural_language_query: str) -> dict:
    """Call /parse-intent to see just the extracted intent (no SQL execution)."""
    payload = {
        "query":   natural_language_query,
        "cube_id": CUBE_ID,
        "user_id": USER_ID,
        "domain":  DOMAIN,
    }
    try:
        resp = requests.post(
            f"{BASE_URL}/semantic-sql/parse-intent",
            headers=HEADERS,
            json=payload,
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        return {"success": False, "error": str(e)}


def print_result(query: str, result: dict, show_rows: int = 5):
    """Pretty-print a single test result."""
    print(f"\n  {BOLD}Query:{RESET} {query}")

    if not result.get("success"):
        fail(f"FAILED — {result.get('error', 'unknown error')}")
        return

    # Generated SQL
    sql = result.get("generated_sql", "")
    if sql:
        ok("SQL generated:")
        # Indent each line
        for line in sql.strip().splitlines():
            print(f"       {line}")
    else:
        warn("No generated_sql in response")

    # Row count
    rows = result.get("results") or result.get("table") or []
    print(f"\n  {BOLD}Rows returned:{RESET} {len(rows)}")

    if rows:
        # Print first N rows as a simple table
        all_keys = list(rows[0].keys())
        col_w = max(18, max(len(k) for k in all_keys))
        header_line = "  | " + " | ".join(k.ljust(col_w) for k in all_keys) + " |"
        sep_line    = "  +" + "+".join("-" * (col_w + 2) for _ in all_keys) + "+"
        print(sep_line)
        print(header_line)
        print(sep_line)
        for row in rows[:show_rows]:
            vals = [str(row.get(k, "")).ljust(col_w) for k in all_keys]
            print("  | " + " | ".join(vals) + " |")
        print(sep_line)
        if len(rows) > show_rows:
            print(f"  ... and {len(rows) - show_rows} more rows")
    else:
        warn("Zero rows returned — check if data exists for this period")

    # Narrative
    narrative = result.get("narrative")
    if narrative:
        print(f"\n  {BOLD}Narrative:{RESET}")
        for line in textwrap.wrap(narrative, width=80):
            print(f"    {line}")


def run_test_case(label: str, query: str, show_rows: int = 5):
    subheader(label)
    result = run_query(query)
    print_result(query, result, show_rows=show_rows)
    return result


# ─────────────────────────────────────────────
# CHECK AVAILABLE DATA PERIODS FIRST
# ─────────────────────────────────────────────
def show_available_periods():
    header("STEP 0 — Available Data Periods in DB")
    payload = {"cube_id": CUBE_ID}
    try:
        resp = requests.post(
            f"{BASE_URL}/semantic-sql/available-periods",
            headers=HEADERS,
            json=payload,
            timeout=10,
        )
        data = resp.json()
        periods = data.get("periods", [])
        if periods:
            ok(f"Found {len(periods)} periods:")
            for p in periods:
                print(f"       Year={p.get('year')}  Month={p.get('month')}")
            
            years = sorted(set(p['year'] for p in periods), reverse=True)
            if len(years) < 2:
                warn(f"Only {len(years)} year(s) in DB → Month-on-Month queries need ≥2 months of data")
                warn("On Azure (with 2025+2026 data) these will work correctly")
            else:
                ok(f"Multiple years found: {years} → MoM + comparison queries will work")
        else:
            warn("No periods found or endpoint error")
            print(f"       Response: {data}")
    except Exception as e:
        fail(f"Could not check periods: {e}")


# ─────────────────────────────────────────────
# TEST SECTIONS
# ─────────────────────────────────────────────

def test_kpi_metric():
    header("SECTION 1 — KPI METRIC Queries")

    run_test_case(
        "1.1  Basic revenue (no date) — should auto-pick latest months",
        "show me revenue"
    )
    run_test_case(
        "1.2  Revenue for specific year",
        "show me revenue for 2026"
    )
    run_test_case(
        "1.3  Revenue by month (with year)",
        "show me revenue by month for 2026"
    )
    run_test_case(
        "1.4  Revenue by Planning GB",
        "show me revenue by planning GB for 2026"
    )
    run_test_case(
        "1.5  Revenue by Project GB",
        "show me revenue by project GB for 2026"
    )
    run_test_case(
        "1.6  Onsite vs Offshore revenue",
        "show me onsite and offshore revenue for 2026"
    )
    run_test_case(
        "1.7  Revenue by SDS",
        "show me revenue by SDS for 2026"
    )
    run_test_case(
        "1.8  Revenue by Org level",
        "show me revenue by organization level for 2026"
    )
    run_test_case(
        "1.9  Cost / headcount",
        "show me total cost for 2026"
    )
    run_test_case(
        "1.10 Revenue type breakdown",
        "show me fixed price and T&M revenue for 2026"
    )


def test_gb_pl():
    header("SECTION 2 — GB P&L Queries")

    run_test_case(
        "2.1  Basic GB P&L (no date)",
        "show me GB P&L"
    )
    run_test_case(
        "2.2  GB P&L for specific year",
        "show me GB P&L for 2026"
    )
    run_test_case(
        "2.3  GB P&L by month",
        "show me GB P&L by month for 2026"
    )
    run_test_case(
        "2.4  GB P&L for January",
        "show me GB P&L for January 2026"
    )
    run_test_case(
        "2.5  GB P&L by Planning GB",
        "show me GB P&L by planning GB for 2026"
    )
    run_test_case(
        "2.6  GB P&L by Project GB",
        "show me GB P&L by project GB for 2026"
    )
    run_test_case(
        "2.7  GB P&L cost breakdown",
        "show me cost breakdown for GB P&L 2026"
    )
    run_test_case(
        "2.8  Average monthly GB P&L",
        "show me average monthly GB P&L for 2026"
    )


def test_entity_pl():
    header("SECTION 3 — ENTITY P&L Queries")

    run_test_case(
        "3.1  Basic Entity P&L (no date)",
        "show me entity P&L"
    )
    run_test_case(
        "3.2  Entity P&L for specific year",
        "show me entity P&L for 2026"
    )
    run_test_case(
        "3.3  Entity P&L by month",
        "show me entity P&L by month for 2026"
    )
    run_test_case(
        "3.4  Entity P&L for January",
        "show me entity P&L for January 2026"
    )
    run_test_case(
        "3.5  Entity P&L Jan to March 2026",
        "show me entity P&L from January to March 2026"
    )
    run_test_case(
        "3.6  Entity P&L by cost category",
        "show me entity P&L cost breakdown for 2026"
    )


def test_mom():
    """
    Month-on-Month tests.
    NOTE: With only 1 month of data in Replit (Jan 2026), these will return
    0 or 1 row with NULL prev_month_value. On Azure with multi-month data
    they will return full MoM growth percentages.
    The test checks that SQL IS generated correctly — not whether data exists.
    """
    header("SECTION 4 — MONTH ON MONTH (MoM) Queries")
    warn("NOTE: MoM needs ≥2 months of data. SQL generation is tested here.")
    warn("On Azure (2025+2026 data) these will return full results.")

    run_test_case(
        "4.1  MoM revenue — basic",
        "show me month on month revenue for 2026"
    )
    run_test_case(
        "4.2  MoM revenue — 'MoM' abbreviation",
        "revenue MoM by month 2026"
    )
    run_test_case(
        "4.3  MoM revenue — month-by-month phrasing",
        "show me month by month revenue 2026"
    )
    run_test_case(
        "4.4  MoM GB P&L",
        "show me month on month GB P&L for 2026"
    )
    run_test_case(
        "4.5  MoM Entity P&L",
        "show me month on month entity P&L for 2026"
    )
    run_test_case(
        "4.6  MoM revenue with planning GB filter",
        "show me month on month revenue by planning GB 2026"
    )
    run_test_case(
        "4.7  MoM revenue Jan to June 2026",
        "show me month on month revenue January to June 2026"
    )
    run_test_case(
        "4.8  MoM — month-wise phrasing",
        "give me month wise revenue 2026"
    )

    # Also show the raw intent parse so we can verify mom_mode is set
    subheader("4.9  Intent parse — verifying mom_mode flag is set")
    query = "show me month on month revenue for 2026"
    print(f"\n  {BOLD}Query:{RESET} {query}")
    intent_result = parse_intent(query)
    if intent_result.get("success"):
        intent = intent_result.get("intent", {})
        mom_mode = intent.get("mom_mode", False)
        if mom_mode:
            ok(f"mom_mode = {mom_mode}  ← MoM detected correctly ✓")
        else:
            fail(f"mom_mode = {mom_mode}  ← MoM NOT detected — check detect_mom_intent()")
        print(f"\n  {BOLD}Full intent:{RESET}")
        print(json.dumps(intent, indent=4, default=str))
    else:
        fail(f"Intent parse failed: {intent_result.get('error')}")


def test_comparison():
    header("SECTION 5 — YEAR COMPARISON Queries (2025 vs 2026)")
    warn("NOTE: Needs both years in DB. SQL generation is tested here.")

    run_test_case(
        "5.1  Revenue 2025 vs 2026",
        "show me revenue 2025 vs 2026"
    )
    run_test_case(
        "5.2  Revenue comparison 2025 and 2026",
        "compare revenue 2025 and 2026"
    )
    run_test_case(
        "5.3  GB P&L 2025 vs 2026",
        "show me GB P&L 2025 versus 2026"
    )
    run_test_case(
        "5.4  Entity P&L 2025 vs 2026",
        "show me entity P&L 2025 vs 2026"
    )
    run_test_case(
        "5.5  Revenue Jan 2025 vs Jan 2026",
        "show me revenue January 2025 versus January 2026"
    )
    run_test_case(
        "5.6  Variance revenue 2025 to 2026",
        "what is the revenue variance from 2025 to 2026"
    )


def test_last_n_months():
    header("SECTION 6 — LAST N MONTHS Queries")
    warn("NOTE: With 1 month in DB, 'last 6 months' returns 1 month. On Azure = correct.")

    run_test_case(
        "6.1  Last 3 months revenue",
        "show me revenue for the last 3 months"
    )
    run_test_case(
        "6.2  Last 6 months revenue",
        "show me revenue for the last 6 months"
    )
    run_test_case(
        "6.3  Last 12 months revenue",
        "show me revenue last 12 months"
    )
    run_test_case(
        "6.4  Last 6 months GB P&L",
        "show me GB P&L last 6 months"
    )
    run_test_case(
        "6.5  Last 6 months entity P&L",
        "show me entity P&L last 6 months"
    )
    run_test_case(
        "6.6  Last 3 months MoM revenue",
        "show me month on month revenue last 3 months"
    )


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
SECTIONS = {
    "kpi":        test_kpi_metric,
    "gbpl":       test_gb_pl,
    "entitypl":   test_entity_pl,
    "mom":        test_mom,
    "comparison": test_comparison,
    "lastn":      test_last_n_months,
}

def main():
    parser = argparse.ArgumentParser(description="LedgerLM Backend Query Tests")
    parser.add_argument("--section", choices=list(SECTIONS.keys()),
                        help="Run only this section")
    parser.add_argument("--query", type=str,
                        help="Run a single custom query and show SQL + results")
    args = parser.parse_args()

    print(f"\n{BOLD}{CYAN}{'='*70}")
    print(f"  LedgerLM Backend Query Test Suite")
    print(f"  Backend : {BASE_URL}")
    print(f"  Cube ID : {CUBE_ID}")
    print(f"  Domain  : {DOMAIN}")
    print(f"  Time    : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*70}{RESET}")

    # Always show what data is in the DB first
    show_available_periods()

    if args.query:
        # Single custom query mode
        header("CUSTOM QUERY")
        result = run_query(args.query)
        print_result(args.query, result, show_rows=20)
        # Also show intent
        subheader("Parsed Intent")
        intent_result = parse_intent(args.query)
        if intent_result.get("success"):
            print(json.dumps(intent_result.get("intent", {}), indent=4, default=str))
        else:
            fail(f"Intent parse: {intent_result.get('error')}")
        return

    if args.section:
        SECTIONS[args.section]()
    else:
        # Run all sections
        for fn in SECTIONS.values():
            fn()

    print(f"\n{BOLD}{GREEN}{'='*70}")
    print(f"  Test run complete")
    print(f"{'='*70}{RESET}\n")


if __name__ == "__main__":
    main()
