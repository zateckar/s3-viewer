export const config = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  s3: {
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
    bucketName: process.env.S3_BUCKET_NAME?.split(',')[0].trim() || 's3-viewer-demo',
    bucketNames: process.env.S3_BUCKET_NAME?.split(',').map(b => b.trim()).filter(Boolean) || ['s3-viewer-demo'],
    region: process.env.S3_REGION || 'us-east-1',
  },
  
  security: {
    jwtSecret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? (() => { throw new Error('JWT_SECRET must be set in production'); })() : 'default-jwt-secret-change-in-production'),
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  },

  auth: {
    local: {
      enabled: process.env.AUTH_LOCAL_ENABLED === 'true',
      user: process.env.AUTH_USER || 'admin',
      pass: process.env.AUTH_PASS || 'admin123',
    },
    oidc: {
      enabled: process.env.AUTH_OIDC_ENABLED === 'true',
      issuer: process.env.AUTH_OIDC_ISSUER,
      clientId: process.env.AUTH_OIDC_CLIENT_ID,
      clientSecret: process.env.AUTH_OIDC_CLIENT_SECRET,
      redirectUri: process.env.AUTH_OIDC_REDIRECT_URI,
      scope: process.env.AUTH_OIDC_SCOPE || 'openid profile email',
    }
  }
};
