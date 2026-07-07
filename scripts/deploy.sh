#!/usr/bin/env bash
set -euo pipefail

APP_USER="${APP_USER:-govpilot}"
APP_ROOT="${APP_ROOT:-/opt/govpilot}"
GP_SDK_REF="${GP_SDK_REF:-main}"
GP_CONNECTOR_REF="${GP_CONNECTOR_REF:-main}"
SERVICE_NAME="gp-connector-cadprev"
SDK_DIR="${APP_ROOT}/gp-sdk"
CONNECTOR_DIR="${APP_ROOT}/gp-connector-cadprev"

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root."
  exit 1
fi

echo "Updating gp-sdk..."
sudo -u "${APP_USER}" git -C "${SDK_DIR}" fetch origin "${GP_SDK_REF}"
sudo -u "${APP_USER}" git -C "${SDK_DIR}" checkout "${GP_SDK_REF}"
sudo -u "${APP_USER}" git -C "${SDK_DIR}" pull --ff-only origin "${GP_SDK_REF}"
sudo -u "${APP_USER}" bash -lc "cd '${SDK_DIR}'; pnpm install; pnpm build"

echo "Updating gp-connector-cadprev..."
sudo -u "${APP_USER}" git -C "${CONNECTOR_DIR}" fetch origin "${GP_CONNECTOR_REF}"
sudo -u "${APP_USER}" git -C "${CONNECTOR_DIR}" checkout "${GP_CONNECTOR_REF}"
sudo -u "${APP_USER}" git -C "${CONNECTOR_DIR}" pull --ff-only origin "${GP_CONNECTOR_REF}"
sudo -u "${APP_USER}" bash -lc "cd '${CONNECTOR_DIR}'; pnpm install; pnpm exec playwright install chromium; pnpm build"

echo "Restarting ${SERVICE_NAME}..."
systemctl restart "${SERVICE_NAME}.service"
systemctl status "${SERVICE_NAME}.service" --no-pager

echo "Deploy completed."
