#!/usr/bin/env bash
#
# Test the dev app (incl. the camera Scan flow) on a real phone.
#
# The mobile camera (`getUserMedia`) only works over HTTPS, so we can't just hit
# the Mac's LAN IP over http. This starts the Next dev server on localhost and
# exposes it through a Cloudflare quick tunnel, which hands back a trusted public
# https://<random>.trycloudflare.com URL. Open that on your phone (works on Wi-Fi
# or cellular) and the camera will be allowed.
#
# Usage:  npm run dev:mobile   (Ctrl-C to stop both processes)
#
# Requires: cloudflared  ->  brew install cloudflared

set -euo pipefail

PORT="${PORT:-3002}"

command -v cloudflared >/dev/null 2>&1 || {
  echo "✖ cloudflared not found. Install it with:  brew install cloudflared" >&2
  exit 1
}

# Start the dev server, bound so cloudflared (and, if you like, the LAN) can reach it.
npx next dev -H 0.0.0.0 -p "$PORT" &
DEV_PID=$!

# Kill the dev server (and any tunnel) when this script exits.
cleanup() {
  kill "$DEV_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Wait for the dev server to answer before opening the tunnel.
echo "⏳ Waiting for the dev server on http://localhost:$PORT …"
until curl -sf -o /dev/null "http://localhost:$PORT"; do
  # Bail out early if the dev server died.
  kill -0 "$DEV_PID" 2>/dev/null || { echo "✖ Dev server exited." >&2; exit 1; }
  sleep 1
done

echo ""
echo "🌐 Opening a public HTTPS tunnel — look for the https://<...>.trycloudflare.com"
echo "   URL below, then open it in your phone's browser to test the Scan camera."
echo ""

# Runs in the foreground; its https URL is printed here. Ctrl-C stops everything.
cloudflared tunnel --url "http://localhost:$PORT"
