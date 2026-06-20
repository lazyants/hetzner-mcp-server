import { describe, it, expect } from 'vitest';
import { HETZNER_API_BASE, HETZNER_STORAGE_API_BASE, MAX_RETRIES, DEFAULT_PER_PAGE, MAX_PER_PAGE } from '../constants.js';

describe('constants', () => {
  it('HETZNER_API_BASE points to Hetzner v1 API', () => {
    expect(HETZNER_API_BASE).toBe('https://api.hetzner.cloud/v1');
  });

  it('HETZNER_STORAGE_API_BASE points to the Storage Box host (api.hetzner.com)', () => {
    expect(HETZNER_STORAGE_API_BASE).toBe('https://api.hetzner.com/v1');
  });

  it('MAX_RETRIES is 3', () => {
    expect(MAX_RETRIES).toBe(3);
  });

  it('DEFAULT_PER_PAGE is 25', () => {
    expect(DEFAULT_PER_PAGE).toBe(25);
  });

  it('MAX_PER_PAGE is 50', () => {
    expect(MAX_PER_PAGE).toBe(50);
  });
});
