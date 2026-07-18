import { describe, it, expect } from 'vitest';
import { pathSeg, PathSegmentSchema, IdOrNameSchema } from '../schemas/common.js';

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

  // encodeURIComponent does NOT escape '.', so these all round-trip unchanged.
  // This is exactly the blind spot PathSegmentSchema exists to close — pathSeg
  // alone never stops '..' from reaching a URL template that supplies its own
  // literal slashes (e.g. `/zones/${pathSeg(id_or_name)}/rrsets/...`).
  it('does NOT escape "." or ".." (the traversal blind spot — schema layer must catch this)', () => {
    expect(pathSeg('')).toBe('');
    expect(pathSeg('.')).toBe('.');
    expect(pathSeg('..')).toBe('..');
  });
});

describe('PathSegmentSchema — schema-layer traversal guard', () => {
  it('rejects "", ".", "..", embedded slashes, and whitespace', () => {
    expect(PathSegmentSchema.safeParse('').success).toBe(false);
    expect(PathSegmentSchema.safeParse('.').success).toBe(false);
    expect(PathSegmentSchema.safeParse('..').success).toBe(false);
    expect(PathSegmentSchema.safeParse('a/b').success).toBe(false);
    expect(PathSegmentSchema.safeParse('../etc/passwd').success).toBe(false);
    expect(PathSegmentSchema.safeParse(' ').success).toBe(false);
    expect(PathSegmentSchema.safeParse('a b').success).toBe(false);
    expect(PathSegmentSchema.safeParse('a\tb').success).toBe(false);
  });

  it('accepts a plain segment and segments containing reserved-but-encodable characters', () => {
    expect(PathSegmentSchema.safeParse('www').success).toBe(true);
    expect(PathSegmentSchema.safeParse('example.com').success).toBe(true);
    expect(PathSegmentSchema.safeParse('a?b').success).toBe(true);
    expect(PathSegmentSchema.safeParse('a#b').success).toBe(true);
    expect(PathSegmentSchema.safeParse('a%b').success).toBe(true);
  });
});

describe('IdOrNameSchema', () => {
  it('accepts a positive integer ID and a resource name', () => {
    expect(IdOrNameSchema.safeParse(42).success).toBe(true);
    expect(IdOrNameSchema.safeParse('example.com').success).toBe(true);
  });

  it('rejects ".", "..", embedded slashes, and empty string', () => {
    expect(IdOrNameSchema.safeParse('.').success).toBe(false);
    expect(IdOrNameSchema.safeParse('..').success).toBe(false);
    expect(IdOrNameSchema.safeParse('a/b').success).toBe(false);
    expect(IdOrNameSchema.safeParse('').success).toBe(false);
  });
});
