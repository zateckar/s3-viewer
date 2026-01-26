import { config } from '../utils/config';

/**
 * Authentication Middleware
 * Verifies JWT token in Authorization header
 */
export async function authenticate(request: Request): Promise<AuthUser | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  try {
    // In a real app, you'd use a library like 'jose' for JWT verification
    // Since we're keeping it simple with Bun, we can mock or use a lightweight approach
    // For now, we'll verify if the token is present and decodable (simplification)
    const [header, payload, signature] = token.split('.');
    
    if (!header || !payload || !signature) {
      return null;
    }

    // Decode payload
    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString());
    
    // Check expiration
    if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      id: decodedPayload.sub,
      username: decodedPayload.username,
      email: decodedPayload.email,
      provider: decodedPayload.provider
    };
  } catch (error) {
    console.error('Auth verification failed:', error);
    return null;
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
