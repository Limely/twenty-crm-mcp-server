/**
 * HTML page generation for OAuth authorization flow.
 * Users enter their Twenty CRM API key to authorize access.
 */

/**
 * Generates the authorization page HTML where users enter their API key.
 * @param {Object} options
 * @param {string} options.clientName - Name of the OAuth client requesting access
 * @param {string[]} options.scopes - Requested scopes
 * @param {string} options.state - OAuth state parameter
 * @param {string} options.redirectUri - Where to redirect after authorization
 * @param {string} options.codeChallenge - PKCE code challenge
 * @param {string} [options.error] - Optional error message to display
 * @returns {string} HTML page content
 */
export function generateAuthorizePage({
  clientName,
  scopes,
  state,
  redirectUri,
  codeChallenge,
  error
}) {
  const scopeList = scopes && scopes.length > 0
    ? scopes.map(s => `<li>${escapeHtml(s)}</li>`).join('')
    : '<li>mcp:tools (default)</li>';

  const errorHtml = error
    ? `<div class="error">${escapeHtml(error)}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize - Twenty CRM MCP Server</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
      padding: 40px;
      max-width: 440px;
      width: 100%;
    }
    .logo {
      text-align: center;
      margin-bottom: 24px;
    }
    .logo h1 {
      color: #1a1a2e;
      font-size: 24px;
      font-weight: 600;
    }
    .logo span {
      color: #667eea;
    }
    .client-info {
      background: #f8f9fa;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .client-info h2 {
      font-size: 14px;
      color: #666;
      font-weight: 500;
      margin-bottom: 8px;
    }
    .client-info .name {
      font-size: 18px;
      color: #1a1a2e;
      font-weight: 600;
    }
    .scopes {
      margin-bottom: 24px;
    }
    .scopes h3 {
      font-size: 14px;
      color: #666;
      font-weight: 500;
      margin-bottom: 12px;
    }
    .scopes ul {
      list-style: none;
    }
    .scopes li {
      background: #e8f4fd;
      color: #1a73e8;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 14px;
      margin-bottom: 6px;
      display: inline-block;
      margin-right: 6px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    .form-group label {
      display: block;
      font-size: 14px;
      color: #333;
      font-weight: 500;
      margin-bottom: 8px;
    }
    .form-group input {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e1e4e8;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.2s;
    }
    .form-group input:focus {
      outline: none;
      border-color: #667eea;
    }
    .form-group .hint {
      font-size: 12px;
      color: #666;
      margin-top: 6px;
    }
    .error {
      background: #fee2e2;
      color: #dc2626;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 20px;
    }
    .buttons {
      display: flex;
      gap: 12px;
    }
    .btn {
      flex: 1;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }
    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    .btn-secondary {
      background: #f1f3f4;
      color: #5f6368;
    }
    .btn-secondary:hover {
      background: #e8eaed;
    }
    .info {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #e1e4e8;
      font-size: 12px;
      color: #666;
      text-align: center;
    }
    .info a {
      color: #667eea;
      text-decoration: none;
    }
    .info a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <h1>Twenty <span>CRM</span> MCP Server</h1>
    </div>

    <div class="client-info">
      <h2>Application requesting access</h2>
      <div class="name">${escapeHtml(clientName || 'Unknown Application')}</div>
    </div>

    <div class="scopes">
      <h3>Requested permissions</h3>
      <ul>${scopeList}</ul>
    </div>

    ${errorHtml}

    <form method="POST" action="/authorize/submit">
      <input type="hidden" name="state" value="${escapeHtml(state || '')}">
      <input type="hidden" name="redirect_uri" value="${escapeHtml(redirectUri || '')}">
      <input type="hidden" name="code_challenge" value="${escapeHtml(codeChallenge || '')}">

      <div class="form-group">
        <label for="api_key">Your Twenty CRM API Key</label>
        <input
          type="password"
          id="api_key"
          name="api_key"
          placeholder="Enter your Twenty CRM API key"
          required
          autocomplete="off"
        >
        <div class="hint">
          Find your API key in Twenty CRM: Settings &rarr; API &amp; Webhooks
        </div>
      </div>

      <div class="buttons">
        <button type="button" class="btn btn-secondary" onclick="handleDeny()">Deny</button>
        <button type="submit" class="btn btn-primary">Authorize</button>
      </div>
    </form>

    <div class="info">
      Your API key is stored securely and used only to access your Twenty CRM data.
      <br>
      <a href="https://github.com/Limely/twenty-crm-mcp-server" target="_blank">Learn more</a>
    </div>
  </div>

  <script>
    function handleDeny() {
      const redirectUri = document.querySelector('input[name="redirect_uri"]').value;
      const state = document.querySelector('input[name="state"]').value;
      if (redirectUri) {
        const url = new URL(redirectUri);
        url.searchParams.set('error', 'access_denied');
        url.searchParams.set('error_description', 'User denied the authorization request');
        if (state) {
          url.searchParams.set('state', state);
        }
        window.location.href = url.toString();
      }
    }
  </script>
</body>
</html>`;
}

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
