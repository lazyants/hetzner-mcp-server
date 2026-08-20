# Audit Tools

Systematically verify all MCP tools follow project conventions.

## Run These Checks

### 1. Tool naming — all must use `hetzner_` prefix
```bash
rg -Un --pcre2 "registerTool\(\s*'(?!hetzner_)" src/tools/*.ts
```
Expected: no output (all tools have prefix). **`--pcre2` is required** — the default regex engine
has no look-around and exits with a parse error without it.

### 2. No `.strict()` on Zod schemas
```bash
grep -rn "\.strict()" src/tools/*.ts src/schemas/*.ts
```
Expected: no output

### 3. All imports use `.js` extension
```bash
grep -rn "from '\.\." src/tools/*.ts src/services/*.ts src/schemas/*.ts | grep -v "\.js'"
```
Expected: no output

### 4. Tool counts per file
```bash
grep -c "server\.registerTool" src/tools/*.ts
```
Enumerate per-file counts. **A zero is not automatically a fault:** `src/tools/storage-boxes.ts` is
an intentional *aggregate registrar* — it registers nothing itself and delegates to
`storage-boxes-{core,snapshots,subaccounts}.ts`. Treat a zero as a finding only if the file also has
no delegating imports:
```bash
for f in src/tools/*.ts; do
  n=$(grep -c "server\.registerTool" "$f")
  if [ "$n" = "0" ] && ! grep -q "^import { register" "$f"; then
    echo "NO TOOLS AND NO DELEGATION: $f"
  fi
done
```
The authoritative grand total is asserted in `src/tests/smoke.test.ts` — do NOT hardcode a number
here; it goes stale on every tool-adding PR. Read it instead:
```bash
grep -nE "TOTAL_TOOL_COUNT.*toBe" src/tests/smoke.test.ts
```
The per-file counts should sum to that number.

### 5. All tool files wired into entry points
Wiring lives in `src/splits.ts`, **not** `src/index.ts` — the entries consume `ALL_REGISTRARS` /
`SPLITS` and import no registrar directly, so checking `src/index.ts` reports every module as
unwired:
A module is wired if `src/splits.ts` names it directly, **or** if another tool file imports it (the
`storage-boxes-*.ts` trio reaches `splits.ts` through the `storage-boxes.ts` aggregate registrar):
```bash
for f in src/tools/*.ts; do
  base=$(basename "$f" .ts)
  grep -q "$base" src/splits.ts && continue
  grep -q "from './$base.js'" src/tools/*.ts && continue
  echo "NOT WIRED: $f — absent from src/splits.ts and imported by no tool module"
done
```
Expected: no output.

### 6. Description length check (flag >40 words)
```bash
grep -oP "description: '[^']*'" src/tools/*.ts | awk -F"'" '{n=split($2,a," "); if(n>40) print FILENAME": "n" words: "$2}'
```

### 7. All handlers go through `handleToolRequest()`
`toolError()` and `formatResponse()` are called *by* `handleToolRequest()`; no tool file calls
`toolError` itself, so counting it reports zero for all 185 tools. Check the wrapper instead — every
`registerTool` should have a matching `handleToolRequest`:
```bash
for f in src/tools/*.ts; do
  r=$(grep -c "server\.registerTool" "$f"); h=$(grep -c "handleToolRequest" "$f")
  [ "$r" -gt "$h" ] && echo "$f: $r registerTool vs $h handleToolRequest"
done
```
Expected: no output. A bare try/catch with `toolError()` in a tool file is itself a finding — it
duplicates the shared wrapper.

### 8. Build check
```bash
npm run build
```
Expected: zero errors

### 9. Test check
```bash
npm test
```
Expected: all tests pass
