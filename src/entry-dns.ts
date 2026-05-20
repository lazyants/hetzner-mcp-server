#!/usr/bin/env node
import { createServer, startServer } from './server.js';
import { registerDnsZoneTools } from './tools/zones.js';

const server = createServer('hetzner-mcp-dns');

registerDnsZoneTools(server);

startServer(server).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
