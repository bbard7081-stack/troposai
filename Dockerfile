# Production Image (Skipping build stage since we build locally)
FROM node:18-alpine

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev

# Copy pre-built assets and server files
COPY dist ./dist
COPY server.js ./
COPY database.js ./
COPY services ./services
COPY public ./public
# sql-wasm.wasm needs to be copied from the installed node_modules
RUN cp node_modules/sql.js/dist/sql-wasm.wasm ./dist/ || echo "WASM not found in node_modules"
COPY index.css ./dist/
COPY .env ./
COPY import_users.js ./
COPY sync_users.js ./

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
