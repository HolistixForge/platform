#!/usr/bin/env python3
"""
Hub OAuth Proxy - Lightweight JupyterHub OAuth/API emulator.

Runs inside the user container on localhost:15000, providing the minimum
JupyterHub API surface needed by jupyterhub-singleuser to:
  1. Authenticate users via OAuth (browser-facing /hub/api/oauth2/authorize)
  2. Exchange auth codes for tokens (server-to-server)
  3. Return per-user identity so jupyter-collaboration shows real cursors

The auth guard proxy injects X-Auth-* headers on all browser requests,
so the authorize endpoint reads identity from those headers directly.
"""

import argparse
import hashlib
import json
import secrets
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlencode, urlparse

# ---------------------------------------------------------------------------
# In-memory stores
# ---------------------------------------------------------------------------

# auth_code -> {token, user_name, user_id, user_email, expires}
_auth_codes: dict = {}
_auth_codes_lock = threading.Lock()

# access_token -> {user_name, user_id, user_email, created}
_access_tokens: dict = {}
_access_tokens_lock = threading.Lock()

AUTH_CODE_TTL = 300        # 5 minutes
ACCESS_TOKEN_TTL = 86400   # 24 hours

# Set via CLI --api-token; used to authenticate server-to-server calls
_hub_api_token: str = ""

# Static JupyterHub user name used in env vars (for scope matching)
JUPYTERHUB_USER = "jupyter-user"


# ---------------------------------------------------------------------------
# Cleanup thread
# ---------------------------------------------------------------------------

def _cleanup_loop():
    """Periodically remove expired auth codes and access tokens."""
    while True:
        time.sleep(60)
        now = time.time()
        with _auth_codes_lock:
            expired = [k for k, v in _auth_codes.items() if v["expires"] < now]
            for k in expired:
                del _auth_codes[k]
        with _access_tokens_lock:
            expired = [
                k
                for k, v in _access_tokens.items()
                if (now - v["created"]) > ACCESS_TOKEN_TTL
            ]
            for k in expired:
                del _access_tokens[k]


# ---------------------------------------------------------------------------
# Request handler
# ---------------------------------------------------------------------------

