FROM node:22-bookworm-slim AS deps
# npm ci compiles better-sqlite3 when its prebuilt download from GitHub fails. The slim image has
# no compiler, so without these a GitHub outage fails the deploy. Installed before the COPY so
# this layer stays cached through the package.json change in every version bump.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
COPY server/package*.json server/
COPY --from=deps /app/server/node_modules server/node_modules
COPY shared/ shared/
COPY client/ client/
COPY server/src/ server/src/
ENV NODE_ENV=production PORT=3000 DB_PATH=/data/budget.db
EXPOSE 3000
# drop root — the /data volume must be writable by uid 1000 (see docs/V2-SETUP.md)
USER node
CMD ["node", "server/src/index.js"]
