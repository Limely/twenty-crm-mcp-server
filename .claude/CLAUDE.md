# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Twenty CRM MCP Server is a Model Context Protocol (MCP) server that connects Twenty CRM with Claude and other AI assistants. It enables natural language interactions with CRM data through dynamically generated CRUD tools.

**Key Features:**
- Dynamic schema discovery from Twenty CRM exports
- Automatic CRUD tool generation for all active objects
- Live schema reloading without server restart
- Relation field aliasing (e.g., `companyId` instead of nested objects)
- Advanced search across multiple object types
- OAuth 2.0 with PKCE for Claude.ai integration
- Streamable HTTP and SSE transport support
- Desktop extension (mcpb) for Claude Desktop

## Deployment Modes

### 1. Local stdio (Claude Desktop with mcpb)
Install the `twenty-crm-X.X.X.mcpb` extension in Claude Desktop. Users enter their Twenty CRM API key during installation.

### 2. Remote HTTP (Railway/Cloud)
Deploy to Railway or any cloud platform. Supports:
- `/stream` - Streamable HTTP endpoint (recommended)
- `/sse` - SSE endpoint (legacy)
- OAuth 2.0 for per-user authentication

## Available Tools

**People** - `create_person`, `get_person`, `update_person`, `list_people`, `delete_person`

**Companies** - `create_company`, `get_company`, `update_company`, `list_companies`, `delete_company`

**Notes** - `create_note`, `get_note`, `update_note`, `list_notes`, `delete_note`

**Tasks** - `create_task`, `get_task`, `update_task`, `list_tasks`, `delete_task`

**Opportunities** - `create_opportunity`, `get_opportunity`, `update_opportunity`, `list_opportunities`, `delete_opportunity`

**Note Targets** - `create_noteTarget`, `get_noteTarget`, `update_noteTarget`, `list_noteTargets`, `delete_noteTarget`

**Special Tools:**
- `search_records` - Search across multiple object types
- `create_note_for_person` - Create note and link to person in one step
- `get_metadata_objects` - List available CRM objects
- `get_object_metadata` - Inspect object schema
- `get_local_object_schema` - Get tool schema for an object
- `get_available_operations` - List GraphQL operations

## Development Commands

### Run locally (stdio mode)
```bash
TWENTY_API_KEY=your-key node index.js
```

### Run HTTP server (OAuth mode)
```bash
PORT=3000 SERVER_URL=https://your-domain.com node index.js
```

### Build mcpb extension
```bash
cd mcpb
npm install
zip -r ../twenty-crm-X.X.X.mcpb manifest.json package.json build/ node_modules/
```

### Testing
```bash
npm test
```

## Architecture

### Core Components

**index.js - TwentyCRMServer class**
- Main MCP server implementation using `@modelcontextprotocol/sdk`
- Supports stdio, SSE, and Streamable HTTP transports
- Creates per-connection MCP server instances in HTTP mode
- Flexible auth: OAuth tokens or direct API keys

**oauth/provider.js - TwentyCRMOAuthProvider**
- Implements OAuth 2.0 with PKCE for Claude.ai integration
- Per-user API key storage (users enter their own key during auth)
- Dynamic client registration support
- Token management with refresh support

**oauth/authorize-page.js**
- HTML authorization page for API key entry
- Validates API keys against Twenty CRM before accepting

**mcpb/ - Desktop Extension**
- Local proxy for Claude Desktop
- Connects to remote server with user's API key
- Uses Streamable HTTP transport

**schema-loader.js - SchemaLoader class**
- Loads Twenty CRM schema exports from `./schema` directory
- Generates JSON Schema tool definitions
- Creates relation field aliases

### HTTP Endpoints

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `/health` | No | Health check |
| `/.well-known/oauth-authorization-server` | No | OAuth metadata |
| `/.well-known/oauth-protected-resource` | No | Resource metadata |
| `/register` | No | Dynamic client registration |
| `/authorize` | No | OAuth authorization (shows API key form) |
| `/token` | No | Token exchange |
| `/stream` | Bearer | Streamable HTTP MCP endpoint |
| `/sse` | Bearer | SSE MCP endpoint |
| `/messages` | Bearer | SSE message endpoint |

### Authentication Flow

**OAuth (Claude.ai web):**
1. Claude.ai discovers OAuth metadata
2. Registers as client via `/register`
3. User authorizes at `/authorize`, enters API key
4. Token exchanged, stored with user's API key
5. Subsequent requests use Bearer token

**Direct API Key (mcpb/proxy):**
1. User enters API key in Claude Desktop extension
2. Proxy connects to `/stream` with API key as Bearer token
3. Server validates key against Twenty CRM

## Environment Variables

**For stdio mode:**
- `TWENTY_API_KEY`: Twenty CRM API key (required)
- `TWENTY_BASE_URL`: CRM instance URL (default: `https://api.twenty.com`)

**For HTTP/OAuth mode:**
- `PORT`: Server port (Railway sets automatically)
- `SERVER_URL`: Public URL for OAuth redirects
- `TWENTY_BASE_URL`: CRM instance URL

**Optional:**
- `SCHEMA_PATH`: Custom schema directory (default: `./schema`)
- `MCP_LOG_LEVEL`: Logging verbosity (`quiet`, `verbose`)

## Schema Export Structure

The `./schema` directory contains:
- **rest-metadata-objects.json**: Object and field metadata from Twenty CRM
- **available-operations.json**: GraphQL introspection results
- **core-objects/**: Individual JSON files for core objects

## Testing Strategy

Tests use Node's built-in test runner (`node:test`):
- **Schema generation tests**: Verify relation aliases
- **Payload sanitization tests**: Ensure field normalization
- **Integration tests**: Mock fetch for end-to-end testing

```bash
# Run all tests
npm test

# Use { oauthMode: true, quiet: true } when instantiating for tests
```

## Key Design Patterns

**Per-Connection Servers**: In HTTP mode, each SSE/Stream connection gets its own MCP Server instance to avoid "already connected" errors.

**Flexible Auth Middleware**: Accepts both OAuth tokens and direct API keys, trying OAuth first then falling back to API key validation.

**Relation Aliasing**: Transforms `{ company: { id: "abc" } }` to `companyId: "abc"` for cleaner API.

**Field Normalization**: Converts string emails/phones to proper object structures.

## Common Modifications

**Adding a new tool:**
1. Define schema in `buildGlobalTools()`
2. Add handler to `globalToolHandlers` Map
3. Implement handler method

**Updating mcpb:**
1. Modify files in `mcpb/`
2. Update version in `mcpb/manifest.json` and `mcpb/package.json`
3. Rebuild: `cd mcpb && zip -r ../twenty-crm-X.X.X.mcpb ...`

**Changing OAuth behavior:**
1. Modify `oauth/provider.js`
2. Update `oauth/authorize-page.js` for UI changes
