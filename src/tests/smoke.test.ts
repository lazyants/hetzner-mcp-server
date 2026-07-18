import { describe, it, expect } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { ALL_REGISTRARS, SPLITS, TOTAL_TOOL_COUNT } from '../splits.js';

function toolCount(server: McpServer): number {
  // _registeredTools is a plain object keyed by tool name
  return Object.keys((server as any)._registeredTools).length;
}

function freshServer(name = 'test-server'): McpServer {
  return new McpServer({ name, version: '0.0.0' });
}

describe('Tool registration smoke tests', () => {
  it('registers all 185 tools for full server', () => {
    const server = freshServer();
    for (const register of ALL_REGISTRARS) {
      register(server);
    }
    expect(toolCount(server)).toBe(TOTAL_TOOL_COUNT);
    expect(TOTAL_TOOL_COUNT).toBe(185); // pin the literal so a split-count edit is deliberate
  });

  for (const [name, split] of Object.entries(SPLITS)) {
    it(`registers ${split.toolCount} tools for ${name} split`, () => {
      const server = freshServer();
      for (const register of split.registrars) {
        register(server);
      }
      expect(toolCount(server)).toBe(split.toolCount);
    });
  }
});
