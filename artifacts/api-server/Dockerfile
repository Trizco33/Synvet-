FROM node:24-slim AS base
RUN npm install -g pnpm@10.26.1
WORKDIR /app

# Manifests e configs de raiz
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.base.json tsconfig.json ./

# Package.json de cada lib/artifact necessário
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/db/package.json ./lib/db/
COPY artifacts/api-server/package.json ./artifacts/api-server/

RUN pnpm install --frozen-lockfile

# Código fonte completo das libs
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/

RUN pnpm run typecheck:libs
RUN pnpm --filter @workspace/api-server run build

FROM node:24-slim AS runner
RUN npm install -g pnpm@10.26.1
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/db/package.json ./lib/db/
COPY artifacts/api-server/package.json ./artifacts/api-server/

RUN pnpm install --frozen-lockfile --prod

COPY --from=base /app/artifacts/api-server/dist ./artifacts/api-server/dist

ENV NODE_ENV=production
WORKDIR /app/artifacts/api-server

EXPOSE 8080
CMD ["node", "--enable-source-maps", "./dist/index.mjs"]
