# gp-connector-cadprev

GovPilot backend connector for **CadPrev**. This repository provides the initial project foundation for subsequent implementation tasks.

## Stack

- **Runtime:** Node.js 22 LTS
- **Language:** TypeScript
- **Package manager:** pnpm

## Project structure

```
gp-connector-cadprev/
├── .github/          # CI workflows
├── docs/             # Project documentation
├── src/              # Application source code
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

## Scope

This repository currently contains **foundation only**. The following are planned for future tasks:

- Express HTTP server
- Playwright browser automation
- CadPrev scraping pipeline

## License

Proprietary — GovPilot
