import crypto from 'crypto';
import { generateAuthorizePage } from './authorize-page.js';

/**
 * OAuth 2.0 provider for Twenty CRM MCP Server.
 * Implements per-user API key authentication - each user provides their own
 * Twenty CRM API key during the OAuth authorization flow.
 *
 * @implements {import('@modelcontextprotocol/sdk/server/auth/provider.js').OAuthServerProvider}
 */
export class TwentyCRMOAuthProvider {
  constructor(options = {}) {
    this.twentyBaseUrl = options.twentyBaseUrl || process.env.TWENTY_BASE_URL || 'https://api.twenty.com';

    // In-memory stores (consider Redis for production multi-instance deployments)
    this._clients = new Map();          // clientId -> OAuthClientInformationFull
    this._codes = new Map();            // authCode -> { client, params, twentyApiKey, expiresAt }
    this._tokens = new Map();           // accessToken -> { clientId, scopes, expiresAt, twentyApiKey }
    this._refreshTokens = new Map();    // refreshToken -> { clientId, scopes, twentyApiKey }

    // Token configuration
    this.accessTokenTTL = options.accessTokenTTL || 3600;          // 1 hour
    this.authCodeTTL = options.authCodeTTL || 300;                 // 5 minutes
    this.refreshTokenTTL = options.refreshTokenTTL || 30 * 24 * 3600; // 30 days
  }

  /**
   * Client store implementing OAuthRegisteredClientsStore interface.
   */
  get clientsStore() {
    return {
      getClient: (clientId) => this._clients.get(clientId),
      registerClient: (clientMetadata) => {
        const clientId = this.generateId();
        const clientSecret = this.generateSecret();
        const now = Math.floor(Date.now() / 1000);

        const client = {
          ...clientMetadata,
          client_id: clientId,
          client_secret: clientSecret,
          client_id_issued_at: now
        };

        this._clients.set(clientId, client);
        return client;
      }
    };
  }

