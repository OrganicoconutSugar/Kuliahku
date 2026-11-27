FROM node:22-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN ./node_modules/.bin/prisma generate --schema=server/prisma/schema.postgres.prisma
RUN npm run typecheck && npx vite build && npm run build:server

FROM node:22-slim AS runner
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm install --no-save prisma@6.19.0 && npm cache clean --force

COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/server/prisma ./server/prisma

EXPOSE 3000

CMD ["sh", "-c", "./node_modules/.bin/prisma db push --schema=server/prisma/schema.postgres.prisma --skip-generate && exec node --max-old-space-size=192 dist-server/server.mjs"]
