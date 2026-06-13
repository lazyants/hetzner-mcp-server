#!/usr/bin/env node
import { createServer, startServer } from './server.js';
import { registerDnsZoneTools } from './tools/zones.js';
import { registerReferenceResource } from './resources/hetzner-reference.js';

const server = createServer('hetzner-mcp-dns');

registerDnsZoneTools(server);
registerReferenceResource(server);

startServer(server).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
