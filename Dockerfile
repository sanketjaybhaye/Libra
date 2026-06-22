# --- Build Stage (Frontend) ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

# --- Production Run Stage ---
FROM node:20-alpine
WORKDIR /app

# Install build tools needed for native addons (better-sqlite3)
RUN apk add --no-cache python3 make g++

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=4100

# Copy server files
COPY server/ ./server/

# Install production dependencies for the server
RUN cd server && npm install --omit=dev

# Copy built static frontend assets from builder stage
COPY --from=frontend-builder /app/public ./public

# Expose server port
EXPOSE 4100

# Start server
CMD ["node", "server/src/index.js"]
