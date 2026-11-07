import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

// Regression catcher for the npm-audit gate. Asserts BOTH layers so a stale
// lockfile can't mask a deleted override block: (a) the override declaration in
// package.json, and (b) every resolved entry in the committed package-lock.json.
//
// EVERY entry in the `overrides` block belongs in PINS below. This file
// previously hand-rolled assertions for qs, hono and form-data only, leaving
// fast-uri and brace-expansion declared but unguarded — a pin nothing checks is
// indistinguishable from no pin once it rots.
//
// NOTE: a pin that was correct when written can rot in place, because advisory
// ranges are EXTENDED by later GHSAs. `fast-uri ^3.1.2`, `hono ^4.12.25` and
// `brace-expansion ^5.0.6` had all drifted inside live ranges by 2026-08-20
// while this suite stayed green — the assertion can only check the floor it is
// given. Re-read the advisory before trusting a number here; a green run is not
// evidence the floor is still correct.
const require = createRequire(import.meta.url);
const pkg = require('../../package.json') as {
  overrides?: Record<string, string>;
  dependencies?: Record<string, string>;
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

interface Pin {
  /** Package name, as it appears in `overrides` and in lockfile paths. */
  name: string;
  /** Lowest safe version: the manifest declares `^<floor>`, every resolved entry must be >= it. */
  floor: string;
  /** Advisory the pin answers, and the date the floor was last checked against it. */
  advisory: string;
}

const PINS: Pin[] = [
  { name: 'qs', floor: '6.16.1', advisory: 'GHSA-6pq8-jhm2-2vcw stringify comma-format DoS, after GHSA-q8mj-m7cp-5q26 and its extensions (checked 2026-11-07)' },
  { name: 'hono', floor: '4.13.11', advisory: 'GHSA-5r4p-p66f-jhc7 static-path middleware bypass and GHSA-hxh3-vqpv-xpqv XSS et al. (checked 2026-10-02)' },
  // Stay on 3.x — ajv declares `fast-uri: ^3.0.1`, so the 4.x branch is out of reach.
  { name: 'fast-uri', floor: '3.1.9', advisory: 'GHSA-w74x-v6f9-j3xg scheme spoofing, GHSA-wjr9-j795-jxcr host confusion et al. (checked 2026-11-07)' },
  // Dev-only (eslint -> minimatch), so it never reaches the `--omit=dev` gate,
  // but it rots the same way and is guarded here so the rot is visible.
  { name: 'brace-expansion', floor: '5.0.12', advisory: 'GHSA-q2hr-2g5m-vwhr quadratic expansion and related recursion DoS (checked 2026-10-23)' },
  // Previously unpinned. An `overrides` entry is the only thing that pulls a
  // sticky lockfile forward on install, which is how an unpinned transitive dep
  // drifts INTO a range while pinned ones re-resolve themselves.
  { name: 'ip-address', floor: '10.7.4', advisory: 'GHSA-rxp7-6hxx-x8q5 IPv6 zone identifier DoS (checked 2026-10-23)' },
  { name: 'body-parser', floor: '2.4.0', advisory: 'GHSA-27r3-jxmh-p828 DoS via trailing bytes (checked 2026-11-07)' },
  { name: 'form-data', floor: '4.0.6', advisory: 'GHSA-hmw2-7cc7-3qxx CRLF injection (checked 2026-08-20)' },
  { name: 'proxy-addr', floor: '2.0.8', advisory: 'GHSA-jqcg-44mw-7w3h IPv4-mapped IPv6 trust-subnet spoofing (checked 2026-10-23)' },
  { name: 'follow-redirects', floor: '1.16.2', advisory: 'GHSA-mrwp-f3q8-3g9p cross-realm sensitiveHeaders discarded (checked 2026-11-07)' },
  // Reached through @modelcontextprotocol/sdk, whose range still admits vulnerable 2.1.x releases.
  { name: '@hono/node-server', floor: '2.1.3', advisory: 'GHSA-rmxm-3fg6-px4f serveStatic double path decoding (checked 2026-11-07)' },
];

describe('security overrides (npm-audit gate regression guard)', () => {
  it('guards every entry in the overrides block', () => {
    const declared = Object.keys(pkg.overrides ?? {}).sort();
    const guarded = PINS.map((p) => p.name).sort();
    expect(guarded, 'every `overrides` entry must have a PINS row, and vice versa').toEqual(declared);
  });

  // A plain loop rather than `describe.each`, which quotes and truncates
  // interpolated titles.
  for (const { name, floor, advisory } of PINS) {
    describe(`${name} (${advisory})`, () => {
      it(`declares ^${floor} in package.json overrides`, () => {
        expect(pkg.overrides?.[name]).toBe(`^${floor}`);
      });

      it(`resolves every lockfile entry to >= ${floor}`, () => {
        const versions = resolvedVersions(name);
        // Always assert presence: a pinned package that stops resolving means
        // this guard silently stopped guarding, which is the exact failure mode
        // it exists to catch.
        expect(versions.length, `${name} is pinned but resolves nowhere`).toBeGreaterThan(0);
        for (const v of versions) {
          expect(gte(v, floor), `${name} ${v} is below ${floor}`).toBe(true);
        }
      });
    });
  }
});

// Direct dependencies carry their floor in `dependencies`, which also protects
// installs of the published package (overrides apply only to this repo).
const DIRECT_FLOORS: Pin[] = [
  { name: 'axios', floor: '1.20.0', advisory: 'GHSA-vh66-26gq-q6x8 and the other September 2026 axios advisories (checked 2026-10-02)' },
  { name: 'zod', floor: '4.6.6', advisory: 'GHSA-mrhx-c7xc-m3w5 memory exhaustion on oversized constrained collections (checked 2026-11-07)' },
];

for (const { name, floor, advisory } of DIRECT_FLOORS) {
  describe(`${name} security floor (${advisory})`, () => {
    it('declares the patched version floor in package.json', () => {
      expect(pkg.dependencies?.[name]).toBe(`^${floor}`);
    });

    it(`resolves every ${name} lockfile entry to the patched version or later`, () => {
      const versions = resolvedVersions(name);
      expect(versions.length).toBeGreaterThan(0);
      for (const version of versions) {
        expect(gte(version, floor), `${name} ${version} is below ${floor}`).toBe(true);
      }
    });
  });
}

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
