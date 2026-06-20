import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerStorageBoxCoreTools } from './storage-boxes-core.js';
import { registerStorageBoxSnapshotTools } from './storage-boxes-snapshots.js';
import { registerStorageBoxSubaccountTools } from './storage-boxes-subaccounts.js';

// Aggregate registrar for the Storage Boxes domain (api.hetzner.com host).
// Core also covers Storage Box types; snapshots and subaccounts are split out.
export function registerStorageBoxTools(server: McpServer): void {
  registerStorageBoxCoreTools(server);
  registerStorageBoxSnapshotTools(server);
  registerStorageBoxSubaccountTools(server);
}
