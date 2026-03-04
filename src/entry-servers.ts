#!/usr/bin/env node
import { createServer, startServer } from './server.js';
import { registerServerTools } from './tools/servers.js';
import { registerDatacenterTools } from './tools/datacenters.js';

const server = createServer('hetzner-mcp-servers');

registerServerTools(server);
registerDatacenterTools(server);

startServer(server).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
