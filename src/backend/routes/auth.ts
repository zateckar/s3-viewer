import { config } from '../utils/config';

/**
 * Handle Auth Requests
 */
export async function handleAuthRequest(request: Request, path: string[]): Promise<Response> {
  const method = request.method;

  // GET /api/v1/auth/config
  if (path[0] === 'config' && method === 'GET') {
    return new Response(JSON.stringify({
      localEnabled: config.auth.local.enabled,
      oidcEnabled: config.auth.oidc.enabled,
      oidc: config.auth.oidc.enabled ? {
        issuer: config.auth.oidc.issuer,
        clientId: config.auth.oidc.clientId,
        scope: config.auth.oidc.scope,
        redirectUri: config.auth.oidc.redirectUri
      } : null
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // POST /api/v1/auth/login (Local)
  if (path[0] === 'login' && method === 'POST') {
    if (!config.auth.local.enabled) {
      return new Response(JSON.stringify({ error: 'Local auth disabled' }), { status: 400 });
    }

    const { username, password } = await request.json();

    if (username === config.auth.local.user && password === config.auth.local.pass) {
      const token = generateJWT({ sub: 'local-admin', username: 'admin', provider: 'local' });
      return new Response(JSON.stringify({ token, user: { username: 'admin', provider: 'local' } }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
  }

  // POST /api/v1/auth/callback (OIDC)
  if (path[0] === 'callback' && method === 'POST') {
    const { code, code_verifier } = await request.json();
    
    // In a real app, you'd exchange the code for an access token with the OIDC provider
    // For this generic implementation, we'll simulate the exchange if OIDC is enabled
    if (!config.auth.oidc.enabled) {
        return new Response(JSON.stringify({ error: 'OIDC disabled' }), { status: 400 });
    }

    try {
        // Mocking OIDC exchange for demonstration
        // In production, use a library like 'openid-client' or fetch() to the token endpoint
        console.log(`Simulating OIDC exchange for code: ${code}`);
        
        const token = generateJWT({ 
            sub: 'oidc-user-123', 
            username: 'oidc-user', 
            email: 'user@example.com', 
            provider: 'oidc' 
        });

        return new Response(JSON.stringify({ 
            token, 
            user: { username: 'oidc-user', provider: 'oidc', email: 'user@example.com' } 
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'OIDC exchange failed' }), { status: 500 });
    }
  }

  return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
}

/**
 * Simple JWT Generator (Mock)
 */
function generateJWT(payload: any): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=/g, '');
  const extendedPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24h
  };
  const payloadEncoded = btoa(JSON.stringify(extendedPayload)).replace(/=/g, '');
  const signature = btoa('signature-placeholder').replace(/=/g, ''); // Mock signature
  
  return `${header}.${payloadEncoded}.${signature}`;
}
