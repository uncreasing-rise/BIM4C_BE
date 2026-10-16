FROM node:22-alpine AS base
# Prisma's query engine needs OpenSSL on Alpine.
RUN apk add --no-cache openssl
WORKDIR /app

FROM base AS build
COPY package*.json ./
# `npm ci` runs the postinstall `prisma generate`, which needs the schema.
COPY prisma ./prisma
RUN npm ci
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM base AS production
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package*.json ./
EXPOSE 8080
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"
CMD ["node", "dist/main.js"]
