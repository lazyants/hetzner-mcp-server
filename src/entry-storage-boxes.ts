#!/usr/bin/env node
import { createServer, startServer } from './server.js';
import { registerStorageBoxTools } from './tools/storage-boxes.js';
import { registerReferenceResource } from './resources/hetzner-reference.js';

const server = createServer('hetzner-mcp-storage-boxes');

registerStorageBoxTools(server);
registerReferenceResource(server);

startServer(server).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
