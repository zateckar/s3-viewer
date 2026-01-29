# S3 File Browser

A web interface for managing files across multiple S3 buckets.

## Key Features

- **Multi-Bucket Support**: Seamlessly switch between different configured S3 buckets.
- **Local Storage Support**: Use local storage alongside remote S3
- **File Management**: Upload, download, delete files, and create folders with ease.
- **Image Preview**: Built-in high-performance image viewer with zoom, rotation, and gallery navigation.
- **Transfer Tracking**: Real-time dashboard for monitoring upload and download progress, speed, and network quality.
- **Secure Access**: Protected by Local credentials or OIDC (OpenID Connect) authentication with PKCE support.

The application is designed to be deployed as a Docker container. Check .env.example for configuration options.

## User Stories

### 1. Authentication & Access Control
- **As a user, I want to log in securely** - Local auth, OIDC integration
- **As a user, I want my session to persist** - Session management
- **As an admin, I want to configure authentication** - Settings management

### 2. File Management
- **As a user, I want to upload files** - Single/multiple uploads
- **As a user, I want to download files** - Individual and batch downloads
- **As a user, I want to delete files** - File deletion with confirmation

### 3. File Viewing & Interaction
- **As a user, I want to preview images** - Image viewer with controls
- **As a user, I want to navigate between images** - Multi-image gallery
- **As a user, I want to manipulate images** - Zoom, rotation, download

### 4. S3 Bucket Management
- **As a user, I want to switch between buckets** - Bucket selector
- **As an admin, I want to configure S3 settings** - Settings panel
- **As a user, I want to see bucket status** - Accessibility indicators

### 5. Progress & Monitoring
- **As a user, I want to see upload/download progress** - Progress dashboard
- **As a user, I want to manage active transfers** - Cancel, retry operations
- **As a user, I want to see transfer history** - Historical data

### 6. Responsive Experience
- **As a mobile user, I want a mobile-optimized interface** - Responsive design
- **As a keyboard user, I want full keyboard control** - Keyboard navigation