class HubOAuthHandler(BaseHTTPRequestHandler):
    """Handles the subset of JupyterHub API used by jupyterhub-singleuser."""

    # Silence per-request log lines (set to True for debugging)
    _quiet = False

    def log_message(self, fmt, *args):
        if not self._quiet:
            sys.stderr.write(
                "[hub-oauth-proxy] %s - %s\n" % (self.address_string(), fmt % args)
            )
            sys.stderr.flush()

    # -- routing -------------------------------------------------------------

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "/health":
            self._respond_json(200, {"status": "healthy"})
        elif path == "/hub/api":
            self._handle_api_version()
        elif path == "/hub/api/oauth2/authorize":
            self._handle_authorize(parsed)
        elif path == "/hub/api/user":
            self._handle_get_user()
        elif path == "/hub/api/authorizations/token":
            # Token validation used by some jupyterhub versions
            self._handle_get_user()
        else:
            self._respond_json(404, {"error": "not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "/hub/api/oauth2/token":
            self._handle_token_exchange()
        elif path.startswith("/hub/api/users/") and path.endswith("/activity"):
            # Activity ping — no-op
            self._respond_json(200, {})
        else:
            self._respond_json(404, {"error": "not found"})

    def do_PATCH(self):
        # Some JupyterHub clients send PATCH for activity
        self.do_POST()

    # -- endpoint handlers ---------------------------------------------------

    def _handle_api_version(self):
        """GET /hub/api — version check used by jupyterhub-singleuser."""
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("X-JupyterHub-Version", "4.0.0")
        self.end_headers()
        self.wfile.write(json.dumps({"version": "4.0.0"}).encode())

    def _handle_authorize(self, parsed):
        """GET /hub/api/oauth2/authorize — browser-facing, auth guard injects X-Auth-* headers."""
        qs = parse_qs(parsed.query)

        redirect_uri = qs.get("redirect_uri", [None])[0]
        state = qs.get("state", [None])[0]

        if not redirect_uri:
            self._respond_json(400, {"error": "missing redirect_uri"})
            return

        # Read identity from auth guard headers
        user_name = (
            self.headers.get("X-Auth-User-Name")
            or self.headers.get("X-Auth-Username")
            or "anonymous"
        )
        user_id = self.headers.get("X-Auth-User-Id", "")
        user_email = self.headers.get("X-Auth-User-Email", "")

        # Generate auth code
        code = secrets.token_urlsafe(32)
        access_token = secrets.token_hex(32)

        with _auth_codes_lock:
            _auth_codes[code] = {
                "token": access_token,
                "user_name": user_name,
                "user_id": user_id,
                "user_email": user_email,
                "expires": time.time() + AUTH_CODE_TTL,
            }

        # Pre-register the access token so it's valid immediately after exchange
        with _access_tokens_lock:
            _access_tokens[access_token] = {
                "user_name": user_name,
                "user_id": user_id,
                "user_email": user_email,
                "created": time.time(),
            }

        # Build redirect back to jupyterhub-singleuser oauth_callback
        params = {"code": code}
        if state:
            params["state"] = state

        sep = "&" if "?" in redirect_uri else "?"
        location = redirect_uri + sep + urlencode(params)

        self.send_response(302)
        self.send_header("Location", location)
        self.end_headers()

        self.log_message(
            "authorize: user=%s redirect=%s", user_name, redirect_uri
        )

    def _handle_token_exchange(self):
        """POST /hub/api/oauth2/token — exchange auth code for access token."""
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8") if content_length else ""

        params = parse_qs(body)
        code = params.get("code", [None])[0]

        if not code:
            self._respond_json(400, {"error": "missing code"})
            return

        with _auth_codes_lock:
            entry = _auth_codes.pop(code, None)

        if not entry:
            self._respond_json(400, {"error": "invalid or expired code"})
            return

        if entry["expires"] < time.time():
            self._respond_json(400, {"error": "expired code"})
            return

        self._respond_json(200, {
            "access_token": entry["token"],
            "token_type": "Bearer",
        })

        self.log_message(
            "token exchange: user=%s", entry["user_name"]
        )

    def _handle_get_user(self):
        """GET /hub/api/user — return JupyterHub user model from access token."""
        auth_header = self.headers.get("Authorization", "")

        token = None
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
        elif auth_header.startswith("token "):
            token = auth_header[6:]

        # Also accept the hub API token (used by jupyterhub-singleuser itself)
        if token == _hub_api_token:
            self._respond_json(200, _build_user_model("jupyter-service", "", ""))
            return

        if not token:
            self._respond_json(401, {"error": "missing token"})
            return

        with _access_tokens_lock:
            entry = _access_tokens.get(token)

        if not entry:
            self._respond_json(403, {"error": "invalid token"})
            return

        user_model = _build_user_model(
            entry["user_name"], entry["user_id"], entry["user_email"]
        )

        self._respond_json(200, user_model)

    # -- helpers -------------------------------------------------------------

    def _respond_json(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def _build_user_model(user_name, user_id, user_email):
    """Build a JupyterHub-compatible user model."""
    session_id = hashlib.sha256(user_name.encode()).hexdigest()[:16]

    return {
        "kind": "user",
        "name": user_name,
        "admin": False,
        "groups": [],
        "roles": ["user"],
        "scopes": [
            f"access:servers!server={JUPYTERHUB_USER}/",
            f"access:servers!user={JUPYTERHUB_USER}",
        ],
        "session_id": session_id,
        "server": f"/user/{JUPYTERHUB_USER}/",
        "servers": {
            "": {
                "name": "",
                "url": f"/user/{JUPYTERHUB_USER}/",
                "ready": True,
                "started": "2024-01-01T00:00:00Z",
                "last_activity": "2024-01-01T00:00:00Z",
                "state": {"pid": 1},
                "progress_url": "",
                "pending": None,
            }
        },
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Hub OAuth Proxy")
    parser.add_argument("--port", type=int, default=15000, help="Listen port")
    parser.add_argument(
        "--api-token",
        required=True,
        help="Shared secret for server-to-server auth (JUPYTERHUB_API_TOKEN)",
    )
    args = parser.parse_args()

    global _hub_api_token
    _hub_api_token = args.api_token

    # Start cleanup thread
    t = threading.Thread(target=_cleanup_loop, daemon=True)
    t.start()

    server = HTTPServer(("127.0.0.1", args.port), HubOAuthHandler)
    print(
        f"[hub-oauth-proxy] listening on 127.0.0.1:{args.port}",
        flush=True,
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    server.server_close()


if __name__ == "__main__":
    main()
