FROM node:22-bookworm-slim
WORKDIR /app
COPY server/package*.json server/
RUN cd server && npm ci --omit=dev
COPY shared/ shared/
COPY client/ client/
COPY server/src/ server/src/
ENV NODE_ENV=production PORT=3000 DB_PATH=/data/budget.db
EXPOSE 3000
CMD ["node", "server/src/index.js"]
