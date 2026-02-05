# Production Image (Skipping build stage since we build locally)
FROM node:18-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev

# Copy project files
COPY . .

# Ensure dist exists and has sql-wasm.wasm
RUN mkdir -p dist && \
    cp node_modules/sql.js/dist/sql-wasm.wasm ./dist/ || echo "WASM not found"

# Create directory for sqlite db
RUN mkdir -p /app/data

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/crm_data.db

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
