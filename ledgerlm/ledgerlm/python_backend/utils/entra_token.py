"""
Azure Entra ID token fetcher for PostgreSQL Managed Identity auth.

Azure exposes two different MSI endpoints depending on the host:

  App Service / Container Apps:
    URL    → $IDENTITY_ENDPOINT?resource=...&api-version=2019-08-01
    Header → X-IDENTITY-HEADER: $IDENTITY_HEADER

  Bare VM / VMSS:
    URL    → http://169.254.169.254/metadata/identity/oauth2/token?...
    Header → Metadata: true

We try the App Service path first and fall back to VM IMDS.
Token is cached in-process and refreshed 5 minutes before expiry.
"""

import os
import time
import logging
import requests

logger = logging.getLogger(__name__)

PG_RESOURCE = "https://ossrdbms-aad.database.windows.net"

# VM IMDS fallback — NOT available inside App Service containers
VM_IMDS_URL = (
    "http://169.254.169.254/metadata/identity/oauth2/token"
    "?api-version=2019-08-01"
    f"&resource={PG_RESOURCE}"
)

REFRESH_BUFFER_SECONDS = 5 * 60  # refresh 5 min before expiry

_token_cache: dict = {}  # keys: token, expires_at


def get_entra_token() -> str:
    """Fetch (or return cached) Azure Entra access token for Postgres auth."""
    now = time.time()
    expires_at = _token_cache.get("expires_at", 0)

    if _token_cache.get("token") and expires_at - now > REFRESH_BUFFER_SECONDS:
        return _token_cache["token"]

    identity_endpoint = os.environ.get("IDENTITY_ENDPOINT")
    identity_header   = os.environ.get("IDENTITY_HEADER")

    try:
        if identity_endpoint and identity_header:
            # ── Azure App Service / Container Apps MSI ────────────────────────
            url = f"{identity_endpoint}?resource={PG_RESOURCE}&api-version=2019-08-01"
            logger.info("[EntraToken] Fetching token via App Service IDENTITY_ENDPOINT...")
            resp = requests.get(
                url,
                headers={"X-IDENTITY-HEADER": identity_header},
                timeout=15,
            )
        else:
            # ── VM IMDS fallback ──────────────────────────────────────────────
            logger.info("[EntraToken] IDENTITY_ENDPOINT not set — using VM IMDS...")
            resp = requests.get(
                VM_IMDS_URL,
                headers={"Metadata": "true"},
                timeout=15,
            )

        resp.raise_for_status()

    except requests.RequestException as exc:
        raise RuntimeError(
            f"[EntraToken] Token fetch failed: {exc}\n"
            f"  IDENTITY_ENDPOINT = {identity_endpoint or '(not set)'}\n"
            f"  IDENTITY_HEADER   = {'(present)' if identity_header else '(not set)'}"
        ) from exc

    data = resp.json()
    if "access_token" not in data:
        raise RuntimeError(
            f"[EntraToken] No access_token in response: {str(data)[:200]}"
        )

    _token_cache["token"]      = data["access_token"]
    _token_cache["expires_at"] = int(data["expires_on"])  # unix seconds

    expires_in_min = round((_token_cache["expires_at"] - now) / 60)
    logger.info(f"[EntraToken] Token fetched via App Service MSI. Expires in ~{expires_in_min} minutes.")

    return _token_cache["token"]


def get_token_status() -> dict:
    """Return cache state without fetching — for health/status endpoints."""
    if not _token_cache.get("token"):
        return {"cached": False}
    expires_in_s = _token_cache["expires_at"] - time.time()
    return {
        "cached": True,
        "expires_in_seconds": round(expires_in_s),
        "expires_in_minutes": round(expires_in_s / 60),
    }