  /**
   * Handle authorization request - show the API key entry form.
   * @param {import('@modelcontextprotocol/sdk/shared/auth.js').OAuthClientInformationFull} client
   * @param {import('@modelcontextprotocol/sdk/server/auth/provider.js').AuthorizationParams} params
   * @param {import('express').Response} res
   */
  async authorize(client, params, res) {
    const html = generateAuthorizePage({
      clientName: client.client_name || client.client_id,
      scopes: params.scopes || [],
      state: params.state || '',
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge
    });

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  /**
   * Handle authorization form submission.
   * This is called by our custom /authorize/submit endpoint.
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   */
  async handleAuthorizeSubmit(req, res) {
    const { api_key, state, redirect_uri, code_challenge } = req.body;

    if (!api_key || !redirect_uri) {
      const html = generateAuthorizePage({
        clientName: 'Unknown',
        scopes: [],
        state: state || '',
        redirectUri: redirect_uri || '',
        codeChallenge: code_challenge || '',
        error: 'API key is required'
      });
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send(html);
    }

    // Validate the API key against Twenty CRM
    const isValid = await this.validateTwentyApiKey(api_key);
    if (!isValid) {
      const html = generateAuthorizePage({
        clientName: 'Unknown',
        scopes: [],
        state: state || '',
        redirectUri: redirect_uri,
        codeChallenge: code_challenge || '',
        error: 'Invalid API key. Please check your Twenty CRM API key and try again.'
      });
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send(html);
    }

    // Generate authorization code
    const code = this.generateId();
    const expiresAt = Date.now() + (this.authCodeTTL * 1000);

    this._codes.set(code, {
      twentyApiKey: api_key,
      codeChallenge: code_challenge,
      redirectUri: redirect_uri,
      state: state,
      scopes: ['mcp:tools'],
      expiresAt
    });

    // Redirect back to the client with the code
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set('code', code);
    if (state) {
      redirectUrl.searchParams.set('state', state);
    }

    res.redirect(redirectUrl.toString());
  }

  /**
   * Validate a Twenty CRM API key by making a test request.
   * @param {string} apiKey
   * @returns {Promise<boolean>}
   */
  async validateTwentyApiKey(apiKey) {
    try {
      const response = await fetch(`${this.twentyBaseUrl}/rest/people?limit=1`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      // 200 or 401/403 tells us the key format is checked
      // We accept 200 as valid, anything else as invalid
      return response.ok;
    } catch (error) {
      console.error('Error validating Twenty API key:', error.message);
      return false;
    }
  }

  /**
   * Return the code challenge for a given authorization code.
   * @param {import('@modelcontextprotocol/sdk/shared/auth.js').OAuthClientInformationFull} client
   * @param {string} authorizationCode
   * @returns {Promise<string>}
   */
  async challengeForAuthorizationCode(client, authorizationCode) {
    const codeData = this._codes.get(authorizationCode);
    if (!codeData) {
      throw new Error('Invalid authorization code');
    }

    if (Date.now() > codeData.expiresAt) {
      this._codes.delete(authorizationCode);
      throw new Error('Authorization code expired');
    }

    return codeData.codeChallenge;
  }

  /**
   * Exchange an authorization code for tokens.
   * @param {import('@modelcontextprotocol/sdk/shared/auth.js').OAuthClientInformationFull} client
   * @param {string} authorizationCode
   * @param {string} [codeVerifier]
   * @param {string} [redirectUri]
   * @param {URL} [resource]
   * @returns {Promise<import('@modelcontextprotocol/sdk/shared/auth.js').OAuthTokens>}
   */
  async exchangeAuthorizationCode(client, authorizationCode, codeVerifier, redirectUri, resource) {
    const codeData = this._codes.get(authorizationCode);
    if (!codeData) {
      throw new Error('Invalid authorization code');
    }

    if (Date.now() > codeData.expiresAt) {
      this._codes.delete(authorizationCode);
      throw new Error('Authorization code expired');
    }

    // Delete the code (one-time use)
    this._codes.delete(authorizationCode);

    // Generate tokens
    const accessToken = this.generateToken();
    const refreshToken = this.generateToken();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + this.accessTokenTTL;

    // Store access token with the user's Twenty API key
    this._tokens.set(accessToken, {
      clientId: client.client_id,
      scopes: codeData.scopes,
      expiresAt,
      twentyApiKey: codeData.twentyApiKey,
      resource: resource?.toString()
    });

    // Store refresh token
    this._refreshTokens.set(refreshToken, {
      clientId: client.client_id,
      scopes: codeData.scopes,
      twentyApiKey: codeData.twentyApiKey,
      createdAt: now
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.accessTokenTTL,
      refresh_token: refreshToken,
      scope: codeData.scopes.join(' ')
    };
  }

  /**
   * Exchange a refresh token for new tokens.
   * @param {import('@modelcontextprotocol/sdk/shared/auth.js').OAuthClientInformationFull} client
   * @param {string} refreshToken
   * @param {string[]} [scopes]
   * @param {URL} [resource]
   * @returns {Promise<import('@modelcontextprotocol/sdk/shared/auth.js').OAuthTokens>}
   */
  async exchangeRefreshToken(client, refreshToken, scopes, resource) {
    const refreshData = this._refreshTokens.get(refreshToken);
    if (!refreshData) {
      throw new Error('Invalid refresh token');
    }

    if (refreshData.clientId !== client.client_id) {
      throw new Error('Refresh token does not belong to this client');
    }

    // Check refresh token expiry
    const now = Math.floor(Date.now() / 1000);
    if (now - refreshData.createdAt > this.refreshTokenTTL) {
      this._refreshTokens.delete(refreshToken);
      throw new Error('Refresh token expired');
    }

    // Generate new access token
    const accessToken = this.generateToken();
    const expiresAt = now + this.accessTokenTTL;

    // Use requested scopes if provided and valid, otherwise use original scopes
    const effectiveScopes = scopes && scopes.length > 0
      ? scopes.filter(s => refreshData.scopes.includes(s))
      : refreshData.scopes;

    this._tokens.set(accessToken, {
      clientId: client.client_id,
      scopes: effectiveScopes,
      expiresAt,
      twentyApiKey: refreshData.twentyApiKey,
      resource: resource?.toString()
    });

    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.accessTokenTTL,
      scope: effectiveScopes.join(' ')
    };
  }

  /**
   * Verify an access token and return auth info.
   * @param {string} token
   * @returns {Promise<import('@modelcontextprotocol/sdk/server/auth/types.js').AuthInfo>}
   */
  async verifyAccessToken(token) {
    const tokenData = this._tokens.get(token);
    if (!tokenData) {
      throw new Error('Invalid access token');
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > tokenData.expiresAt) {
      this._tokens.delete(token);
      throw new Error('Access token expired');
    }

    return {
      token,
      clientId: tokenData.clientId,
      scopes: tokenData.scopes,
      expiresAt: tokenData.expiresAt,
      resource: tokenData.resource ? new URL(tokenData.resource) : undefined,
      extra: {
        twentyApiKey: tokenData.twentyApiKey
      }
    };
  }

  /**
   * Revoke a token.
   * @param {import('@modelcontextprotocol/sdk/shared/auth.js').OAuthClientInformationFull} client
   * @param {import('@modelcontextprotocol/sdk/shared/auth.js').OAuthTokenRevocationRequest} request
   */
  async revokeToken(client, request) {
    const { token, token_type_hint } = request;

    // Try to revoke as access token
    if (!token_type_hint || token_type_hint === 'access_token') {
      const tokenData = this._tokens.get(token);
      if (tokenData && tokenData.clientId === client.client_id) {
        this._tokens.delete(token);
        return;
      }
    }

    // Try to revoke as refresh token
    if (!token_type_hint || token_type_hint === 'refresh_token') {
      const refreshData = this._refreshTokens.get(token);
      if (refreshData && refreshData.clientId === client.client_id) {
        this._refreshTokens.delete(token);
        return;
      }
    }

    // Per RFC 7009, we should not return an error if the token is invalid
  }

  /**
   * Get the Twenty CRM API key for a given access token.
   * @param {string} token
   * @returns {string|null}
   */
  getApiKeyForToken(token) {
    const tokenData = this._tokens.get(token);
    return tokenData?.twentyApiKey || null;
  }

  /**
   * Generate a random ID.
   * @returns {string}
   */
  generateId() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Generate a random secret.
   * @returns {string}
   */
  generateSecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate a random token.
   * @returns {string}
   */
  generateToken() {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Clean up expired tokens (call periodically).
   */
  cleanup() {
    const now = Date.now();
    const nowSeconds = Math.floor(now / 1000);

    // Clean expired authorization codes
    for (const [code, data] of this._codes) {
      if (now > data.expiresAt) {
        this._codes.delete(code);
      }
    }

    // Clean expired access tokens
    for (const [token, data] of this._tokens) {
      if (nowSeconds > data.expiresAt) {
        this._tokens.delete(token);
      }
    }

    // Clean expired refresh tokens
    for (const [token, data] of this._refreshTokens) {
      if (nowSeconds - data.createdAt > this.refreshTokenTTL) {
        this._refreshTokens.delete(token);
      }
    }
  }
}
