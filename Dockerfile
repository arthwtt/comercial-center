FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine AS backend-builder
WORKDIR /app/backend
RUN apk add --no-cache openssl
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=backend-builder --chown=node:node /app/backend /app/backend
COPY --from=frontend-builder --chown=node:node /app/frontend/dist /app/frontend/dist
COPY --chown=node:node docker/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

USER node
WORKDIR /app/backend

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
