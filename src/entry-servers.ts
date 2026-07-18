#!/usr/bin/env node
import { createServer, startServer } from './server.js';
import { SPLITS } from './splits.js';
import { registerReferenceResource } from './resources/hetzner-reference.js';

const split = SPLITS.servers;
const server = createServer(split.bin);

for (const register of split.registrars) {
  register(server);
}
registerReferenceResource(server);

startServer(server).catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
