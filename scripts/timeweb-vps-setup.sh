#!/usr/bin/env bash
set -euo pipefail

# Run on the Timeweb VPS from the repo root:
#   bash scripts/timeweb-vps-setup.sh

if [[ ! -f docker-compose.yml ]]; then
  echo "Run this script from the mystix repo root."
  exit 1
fi

if [[ ! -f backend/.env ]]; then
  echo "Create backend/.env first (copy backend/.env.example and fill keys)."
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker..."
  sudo apt-get update
  sudo apt-get install -y docker.io docker-compose-v2
  sudo usermod -aG docker "$USER" || true
fi

sudo docker compose up -d --build api

echo
echo "API should be at https://arcanyx.ru/api/health"
echo "Also open this port in Timeweb firewall: TCP 8000"
echo
echo "If Google login is enabled, add this redirect URI in Google Cloud Console:"
echo "  https://arcanyx.ru/api/auth/google/callback"
echo "and set PUBLIC_API_URL=https://arcanyx.ru in backend/.env"
