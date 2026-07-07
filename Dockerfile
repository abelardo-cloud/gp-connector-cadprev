FROM node:22-bookworm-slim AS production

RUN apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates git; \
    rm -rf /var/lib/apt/lists/*

RUN corepack enable; \
    corepack prepare pnpm@9.15.9 --activate

ARG GP_SDK_REPOSITORY=https://github.com/abelardo-cloud/gp-sdk.git
ARG GP_SDK_REF=main

RUN git clone --depth 1 --branch "${GP_SDK_REF}" "${GP_SDK_REPOSITORY}" /gp-sdk

WORKDIR /gp-sdk

RUN pnpm install --frozen-lockfile
RUN pnpm build

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src

RUN pnpm build
RUN pnpm prune --prod
RUN pnpm exec playwright install --with-deps chromium

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["pnpm", "start"]
