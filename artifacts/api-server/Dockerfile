FROM node:24-alpine AS base
RUN npm install -g pnpm@10.26.1
WORKDIR /app

# Copiar manifests para instalar dependências
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/api-spec/package.json ./lib/api-spec/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/db/package.json ./lib/db/
COPY artifacts/api-server/package.json ./artifacts/api-server/

# Instalar todas as dependências do workspace
RUN pnpm install --frozen-lockfile

# Copiar código fonte das libs
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/

# Build das libs (TypeScript composite)
RUN pnpm run typecheck:libs

# Build do servidor
RUN pnpm --filter @workspace/api-server run build

FROM node:24-alpine AS runner
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
