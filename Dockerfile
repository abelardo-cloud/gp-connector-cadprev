FROM node:22-bookworm-slim AS production

RUN apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates; \
    rm -rf /var/lib/apt/lists/*

RUN corepack enable; \
    corepack prepare pnpm@9.15.9 --activate

WORKDIR /workspace

COPY gp-sdk/package.json gp-sdk/pnpm-lock.yaml gp-sdk/tsconfig.json gp-sdk/tsconfig.build.json ./gp-sdk/
COPY gp-sdk/src ./gp-sdk/src

WORKDIR /workspace/gp-sdk

RUN pnpm install --frozen-lockfile
RUN pnpm build

WORKDIR /workspace/gp-connector-cadprev

COPY gp-connector-cadprev/package.json gp-connector-cadprev/pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY gp-connector-cadprev/tsconfig.json ./
COPY gp-connector-cadprev/src ./src

RUN pnpm build
RUN pnpm prune --prod
RUN pnpm exec playwright install --with-deps chromium

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["pnpm", "start"]
