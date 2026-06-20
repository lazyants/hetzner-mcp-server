import { describe, it, expect } from 'vitest';
import { pathSeg } from '../schemas/common.js';

/**
 * pathSeg() was extracted from tools/zones.ts into schemas/common.ts so the
 * Storage Box tools can reuse it. These tests lock the encode behaviour so the
 * shared helper cannot silently regress for either consumer.
 */
describe('pathSeg', () => {
  it('leaves plain numeric IDs intact', () => {
    expect(pathSeg(42)).toBe('42');
    expect(pathSeg('42')).toBe('42');
  });

  it('leaves DNS-safe names intact', () => {
    expect(pathSeg('example.com')).toBe('example.com');
    expect(pathSeg('_acme-challenge')).toBe('_acme-challenge');
  });

  it('encodes reserved URI characters', () => {
    expect(pathSeg('a/b')).toBe('a%2Fb');
    expect(pathSeg('a?b')).toBe('a%3Fb');
    expect(pathSeg('a#b')).toBe('a%23b');
    expect(pathSeg('a%b')).toBe('a%25b');
  });

  it('encodes spaces', () => {
    expect(pathSeg('my zone')).toBe('my%20zone');
  });
});
