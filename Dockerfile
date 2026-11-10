# One image: API + the five built admin apps (same origin, so the SameSite=Strict auth cookies work).
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/admin-kit/package.json packages/admin-kit/
COPY apps/hotel/package.json apps/hotel/
COPY apps/trips/package.json apps/trips/
COPY apps/transport/package.json apps/transport/
COPY apps/club/package.json apps/club/
COPY apps/operator/package.json apps/operator/
COPY apps/ops/package.json apps/ops/
COPY apps/guest/package.json apps/guest/
RUN npm ci
COPY prisma prisma
RUN npx prisma generate
COPY apps apps
COPY packages packages
RUN npm run build -w apps/api && npm run build:web

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates postgresql-client && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production PORT=4000 UPLOAD_DIR=/data/uploads
COPY --from=build /app /app
RUN mkdir -p /data/uploads && chown -R node:node /data /app
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/server.js"]
