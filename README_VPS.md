# VPS Deployment

This document describes the Hostinger VPS deployment flow for `gp-connector-cadprev` on Ubuntu 24.04.

## Files

- `scripts/setup-vps.sh`: prepares a fresh VPS for production.
- `scripts/deploy.sh`: updates `gp-sdk` and `gp-connector-cadprev`, rebuilds, and restarts the service.

## What Setup Installs

The setup script installs:

- `git`, `curl`, `unzip`, `build-essential`, and `ufw`
- Node.js 22 LTS
- `pnpm` through Corepack
- Docker Engine
- Docker Compose plugin
- Playwright and Chromium runtime dependencies

## Production Layout

The setup script creates:

```text
/opt/govpilot/
  gp-sdk/
  gp-connector-cadprev/
```

The connector runs through systemd as:

```text
gp-connector-cadprev.service
```

The service runs:

```bash
node dist/index.js
```

Default environment:

```text
NODE_ENV=production
PORT=3000
CACHE_TTL_SECONDS=1800
PLAYWRIGHT_TIMEOUT=120000
```

Firewall ports opened by setup:

```text
22
80
443
3000
```

## First Setup

Copy `scripts/setup-vps.sh` to the VPS and run it as root.

Optional environment overrides:

```bash
APP_USER=govpilot
APP_ROOT=/opt/govpilot
GP_SDK_REPOSITORY=https://github.com/abelardo-cloud/gp-sdk.git
GP_CONNECTOR_REPOSITORY=https://github.com/abelardo-cloud/gp-connector-cadprev.git
GP_SDK_REF=main
GP_CONNECTOR_REF=main
```

The setup script clones both repositories, runs `pnpm install`, runs `pnpm build`, creates the systemd service, enables it, starts it, and configures `ufw`.

## Deploy Updates

Copy `scripts/deploy.sh` to the VPS and run it as root after the first setup.

The deploy script:

- Updates `gp-sdk` with `git pull`.
- Updates `gp-connector-cadprev` with `git pull`.
- Runs `pnpm install`.
- Runs `pnpm build`.
- Restarts `gp-connector-cadprev.service`.

## Useful Checks

```bash
systemctl status gp-connector-cadprev.service
journalctl -u gp-connector-cadprev.service -f
curl http://localhost:3000/health
curl "http://localhost:3000/api/v1/cadprev/crp?ente=Santa%20Catarina"
```
