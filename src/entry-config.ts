#!/usr/bin/env node
import { createServer, startServer } from './server.js';
import { registerSshKeyTools } from './tools/ssh-keys.js';
import { registerIsoTools } from './tools/isos.js';
import { registerPlacementGroupTools } from './tools/placement-groups.js';

const server = createServer('hetzner-mcp-config');

registerSshKeyTools(server);
registerIsoTools(server);
registerPlacementGroupTools(server);

startServer(server).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
