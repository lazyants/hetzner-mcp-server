export const HETZNER_API_BASE = 'https://api.hetzner.cloud/v1';
// Storage Boxes live on a SEPARATE host (api.hetzner.com, NOT api.hetzner.cloud)
// but follow the same Cloud API patterns, Bearer auth, and error body shape.
export const HETZNER_STORAGE_API_BASE = 'https://api.hetzner.com/v1';
export const DEFAULT_PER_PAGE = 25;
export const MAX_PER_PAGE = 50;
export const MAX_RETRIES = 3;
export const REQUEST_TIMEOUT = 30_000;
