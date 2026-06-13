import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

/**
 * Locks the deliberate fleet PRODUCT POLICY (documented in
 * `.claude/agents/tool-developer.md` and `.claude/shared/hetzner-api-reference.md`):
 * NO poll-by-action-id tool and NO global `/actions` polling. Action objects are
 * already returned inline by the action-returning tools, so a get-by-id tool is
 * redundant; Hetzner also deprecated those endpoints.
 *
 * This is policy about tool SHAPE, so a STATIC source-text scan captures it
 * directly — no server build, handler invocation, mocking, or registration-
 * completeness pitfalls. The legit `hetzner_list_<resource>_actions` tools
 * (which GET `/<resource>/{id}/actions`) must NOT be flagged.
 */

const toolsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../tools');

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue; // skip .claude and other dotfiles
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

const toolFiles = collectTsFiles(toolsDir);
const sources = toolFiles.map((f) => ({ file: f, text: readFileSync(f, 'utf8') }));

describe('get_action exclusion policy (static source scan)', () => {
  it('discovers the tool source files (sanity — scan is not silently empty)', () => {
    expect(sources.length).toBeGreaterThanOrEqual(10);
  });

  it('(a) no GET issues a request to a global or per-action-id /actions path', () => {
    // Capture the path template of every hetznerRequest('GET', <path>, ...) call.
    const callRe = /hetznerRequest\(\s*['"]GET['"]\s*,\s*(`[^`]*`|'[^']*'|"[^"]*")/g;
    const violations: string[] = [];

    for (const { file, text } of sources) {
      let m: RegExpExecArray | null;
      while ((m = callRe.exec(text)) !== null) {
        const raw = m[1].slice(1, -1); // strip the surrounding quote/backtick
        const path = raw.split('?')[0]; // drop any ?query before matching
        // Global /actions poll, or a per-action-id segment (`/actions/${...}`).
        if (path === '/actions' || path.includes('/actions/${')) {
          violations.push(`${file}: GET ${raw}`);
        }
      }
    }

    expect(violations, `Forbidden action-poll GET(s):\n${violations.join('\n')}`).toEqual([]);
  });

  it('(b) no forbidden get-by-action-id tool names are registered', () => {
    const nameRe = /registerTool\(\s*['"]([a-z0-9_]+)['"]/g;
    // Names that must never be registered, even though they do not match the
    // get-by-action-id regex below (plural / list forms of the global poll).
    const forbiddenExact = new Set(['hetzner_get_action', 'hetzner_get_actions', 'hetzner_list_actions']);
    const getByActionId = /^hetzner_get_.*_action$/;
    const violations: string[] = [];

    for (const { file, text } of sources) {
      let m: RegExpExecArray | null;
      while ((m = nameRe.exec(text)) !== null) {
        const name = m[1];
        if (getByActionId.test(name) || forbiddenExact.has(name)) {
          violations.push(`${file}: ${name}`);
        }
      }
    }

    expect(violations, `Forbidden action tool name(s):\n${violations.join('\n')}`).toEqual([]);
  });
});
