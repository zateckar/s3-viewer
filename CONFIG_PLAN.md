# S3 Viewer - UI Configuration System Plan

## Overview
Add UI configuration options for S3 and OIDC settings that have higher priority over environment variables. Designed for small application deployment in Docker containers.

## Requirements
- Simple JSON file storage in mounted Docker volume
- UI configuration takes priority over environment variables
- Basic admin access control
- Connection testing capabilities
- Appropriate complexity for small deployment

## Architecture

### Storage
- **Config File**: `/app/data/.s3-viewer-config.json`
- **Docker Volume**: `./data:/app/data`
- **Format**: JSON file with simple structure
- **Persistence**: Survives container restarts via mounted volume

### Configuration Priority
1. UI Config (JSON file) - **Highest Priority**
2. Environment Variables
3. Default Values - **Lowest Priority**

### Configuration Structure
```json
{
  "s3": {
    "endpoint": "http://localhost:9000",
    "accessKeyId": "minioadmin",
    "secretAccessKey": "minioadmin",
    "bucketName": "s3-viewer-demo",
    "bucketNames": ["s3-viewer-demo"],
    "region": "us-east-1"
  },
  "auth": {
    "local": {
      "enabled": true,
      "user": "admin",
      "pass": "admin123"
    },
    "oidc": {
      "enabled": false,
      "issuer": "https://keycloak.example.com/realms/myrealm",
      "clientId": "s3-viewer",
      "clientSecret": "",
      "redirectUri": "http://localhost:3000/auth/callback",
      "scope": "openid profile email"
    }
  },
  "security": {
    "jwtSecret": "default-jwt-secret-change-in-production",
    "allowedOrigins": ["http://localhost:3000"]
  }
}
```

## Implementation Plan

### 1. Storage Layer
- Create `/app/data` directory in Docker container
- Implement JSON read/write operations
- Handle file creation/population defaults

### 2. Configuration Manager
- Load configuration at startup
- Merge UI config > env vars > defaults
- Provide access methods for other components

### 3. API Endpoints
- `GET /api/v1/config` - Get current config (secrets masked)
- `PUT /api/v1/config` - Update configuration
- `POST /api/v1/config/test` - Test connections

### 4. Frontend UI
- Settings gear icon in header
- Configuration modal with tabs (S3, OIDC, Security)
- Form fields for all configuration options
- Connection test buttons
- Save/restart notification

### 5. Security
- Admin access only (local login users)
- Mask sensitive data in API responses
- Basic input validation
- No complex authentication needed

## Development Steps

1. **Create Configuration Types** - Define TypeScript interfaces
2. **Implement Storage** - JSON file operations in `/app/data`
3. **Build Configuration Manager** - Priority loading logic
4. **Create API Endpoints** - Config CRUD operations
5. **Develop Frontend UI** - Configuration interface
6. **Add Connection Testing** - S3 and OIDC validation
7. **Update Docker Setup** - Volume mounting
8. **Testing & Documentation** - End-to-end validation

## Docker Configuration

### Dockerfile Updates
```dockerfile
# Create data directory
RUN mkdir -p /app/data

# Ensure proper permissions
RUN chown -R bun:bun /app/data
```

### Volume Mounting
```yaml
# docker-compose.yml
services:
  s3-viewer:
    volumes:
      - ./data:/app/data
```

### Container Startup
- Mount `./data` directory from host
- Configuration file persists across restarts
- Default config created on first run

## API Specification

### GET /api/v1/config
**Response:**
```json
{
  "success": true,
  "data": {
    "s3": { ... },
    "auth": { ... },
    "security": { ... },
    "source": "ui" // "ui" | "env" | "defaults"
  }
}
```
*Sensitive fields are masked (showing only last 4 chars or placeholders)*

### PUT /api/v1/config
**Request Body:** Complete configuration object
**Response:** Success/error with validation messages

### POST /api/v1/config/test
**Request Body:**
```json
{
  "type": "s3" | "oidc",
  "config": { ...relevant config... }
}
```
**Response:** Connection test results with success/error details

## Frontend Implementation

### UI Components
- Settings button in header (gear icon)
- Modal with tabbed interface
- Form fields with validation
- Test connection buttons
- Save/Cancel buttons

### User Experience
- Settings only visible to authenticated users
- Clear indication of configuration source
- Validation feedback on form fields
- Connection test results display
- Success/error notifications

## Security Considerations

### Data Protection
- Sensitive data masked in API responses
- No encryption (trusted environment)
- File permissions restricted
- Admin access only

### Input Validation
- Basic format validation
- URL format checking
- Required field validation
- Connection testing before save

### Access Control
- Only authenticated users can access config
- Local admin users have full access
- No role-based complexity needed

## Deployment Notes

### First Run
- `/app/data` directory created automatically
- Default config file populated from environment variables
- Admin can immediately configure via UI

### Configuration Changes
- Changes saved to JSON file
- Server restart required (acceptable for small deployment)
- Configuration persists across container restarts

### Troubleshooting
- Config file location: `/app/data/.s3-viewer-config.json`
- Fallback to environment variables if file corrupted
- Clear error messages for validation failures

## Benefits

1. **User-Friendly**: No need to edit environment files
2. **Persistent**: Configuration survives Docker restarts
3. **Simple**: Appropriate complexity for small deployment
4. **Safe**: Admin-only access with basic validation
5. **Flexible**: Falls back to environment variables

## Timeline Estimate

- **Phase 1** (Backend): Configuration system - 1-2 days
- **Phase 2** (Frontend): Configuration UI - 1-2 days  
- **Phase 3** (Integration & Testing): Full system - 1 day

**Total**: 3-5 days for complete implementation

---

*This plan prioritizes simplicity and appropriate complexity for the application scale while ensuring the configuration system is robust enough for production use in Docker environments.*