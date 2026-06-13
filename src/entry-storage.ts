#!/usr/bin/env node
import { createServer, startServer } from './server.js';
import { registerVolumeTools } from './tools/volumes.js';
import { registerImageTools } from './tools/images.js';
import { registerReferenceResource } from './resources/hetzner-reference.js';

const server = createServer('hetzner-mcp-storage');

registerVolumeTools(server);
registerImageTools(server);
registerReferenceResource(server);

startServer(server).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
