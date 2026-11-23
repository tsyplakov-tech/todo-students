FROM node:22-bookworm-slim AS tooling
ENV CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
COPY prisma.config.mjs tsconfig.prisma.json ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
RUN npm run build
CMD ["npm", "run", "db:migrate"]

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=tooling /app/dist/ ./
USER node
ENV HOST=0.0.0.0 PORT=3000 NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/server.js"]
