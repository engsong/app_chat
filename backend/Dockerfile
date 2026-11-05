# ------------------------------------
# Stage 1: Build TypeScript Application
# ------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY tsconfig.json ./
RUN npm ci --no-audit

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

ENV NODE_ENV=production
ENV PORT=5000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production --no-audit

# Copy compiled files and prisma schema from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Create upload directory
RUN mkdir -p /app/uploads

EXPOSE 5000

CMD ["node", "dist/server.js"]
