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
docker compose up --build
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
