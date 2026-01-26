# S3 File Browser

A web interface for managing files across multiple S3 buckets.

## Key Features

- **Multi-Bucket Support**: Seamlessly switch between different configured S3 buckets.
- **File Management**: Upload, download, delete files, and create folders with ease.
- **Image Preview**: Built-in high-performance image viewer with zoom, rotation, and gallery navigation.
- **Transfer Tracking**: Real-time dashboard for monitoring upload and download progress, speed, and network quality.
- **Secure Access**: Protected by Local credentials or OIDC (OpenID Connect) authentication with PKCE support.

## Deployment

The application is designed to be deployed as a Docker container.

### 1. Configure Environment
Create a `.env` file based on `.env.example`:

```env
# S3 Credentials
S3_ENDPOINT=http://your-s3-endpoint:9000
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
S3_BUCKET_NAME=bucket1,bucket2

# Security
JWT_SECRET=your-secure-random-string

# Auth (Local)
AUTH_LOCAL_ENABLED=true
AUTH_USER=admin
AUTH_PASS=password123
```

### 2. Run with Docker

```bash
# Build the image
docker build -t s3-viewer .

# Run the container
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  --name s3-viewer \
  s3-viewer
```

Access the application at `http://localhost:3000`.
