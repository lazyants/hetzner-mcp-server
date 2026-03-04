import { describe, it, expect, vi } from 'vitest';
import { toolError, formatResponse, handleToolRequest } from '../helpers.js';

describe('toolError', () => {
  it('extracts message from Error instances', () => {
    const result = toolError(new Error('fail'));
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Error: fail' }],
      isError: true,
    });
  });

  it('converts string values via String()', () => {
    const result = toolError('string val');
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Error: string val' }],
      isError: true,
    });
  });

  it('converts non-string non-Error values via String()', () => {
    const result = toolError(42);
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Error: 42' }],
      isError: true,
    });
  });
});

describe('formatResponse', () => {
  it('serializes objects as pretty JSON with structuredContent', () => {
    const result = formatResponse({ id: 1 });
    expect(result).toEqual({
      content: [{ type: 'text', text: '{\n  "id": 1\n}' }],
      structuredContent: { id: 1 },
    });
    expect(result).not.toHaveProperty('isError');
  });

  it('serializes null without structuredContent', () => {
    const result = formatResponse(null);
    expect(result).toEqual({
      content: [{ type: 'text', text: 'null' }],
    });
    expect(result).not.toHaveProperty('structuredContent');
  });

  it('serializes empty string without structuredContent', () => {
    const result = formatResponse('');
    expect(result).toEqual({
      content: [{ type: 'text', text: '""' }],
    });
    expect(result).not.toHaveProperty('structuredContent');
  });
});

describe('handleToolRequest', () => {
  it('wraps successful result with formatResponse', async () => {
    const handler = handleToolRequest(async () => ({ server: { id: 1 } }));
    const result = await handler({});
    expect(result).toEqual({
      content: [{ type: 'text', text: '{\n  "server": {\n    "id": 1\n  }\n}' }],
      structuredContent: { server: { id: 1 } },
    });
  });

  it('catches errors and returns toolError', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = handleToolRequest(async () => { throw new Error('boom'); });
    const result = await handler({});
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Error: boom' }],
      isError: true,
    });
    expect(consoleSpy).toHaveBeenCalledWith('[hetzner-mcp] Tool error: boom');
    consoleSpy.mockRestore();
  });

  it('passes params through to the inner function', async () => {
    const fn = vi.fn().mockResolvedValue({ ok: true });
    const handler = handleToolRequest(fn);
    await handler({ id: 42, name: 'test' });
    expect(fn).toHaveBeenCalledWith({ id: 42, name: 'test' });
  });
});
