FROM oven/bun:latest

WORKDIR /app

# Copy dependency files
COPY package.json ./

# Install dependencies
RUN bun install --production

# Copy source code
COPY . .

# Create data directories for configuration and file storage persistence
RUN mkdir -p /app/data /data/storage && chown -R bun:bun /app/data /data/storage

# Expose the port the app runs on
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Run the application
CMD ["bun", "run", "src/backend/index.ts"]
