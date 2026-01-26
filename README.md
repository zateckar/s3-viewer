# S3 File Browser

A simple web application for browsing and downloading files from S3-compatible storage services, built with Bun and Alpine.js.

## Features

- 📁 Browse files and folders in S3 buckets
- 🔄 **Multi-bucket support** - Configure and switch between multiple S3 buckets
- ⬇️ Download files with presigned URLs
- 📂 Create new folders
- 🗑️ Delete files and folders
- 📱 Responsive design that works on mobile and desktop
- 🔒 Secure path validation and CORS handling
- 🚀 Fast development with Bun runtime

## Technology Stack

- **Backend**: Bun (runtime, package manager, bundler)
- **Frontend**: Vanilla JavaScript with Alpine.js
- **Storage**: S3-compatible services. Use Bun as S3 client
- **Styling**: Custom CSS
- **API**: RESTful JSON API

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) installed

### Installation

1. Clone this repository:
```bash
git clone <repository-url>
cd s3-viewer
```

2. Install dependencies:
```bash
bun install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

5. Start the development server:
```bash
bun run dev
```

6. Open your browser and navigate to:
- Application: http://localhost:3000

## Project Structure

```
s3-viewer/
├── src/
│   ├── backend/                 # Backend server code
│   │   ├── index.ts             # Main server entry point
│   │   ├── routes/              # API routes
│   │   ├── services/            # Business logic
│   │   ├── middleware/          # Express/ Bun middleware
│   │   └── utils/               # Utility functions
│   ├── frontend/                # Frontend application
│   │   ├── index.html           # Main HTML file
│   │   ├── css/                 # Stylesheets
│   │   └── js/                  # JavaScript code
│   └── shared/                  # Shared types and utilities
├── tests/                       # Test files
├── scripts/                     # Utility scripts
├── docs/                        # Documentation
└── docker-compose.yml           # Local S3 configuration
```

## API Endpoints

### File Management

- `GET /api/v1/files` - List files and folders
- `GET /api/v1/files/{path}` - Get file/folder details
- `GET /api/v1/files/download?path={path}` - Get download URL
- `POST /api/v1/files` - Create folder
- `DELETE /api/v1/files/{path}` - Delete file/folder

### Bucket Management

- `GET /api/v1/buckets` - List available buckets
- `GET /api/v1/buckets?validate=true` - List buckets with accessibility status
- `POST /api/v1/buckets` - Switch to a different bucket

### Response Format

All API responses follow this format:

```json
{
  "success": true,
  "data": { /* Response data */ },
  "message": "Operation completed successfully"
}
```

Error responses:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { /* Additional error details */ }
  }
}
```

## Configuration

The application is configured through environment variables:

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# S3 Configuration
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET_NAME=bucket1,bucket2,bucket3  # Multiple buckets (comma-separated, first is default)
S3_REGION=us-east-1

# Security
JWT_SECRET=your-jwt-secret-key-here
ALLOWED_ORIGINS=http://localhost:3000
```

## Multi-Bucket Configuration

The application supports multiple S3 buckets with a single set of credentials:

### Configuration

Set up multiple buckets in your `.env` file:

```bash
# Multiple buckets separated by commas
S3_BUCKET_NAME=bucket1,bucket2,bucket3

# The first bucket (bucket1) will be used as the default
# All buckets will use the same credentials (S3_ACCESS_KEY, S3_SECRET_KEY)
```

### Features

- **Bucket Selector**: Dropdown in the header to switch between buckets
- **Validation**: Automatically checks if buckets are accessible
- **Status Indicators**: Visual indicators for default and inaccessible buckets
- **Seamless Switching**: Change buckets without page reload
- **Path Isolation**: Each bucket maintains its own file browsing state

### Bucket Status Types

- ⭐ **Default**: The first bucket configured in `S3_BUCKET_NAME`
- 📦 **Accessible**: Bucket is reachable and has proper permissions
- 🔒 **Inaccessible**: Bucket exists but cannot be accessed (permission issues)

### Usage

1. Configure multiple buckets in your `.env` file
2. Start the application
3. Use the bucket dropdown in the header to switch between buckets
4. The application will automatically validate bucket accessibility
5. Each bucket maintains its own separate file browsing context

## Development

### Available Scripts

- `bun run dev` - Start development server with hot reload
- `bun run start` - Start production server
- `bun run build` - Build for production
- `bun run test` - Run tests
- `bun run typecheck` - Run TypeScript type checking

### Testing

Run the test suite:
```bash
bun test
```

Run tests in watch mode:
```bash
bun test --watch
```

## Production Deployment

### Using Docker

1. Build the Docker image:
```bash
docker build -t s3-viewer .
```

2. Run with environment variables:
```bash
docker run -p 3000:3000 \
  -e S3_ENDPOINT=https://s3.amazonaws.com \
  -e S3_ACCESS_KEY=your-access-key \
  -e S3_SECRET_KEY=your-secret-key \
  -e S3_BUCKET_NAME=your-bucket \
  s3-viewer
```

### Environment Setup

1. Set production environment variables
2. Configure your S3 bucket and IAM policies
3. Deploy the application
4. Set up a reverse proxy (nginx, CloudFront, etc.)

## Security Considerations

- Path validation prevents directory traversal attacks
- Presigned URLs provide temporary, secure file access
- CORS configuration restricts access to allowed origins
- Input validation on all user inputs
- S3 permissions follow the principle of least privilege

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Troubleshooting

### MinIO Connection Issues

If you can't connect to MinIO:
1. Check if Docker is running
2. Verify the MinIO container is healthy: `docker-compose ps`
3. Check logs: `docker-compose logs minio`
4. Ensure port 9000 and 9001 are available

### File Upload/Download Issues

If files aren't appearing:
1. Check your S3 credentials in `.env`
2. Verify the bucket exists
3. Check IAM policies if using AWS S3
4. Review browser console for JavaScript errors

### CORS Errors

If you see CORS errors:
1. Check the `ALLOWED_ORIGINS` environment variable
2. Verify your browser is accessing the correct URL
3. Check the CORS middleware configuration

## Support

For support and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the API documentation