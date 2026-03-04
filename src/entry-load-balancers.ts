#!/usr/bin/env node
import { createServer, startServer } from './server.js';
import { registerLoadBalancerTools } from './tools/load-balancers.js';
import { registerCertificateTools } from './tools/certificates.js';

const server = createServer('hetzner-mcp-load-balancers');

registerLoadBalancerTools(server);
registerCertificateTools(server);

startServer(server).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
