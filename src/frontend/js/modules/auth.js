/**
 * Auth Module
 * Handles Local and OIDC authentication with PKCE
 */
window.Auth = {
    user: null,
    token: localStorage.getItem('auth_token'),
    config: null,

    /**
     * Initialize Auth
     */
    async init() {
        try {
            const response = await fetch('/api/v1/auth/config');
            this.config = await response.json();
            
            if (this.token) {
                // In a real app, you'd verify the token with /api/v1/auth/me
                this.user = this.decodeToken(this.token);
                if (!this.user) this.logout();
            }
        } catch (error) {
            console.error('Auth initialization failed:', error);
        }
    },

    /**
     * Local Login
     */
    async loginLocal(username, password) {
        const response = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        if (response.ok) {
            const data = await response.json();
            this.setSession(data.token, data.user);
            return { success: true };
        } else {
            const error = await response.json();
            return { success: false, error: error.error };
        }
    },

    /**
     * OIDC Login
     */
    async loginOIDC() {
        if (!this.config || !this.config.oidcEnabled) return;

        const { issuer, clientId, scope, redirectUri } = this.config.oidc;
        
        // PKCE
        const codeVerifier = this.generateRandomString(64);
        const codeChallenge = await this.generateCodeChallenge(codeVerifier);
        
        // Save verifier for callback
        sessionStorage.setItem('oidc_code_verifier', codeVerifier);
        
        // State for security
        const state = this.generateRandomString(16);
        sessionStorage.setItem('oidc_state', state);

        const authUrl = new URL(`${issuer}/protocol/openid-connect/auth`);
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', scope);
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('code_challenge', codeChallenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');

        window.location.href = authUrl.toString();
    },

    /**
     * Handle OIDC Callback
     */
    async handleCallback(code, state) {
        const savedState = sessionStorage.getItem('oidc_state');
        const codeVerifier = sessionStorage.getItem('oidc_code_verifier');

        if (state !== savedState) {
            throw new Error('Invalid state');
        }

        const response = await fetch('/api/v1/auth/callback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, code_verifier: codeVerifier })
        });

        if (response.ok) {
            const data = await response.json();
            this.setSession(data.token, data.user);
            
            // Cleanup
            sessionStorage.removeItem('oidc_state');
            sessionStorage.removeItem('oidc_code_verifier');
            
            return { success: true };
        } else {
            const error = await response.json();
            throw new Error(error.error || 'OIDC callback failed');
        }
    },

    /**
     * Set Session
     */
    setSession(token, user) {
        this.token = token;
        this.user = user;
        localStorage.setItem('auth_token', token);
    },

    /**
     * Logout
     */
    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('auth_token');
        window.location.href = '/';
    },

    /**
     * Is Authenticated
     */
    isAuthenticated() {
        return !!this.token;
    },

    /**
     * Get Auth Header
     */
    getAuthHeader() {
        return this.token ? { 'Authorization': `Bearer ${this.token}` } : {};
    },

    /**
     * PKCE Helpers
     */
    generateRandomString(length) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        let result = '';
        const values = new Uint32Array(length);
        crypto.getRandomValues(values);
        for (let i = 0; i < length; i++) {
            result += charset[values[i] % charset.length];
        }
        return result;
    },

    async generateCodeChallenge(verifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode(...new Uint8Array(digest)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    },

    /**
     * Simple JWT Decoder (Mock/Lightweight)
     */
    decodeToken(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (e) {
            return null;
        }
    }
};
