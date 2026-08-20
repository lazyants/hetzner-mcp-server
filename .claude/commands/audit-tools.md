# Audit Tools

Systematically verify all MCP tools follow project conventions.

## Run These Checks

### 1. Tool naming — all must use `hetzner_` prefix
```bash
rg -Un "registerTool\(\s*'(?!hetzner_)" src/tools/*.ts
```
Expected: no output (all tools have prefix)

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
Enumerate per-file counts and confirm each `src/tools/*.ts` file registers at least one tool. The authoritative grand total is asserted in `src/tests/smoke.test.ts` — do NOT hardcode a number here; it goes stale on every tool-adding PR. To check the current expected total, read the smoke assertion:
```bash
grep -nE "registers .* tools" src/tests/smoke.test.ts
```
The per-file counts grepped above should sum to that number.

### 5. All tool files wired into entry points
```bash
for f in src/tools/*.ts; do
  base=$(basename "$f" .ts)
  if ! grep -q "$base" src/index.ts; then
    echo "NOT WIRED: $f missing from src/index.ts"
  fi
done
```
Expected: no output

### 6. Description length check (flag >40 words)
```bash
grep -oP "description: '[^']*'" src/tools/*.ts | awk -F"'" '{n=split($2,a," "); if(n>40) print FILENAME": "n" words: "$2}'
```

### 7. All handlers use try/catch with toolError
```bash
grep -cP "toolError" src/tools/*.ts
```
Every file should have at least as many `toolError` calls as `registerTool` calls.

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
