import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

// Regression catcher for the qs DoS audit gate (GHSA-q8mj-m7cp-5q26) and the
// hono GHSAs. Asserts BOTH layers so a stale lockfile can't mask a deleted
// override block: (a) the override declarations in package.json, and (b) every
// resolved qs/hono entry in the committed package-lock.json.
const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as {
  overrides?: Record<string, string>;
};
const lock = require('../../package-lock.json') as {
  packages?: Record<string, { version?: string }>;
};

// Minimal major.minor.patch comparison against a plain-release `min`. Build
// metadata is ignored (no precedence effect); a prerelease of the exact target
// (e.g. 6.15.2-alpha) ranks BELOW its release and must NOT satisfy `>= min`,
// otherwise a vulnerable prerelease snapshot could slip past this gate. Avoids
// pulling semver into the test.
function gte(version: string, min: string): boolean {
  const core = (v: string): number[] =>
    v.split('-')[0].split('+')[0].split('.').map((n) => parseInt(n, 10) || 0);
  const a = core(version);
  const b = core(min);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return true;
    if ((a[i] ?? 0) < (b[i] ?? 0)) return false;
  }
  // Numeric cores equal: a prerelease tag makes `version` lower than a
  // plain-release `min`. Strip build metadata first (no precedence effect) so a
  // hyphen inside it (e.g. 6.15.2+build-1) is not misread as a prerelease.
  return !version.split('+')[0].includes('-');
}

// Package name is the path segment after the final `node_modules/` in a
// lockfile v3 key (handles nested installs and the root "" entry).
function resolvedVersions(name: string): string[] {
  const versions: string[] = [];
  for (const [key, meta] of Object.entries(lock.packages ?? {})) {
    if (!key) continue;
    const idx = key.lastIndexOf('node_modules/');
    const pkgName = idx === -1 ? key : key.slice(idx + 'node_modules/'.length);
    if (pkgName === name && meta?.version) versions.push(meta.version);
  }
  return versions;
}

describe('qs/hono security overrides', () => {
  it('declares the qs override pinned to ^6.15.2 in package.json', () => {
    expect(pkg.overrides?.qs).toBe('^6.15.2');
  });

  it('declares the hono override pinned to ^4.12.25 in package.json', () => {
    expect(pkg.overrides?.hono).toBe('^4.12.25');
  });

  it('declares the form-data override pinned to ^4.0.6 in package.json', () => {
    expect(pkg.overrides?.['form-data']).toBe('^4.0.6');
  });

  it('resolves every qs in package-lock.json to >= 6.15.2', () => {
    const versions = resolvedVersions('qs');
    expect(versions.length).toBeGreaterThan(0);
    for (const v of versions) {
      expect(gte(v, '6.15.2'), `qs ${v} is below 6.15.2`).toBe(true);
    }
  });

  it('resolves every hono in package-lock.json to >= 4.12.25', () => {
    const versions = resolvedVersions('hono');
    expect(versions.length).toBeGreaterThan(0);
    for (const v of versions) {
      expect(gte(v, '4.12.25'), `hono ${v} is below 4.12.25`).toBe(true);
    }
  });

  it('resolves every form-data in package-lock.json to >= 4.0.6', () => {
    const versions = resolvedVersions('form-data');
    expect(versions.length).toBeGreaterThan(0);
    for (const v of versions) {
      expect(gte(v, '4.0.6'), `form-data ${v} is below 4.0.6`).toBe(true);
    }
  });
});

// Direct exercise of the comparator so the prerelease/build-metadata handling
// is locked in independently of whatever versions happen to be in the lockfile
// (which are plain releases). Without this, reverting the prerelease rule would
// not fail any lockfile-driven assertion.
describe('gte() version comparator', () => {
  it.each([
    ['6.15.2', '6.15.2', true], // exact match
    ['6.15.10', '6.15.2', true], // multi-digit segment, not lexical
    ['6.15.1', '6.15.2', false], // below
    ['7.0.0', '6.15.2', true], // higher major
    ['6.15.2-alpha', '6.15.2', false], // prerelease ranks below its release
    ['6.16.0-beta', '6.15.2', true], // prerelease of a higher core still wins
    ['6.15.2+build', '6.15.2', true], // build metadata has no precedence
    ['6.15.2+build-1', '6.15.2', true], // hyphen in build metadata is not a prerelease
    ['4.12.24', '4.12.25', false], // the exact hono pre-fix vulnerable version
    ['4.13.0', '4.12.25', true],
  ])('gte(%s, %s) === %s', (version, min, expected) => {
    expect(gte(version, min)).toBe(expected);
  });
});
