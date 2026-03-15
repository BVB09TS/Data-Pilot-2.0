#!/usr/bin/env bash
# Prints the GitHub OAuth App settings you need for this Codespace.
# Run: bash scripts/codespace-oauth-setup.sh

set -e

if [ -n "$CODESPACE_NAME" ]; then
  API_URL="https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
  WEB_URL="https://${CODESPACE_NAME}-5173.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
else
  API_URL="http://localhost:3000"
  WEB_URL="http://localhost:5173"
fi

CALLBACK="${API_URL}/auth/github/callback"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  GitHub OAuth App Settings"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  1. Go to: https://github.com/settings/developers"
echo "     → OAuth Apps → New OAuth App"
echo ""
echo "  Homepage URL:        ${WEB_URL}"
echo "  Authorization callback URL: ${CALLBACK}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Add to your .env file:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  GITHUB_CLIENT_ID=<paste Client ID here>"
echo "  GITHUB_CLIENT_SECRET=<paste Client Secret here>"
echo "  API_URL=${API_URL}"
echo "  FRONTEND_URL=${WEB_URL}"
echo ""
echo "  Then restart: pnpm dev"
echo ""
