import { createSignatures, SignAlgorithm } from 'bun';
import { configManager } from '../services/config-manager';
import { logger } from '../../shared/logger';

/**
 * JWT Verification Result
 */
interface JWTVerificationResult {
  valid: boolean;
  payload?: any;
  error?: string;
}

/**
 * Authentication Middleware with proper JWT verification
 * Verifies JWT token in Authorization header with signature validation
 */
export async function authenticate(request: Request): Promise<AuthUser | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  
  try {
    // Verify JWT token with proper signature validation
    const verification = await verifyJWT(token);
    
    if (!verification.valid || !verification.payload) {
      logger.warn('JWT verification failed', { error: verification.error }, 'auth');
      return null;
    }

    const payload = verification.payload;
    const now = Math.floor(Date.now() / 1000);

    // Check expiration
    if (payload.exp && payload.exp < now) {
      logger.warn('JWT token expired', { exp: payload.exp, now }, 'auth');
      return null;
    }

    // Check not before
    if (payload.nbf && payload.nbf > now) {
      logger.warn('JWT token not yet valid', { nbf: payload.nbf, now }, 'auth');
      return null;
    }

    // Only enforce issuer/audience checks for OIDC tokens
    // Local auth tokens don't have these claims
    if (payload.provider === 'oidc') {
      const config = await configManager.getConfig();
      
      // Check issuer if configured
      if (config.auth.oidc.issuer && payload.iss !== config.auth.oidc.issuer) {
        logger.warn('JWT token issuer mismatch', { 
          expected: config.auth.oidc.issuer, 
          actual: payload.iss 
        }, 'auth');
        return null;
      }

      // Check audience if present
      if (payload.aud && typeof payload.aud === 'string') {
        if (payload.aud !== config.auth.oidc.clientId) {
          logger.warn('JWT token audience mismatch', { 
            expected: config.auth.oidc.clientId, 
            actual: payload.aud 
          }, 'auth');
          return null;
        }
      } else if (Array.isArray(payload.aud)) {
        if (!payload.aud.includes(config.auth.oidc.clientId)) {
          logger.warn('JWT token audience not in list', { 
            expected: config.auth.oidc.clientId, 
            actual: payload.aud 
          }, 'auth');
          return null;
        }
      }
    }

    return {
      id: payload.sub,
      username: payload.username || payload.preferred_username || payload.sub,
      email: payload.email,
      provider: payload.provider || 'oidc',
      roles: payload.roles || [],
      permissions: payload.permissions || []
    };
  } catch (error) {
    logger.error('JWT verification error', error, 'auth');
    return null;
  }
}

/**
 * Verify JWT token with signature validation
 */
async function verifyJWT(token: string): Promise<JWTVerificationResult> {
  try {
    // Split token into parts
    const [headerB64, payloadB64, signatureB64] = token.split('.');
    
    if (!headerB64 || !payloadB64 || !signatureB64) {
      return { valid: false, error: 'Invalid token format' };
    }

    // Decode header and payload
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

    // Validate algorithm
    if (!header.alg || !['HS256', 'RS256', 'ES256'].includes(header.alg)) {
      return { valid: false, error: 'Unsupported algorithm' };
    }

    // Get signing key
    const config = await configManager.getConfig();
    const key = await getSigningKey(header.alg, config);

    if (!key) {
      return { valid: false, error: 'No signing key available' };
    }

    // Verify signature
    const signingInput = `${headerB64}.${payloadB64}`;
    const signature = Buffer.from(signatureB64, 'base64url');
    
    let isValid = false;
    
    if (header.alg === 'HS256') {
      // HMAC verification using Web Crypto API
      const encoder = new TextEncoder();
      const keyData = encoder.encode(key);
      
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
      );
      
      isValid = await crypto.subtle.verify(
        'HMAC',
        cryptoKey,
        signature,
        encoder.encode(signingInput)
      );
    } else if (header.alg === 'RS256') {
      // RSA verification
      const publicKey = await createSignatures.PublicKey.fromPem(key);
      const verifySignature = await createSignatures.Verification().create(signature, 'rsa-sha256');
      isValid = await verifySignature.verify(publicKey, signingInput);
    } else if (header.alg === 'ES256') {
      // ECDSA verification
      const publicKey = await createSignatures.PublicKey.fromPem(key);
      const verifySignature = await createSignatures.Verification().create(signature, 'ecdsa-sha256');
      isValid = await verifySignature.verify(publicKey, signingInput);
    }

    if (!isValid) {
      return { valid: false, error: 'Invalid signature' };
    }

    return { valid: true, payload };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Unknown verification error' 
    };
  }
}

/**
 * Get signing key based on algorithm and configuration
 */
async function getSigningKey(algorithm: string, config: any): Promise<string | null> {
  try {
    if (algorithm.startsWith('HS')) {
      // HMAC - use JWT secret
      return config.security.jwtSecret;
    } else if (algorithm.startsWith('RS') || algorithm.startsWith('ES')) {
      // RSA/ECDSA - use OIDC provider's public key or certificate
      if (config.auth.oidc.jwksUri) {
        // Fetch JWKS from OIDC provider
        const jwksResponse = await fetch(config.auth.oidc.jwksUri);
        if (jwksResponse.ok) {
          const jwks = await jwksResponse.json();
          // Find the key that matches the algorithm/key ID from token header
          // This is simplified - in production you'd want proper key selection and caching
          if (jwks.keys && jwks.keys.length > 0) {
            return JSON.stringify(jwks.keys[0]);
          }
        }
      } else if (config.auth.oidc.publicKey) {
        // Use configured public key
        return config.auth.oidc.publicKey;
      }
    }
    
    return null;
  } catch (error) {
    logger.error('Error getting signing key', error, 'auth');
    return null;
  }
}

/**
 * Create JWT token (for testing/local auth)
 */
export async function createJWT(payload: any, expiresIn: number = 3600): Promise<string> {
  try {
    const config = await configManager.getConfig();
    const header = { alg: 'HS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    
    const tokenPayload = {
      ...payload,
      iat: now,
      exp: now + expiresIn
    };

    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
    const signingInput = `${headerB64}.${payloadB64}`;
    
    // Use Web Crypto API compatible approach
    const encoder = new TextEncoder();
    const keyData = encoder.encode(config.security.jwtSecret);
    
    // Import the key for HMAC
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // Sign the data
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      encoder.encode(signingInput)
    );
    
    const signatureB64 = Buffer.from(signatureBuffer).toString('base64url');
    
    return `${headerB64}.${payloadB64}.${signatureB64}`;
  } catch (error) {
    logger.error('Error creating JWT', error, 'auth');
    throw new Error('Failed to create JWT token');
  }
}

export interface AuthUser {
  id: string;
  username: string;
  email?: string;
  provider: 'local' | 'oidc';
}

/**
 * Helper to create 401 response
 */
export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
}
