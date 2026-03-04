#!/usr/bin/env node
import { createServer, startServer } from './server.js';
import { registerFloatingIpTools } from './tools/floating-ips.js';
import { registerPrimaryIpTools } from './tools/primary-ips.js';

const server = createServer('hetzner-mcp-ips');

registerFloatingIpTools(server);
registerPrimaryIpTools(server);

startServer(server).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
