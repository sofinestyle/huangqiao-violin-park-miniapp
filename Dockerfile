FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY admin ./admin
COPY shared ./shared
RUN npx vite build admin
FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=8787
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --chown=node:node server ./server
COPY --chown=node:node shared ./shared
COPY --chown=node:node pg ./pg
COPY --chown=node:node scripts/migrate-pg.mjs scripts/create-account.mjs ./scripts/
COPY --chown=node:node images ./images
COPY --from=build --chown=node:node /app/admin/dist ./admin/dist
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","server/index.mjs"]
