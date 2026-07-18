#!/usr/bin/env node
import { createServer, startServer } from './server.js';
import { ALL_REGISTRARS } from './splits.js';
import { registerReferenceResource } from './resources/hetzner-reference.js';

const server = createServer('hetzner-mcp-server');

for (const register of ALL_REGISTRARS) {
  register(server);
}

// API-reference Resource
registerReferenceResource(server);

startServer(server).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
