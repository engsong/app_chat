# ------------------------------------
# Production Runtime Container
# ------------------------------------
FROM node:22-alpine

WORKDIR /app

ENV NODE_OPTIONS="--dns-result-order=ipv4first"
ENV NODE_ENV=production
ENV PORT=5000

COPY package*.json ./
COPY node_modules ./node_modules
COPY dist ./dist
COPY prisma ./prisma

RUN mkdir -p /app/uploads

EXPOSE 5000

CMD ["node", "dist/server.js"]
