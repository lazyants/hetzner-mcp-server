#!/usr/bin/env node
import { createServer, startServer } from './server.js';
import { registerNetworkTools } from './tools/networks.js';
import { registerFirewallTools } from './tools/firewalls.js';

const server = createServer('hetzner-mcp-networking');

registerNetworkTools(server);
registerFirewallTools(server);

startServer(server).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
