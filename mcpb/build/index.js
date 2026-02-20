#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const log = {
  info: (msg) => console.error(`[INFO] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
};

class TwentyCRMProxy {
  constructor(serverUrl, apiKey) {
    this.serverUrl = serverUrl;
    this.apiKey = apiKey;
    this.remoteClient = null;
  }

  async createRemoteClient() {
    log.info(`Connecting to remote server: ${this.serverUrl}`);

    const transport = new StreamableHTTPClientTransport(new URL(this.serverUrl), {
      requestInit: {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      },
    });

    const client = new Client(
      { name: 'Twenty CRM Proxy', version: '1.0.0' },
      { capabilities: {} }
    );

    await client.connect(transport);
    log.info('Connected to remote server');

    return client;
  }

  async getRemoteClient() {
    if (!this.remoteClient) {
      this.remoteClient = await this.createRemoteClient();
    }
    return this.remoteClient;
  }

  async discoverRemoteTools() {
    log.info('Discovering tools from remote server...');
    const client = await this.getRemoteClient();
    const response = await client.listTools();
    const tools = response.tools || [];
    log.info(`Found ${tools.length} tools`);
    return tools;
  }

  async callRemoteTool(toolName, args) {
    const client = await this.getRemoteClient();
    return client.callTool({ name: toolName, arguments: args });
  }

  async initializeServer() {
    log.info(`Initializing Twenty CRM MCP Proxy for ${this.serverUrl}`);

    const remoteTools = await this.discoverRemoteTools();

    const server = new Server(
      { name: 'Twenty CRM MCP Proxy', version: '1.0.0' },
      { capabilities: { tools: {} } }
    );

    // List tools handler
    server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: remoteTools,
    }));

    // Call tool handler
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        return await this.callRemoteTool(name, args || {});
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error(`Tool call failed: ${errorMessage}`);
        return {
          content: [{ type: 'text', text: `Error: ${errorMessage}` }],
          isError: true,
        };
      }
    });

    const transport = new StdioServerTransport();
    await server.connect(transport);

    log.info(`Proxy server started - ${remoteTools.length} tools available`);
  }
}

async function main() {
  const serverUrl = process.env.REMOTE_MCP_URL;
  const apiKey = process.env.TWENTY_API_KEY;

  if (!serverUrl) {
    log.error('Missing REMOTE_MCP_URL environment variable');
    process.exit(1);
  }

  if (!apiKey) {
    log.error('Missing TWENTY_API_KEY environment variable');
    process.exit(1);
  }

  const proxy = new TwentyCRMProxy(serverUrl, apiKey);
  await proxy.initializeServer();
}

main().catch((error) => {
  log.error(`Fatal error: ${error}`);
  process.exit(1);
});
