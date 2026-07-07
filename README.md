# gp-connector-cadprev

GovPilot backend connector for **CadPrev**. This repository provides the initial project foundation for subsequent implementation tasks.

## Stack

- **Runtime:** Node.js 22 LTS
- **Language:** TypeScript
- **Package manager:** pnpm
- **GovPilot SDK:** `@govpilot/sdk`
- **Browser automation:** GovPilot SDK + Chromium

## Project structure

```
gp-connector-cadprev/
├── .github/          # CI workflows
├── docs/             # Project documentation
├── src/              # Application source code
│   ├── api/          # Express server setup
│   ├── config/       # Environment configuration
│   └── routes/       # HTTP routes
├── tests/            # Automated tests
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

## Prerequisites

- Node.js >= 22
- pnpm >= 9
- Local sibling checkout of `gp-sdk` at `../gp-sdk` for local development

## Getting started

```bash
# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env

# Build
pnpm build

# Run tests
pnpm test
```

## Scripts

| Script        | Description                    |
|---------------|--------------------------------|
| `pnpm build`  | Compile TypeScript to `dist/`  |
| `pnpm start`  | Run compiled application       |
| `pnpm dev`    | Watch mode for TypeScript      |
| `pnpm test`   | Run test suite                 |
| `pnpm typecheck` | Type-check without emit     |

## Docker

```bash
# From this directory
docker compose up --build
```

Docker builds use this repository as the build context:

```bash
docker build -f Dockerfile .
```

The production image clones and compiles `gp-sdk`, compiles this connector, installs Chromium dependencies for Playwright, and starts the compiled app with `pnpm start`.

## Production

The production entrypoint is:

```bash
pnpm start
```

This runs `node dist/index.js`. The server binds to `process.env.PORT`, falling back to `3000` when `PORT` is not set.

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP server port. Railway provides this automatically. |
| `CACHE_TTL_SECONDS` | `1800` | In-memory CRP response cache TTL. |

## Deploy Railway

The provided `railway.toml` points Railway to the Dockerfile at the repository root:

```toml
dockerfilePath = "/Dockerfile"
```

The Dockerfile resolves the local `file:../gp-sdk` dependency by cloning `gp-sdk` into `/gp-sdk` during image build.

Configure the Railway service with:

- Builder: Dockerfile
- Healthcheck path: `/health`
- Environment:
  - `NODE_ENV=production`
  - `CACHE_TTL_SECONDS=1800`

After deploy, validate:

```bash
curl https://<railway-domain>/health
curl "https://<railway-domain>/api/v1/cadprev/crp?cnpj=82951229000176"
```

## Temporary Browser Check

While the Browser Engine foundation is being integrated, the backend exposes:

```bash
GET /browser/test
```

The endpoint uses `@govpilot/sdk` to start Chromium, open `https://example.com`, close browser resources, and return:

```json
{"browser":"ok"}
```

## Scope

This repository currently contains **foundation only**. The following are planned for future tasks:

- CadPrev scraping pipeline
- Browser Manager
- Parser
- Cache

## License

Proprietary — GovPilot
