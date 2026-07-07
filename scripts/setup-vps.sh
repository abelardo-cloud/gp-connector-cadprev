#!/usr/bin/env bash
set -euo pipefail

APP_USER="${APP_USER:-govpilot}"
APP_ROOT="${APP_ROOT:-/opt/govpilot}"
GP_SDK_REPOSITORY="${GP_SDK_REPOSITORY:-https://github.com/abelardo-cloud/gp-sdk.git}"
GP_CONNECTOR_REPOSITORY="${GP_CONNECTOR_REPOSITORY:-https://github.com/abelardo-cloud/gp-connector-cadprev.git}"
GP_SDK_REF="${GP_SDK_REF:-main}"
GP_CONNECTOR_REF="${GP_CONNECTOR_REF:-main}"
SERVICE_NAME="gp-connector-cadprev"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
CONNECTOR_DIR="${APP_ROOT}/gp-connector-cadprev"
SDK_DIR="${APP_ROOT}/gp-sdk"

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root."
  exit 1
fi

echo "Installing base packages..."
apt-get update
apt-get install -y \
  ca-certificates \
  curl \
  git \
  gnupg \
  lsb-release \
  unzip \
  ufw \
  build-essential

echo "Installing Node.js 22 LTS..."
curl -fsSL https://deb.nodesource.com/setup_22.x -o /tmp/nodesource_setup.sh
bash /tmp/nodesource_setup.sh
apt-get install -y nodejs

echo "Installing pnpm..."
corepack enable
corepack prepare pnpm@9.15.9 --activate

echo "Installing Docker and Docker Compose plugin..."
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release; echo "${VERSION_CODENAME}") stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin

echo "Installing Playwright and Chromium system dependencies..."
apt-get install -y \
  fonts-liberation \
  libasound2t64 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libatspi2.0-0 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libx11-6 \
  libxcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  xdg-utils

echo "Creating application user and directory..."
if ! id "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --create-home --shell /usr/sbin/nologin "${APP_USER}"
fi

mkdir -p "${APP_ROOT}"
chown -R "${APP_USER}:${APP_USER}" "${APP_ROOT}"

echo "Cloning or updating gp-sdk..."
if [ ! -d "${SDK_DIR}/.git" ]; then
  sudo -u "${APP_USER}" git clone "${GP_SDK_REPOSITORY}" "${SDK_DIR}"
fi
sudo -u "${APP_USER}" git -C "${SDK_DIR}" fetch origin "${GP_SDK_REF}"
sudo -u "${APP_USER}" git -C "${SDK_DIR}" checkout "${GP_SDK_REF}"
sudo -u "${APP_USER}" git -C "${SDK_DIR}" pull --ff-only origin "${GP_SDK_REF}"

echo "Building gp-sdk..."
sudo -u "${APP_USER}" bash -lc "cd '${SDK_DIR}'; pnpm install; pnpm build"

echo "Cloning or updating gp-connector-cadprev..."
if [ ! -d "${CONNECTOR_DIR}/.git" ]; then
  sudo -u "${APP_USER}" git clone "${GP_CONNECTOR_REPOSITORY}" "${CONNECTOR_DIR}"
fi
sudo -u "${APP_USER}" git -C "${CONNECTOR_DIR}" fetch origin "${GP_CONNECTOR_REF}"
sudo -u "${APP_USER}" git -C "${CONNECTOR_DIR}" checkout "${GP_CONNECTOR_REF}"
sudo -u "${APP_USER}" git -C "${CONNECTOR_DIR}" pull --ff-only origin "${GP_CONNECTOR_REF}"

echo "Creating production environment file..."
if [ ! -f "${CONNECTOR_DIR}/.env" ]; then
  cat > "${CONNECTOR_DIR}/.env" <<'ENVEOF'
NODE_ENV=production
PORT=3000
CACHE_TTL_SECONDS=1800
PLAYWRIGHT_TIMEOUT=120000
ENVEOF
  chown "${APP_USER}:${APP_USER}" "${CONNECTOR_DIR}/.env"
  chmod 640 "${CONNECTOR_DIR}/.env"
fi

echo "Building gp-connector-cadprev..."
sudo -u "${APP_USER}" bash -lc "cd '${CONNECTOR_DIR}'; pnpm install; pnpm exec playwright install chromium; pnpm build"

echo "Creating systemd service..."
cat > "${SERVICE_FILE}" <<EOF
[Unit]
Description=GovPilot CadPrev Connector
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${CONNECTOR_DIR}
EnvironmentFile=${CONNECTOR_DIR}/.env
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=${CONNECTOR_DIR}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "${SERVICE_NAME}.service"
systemctl restart "${SERVICE_NAME}.service"

echo "Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw --force enable

echo "VPS setup completed."
echo "Service status: systemctl status ${SERVICE_NAME}.service"
