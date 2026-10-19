#!/bin/sh
# Builds the launcher and installs it on a TV in LG Developer Mode (no root needed).
#
# One-time setup, with the Developer Mode app open on the TV and Key Server ON:
#   npx ares-setup-device -a tv -i "host=<tv-ip>" -i "port=9922" -i "username=prisoner"
#   npx ares-novacom --device tv --getkey        # asks for the passphrase shown on the TV
#
# Then, any time:
#   sh scripts/install-tv.sh            (or: npm run install:devmode)
#
# It also copies the TV's Developer Mode session token into the app (public/devmode.json,
# git-ignored) so the launcher can renew the session itself; see src/lib/devmode.ts.
set -e
cd "$(dirname "$0")/.."
DEVICE="${TV_DEVICE:-tv}"
APP_ID="$(sed -n 's/.*"id": *"\([^"]*\)".*/\1/p' public/appinfo.json | head -1)"

# Keep a copy of the profiles and settings first, in case the install goes wrong.
node scripts/settings.mjs backup 2>/dev/null || echo "(No settings backup: the launcher isn't running yet.)"

echo "Reading the Developer Mode session token from '$DEVICE'..."
# ares prints "[Info] Set target device" on stdout too; keep only the file's contents.
TOKEN="$(npx ares-novacom --device "$DEVICE" --run "cat /var/luna/preferences/devmode_enabled" 2>/dev/null | grep -v '^\[Info\]' | tr -d '\r\n ' || true)"
if printf '%s' "$TOKEN" | grep -Eq '^[A-Za-z0-9._-]{8,}$'; then
	printf '{"token":"%s"}\n' "$TOKEN" > public/devmode.json
	echo "Token saved; the launcher will keep Developer Mode renewed."
else
	rm -f public/devmode.json
	echo "No token found. The launcher will install, but press Extend in the Developer Mode app every two days." >&2
fi

npm run build
npm run package
IPK="$(ls build/*.ipk | head -1)"

echo "Installing $(basename "$IPK")..."
npx ares-install --device "$DEVICE" "$IPK"
echo "Launching $APP_ID..."
npx ares-launch --device "$DEVICE" "$APP_ID"
