#!/usr/bin/env node
import { createServer, startServer } from './server.js';
import { registerVolumeTools } from './tools/volumes.js';
import { registerImageTools } from './tools/images.js';

const server = createServer('hetzner-mcp-storage');

registerVolumeTools(server);
registerImageTools(server);

startServer(server).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
