# ------------------------------------
# Stage 1: Build TypeScript Application
# ------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

ENV NODE_OPTIONS="--dns-result-order=ipv4first"

# Install dependencies
COPY package*.json ./
COPY tsconfig.json ./
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm install --no-audit --ignore-scripts

# Copy source code and Prisma schema
COPY src/ ./src/
COPY prisma/ ./prisma/

# Generate Prisma Client & compile TypeScript
RUN npx prisma generate
RUN npm run build

# ------------------------------------
# Stage 2: Production Runtime
# ------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_OPTIONS="--dns-result-order=ipv4first"
ENV NODE_ENV=production
ENV PORT=5000

COPY package*.json ./
# Copy installed dependencies and compiled dist from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Create upload directory
RUN mkdir -p /app/uploads

EXPOSE 5000

CMD ["node", "dist/server.js"]
