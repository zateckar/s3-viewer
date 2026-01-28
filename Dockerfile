FROM oven/bun:latest

WORKDIR /app

# Copy dependency files
COPY package.json ./

# Install dependencies
RUN bun install --production

# Copy source code
COPY . .

# Create data directory for persistent storage (config and files)
RUN mkdir -p /data/config /data/storage && chown -R bun:bun /data

# Volume for persistence
VOLUME /data

# Expose the port the app runs on
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Run the application
CMD ["bun", "run", "src/backend/index.ts"]
