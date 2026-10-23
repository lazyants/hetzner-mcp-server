# Releasing

Releases ship via the GitHub Release event. Maintainer flow:

1. Bump the version in `package.json` and `server.json` (both `#/version` and `#/packages[0].version`), then run `npm install --package-lock-only` to sync `package-lock.json`. `node scripts/check-versions.mjs` hard-fails unless `package.json#/version` matches `server.json#/packages[0].version`; `server.json#/version` is checked loosely — it may legitimately be *ahead* (registry-only republishes bump just that field), so a stale value passes with a `WARN:` line and no failure. Read the script's output rather than trusting its exit code. `CHANGELOG.md` is not checked at all.
2. Update `CHANGELOG.md`.
3. Commit, and **merge the version bump to `main` before creating the release**. Replace `X.Y.Z` and `<release-pr-number>` below, then create the tag on the checked merge commit and create the release from it:

   ```bash
   V=X.Y.Z && PR=<release-pr-number> &&
     SHA="$(gh pr view "$PR" --json mergeCommit -q .mergeCommit.oid)" && test -n "$SHA" &&
     git fetch origin main && git merge-base --is-ancestor "$SHA" origin/main &&
     PKG="$(git show "$SHA:package.json")" &&
     test "$(printf '%s' "$PKG" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).version')" = "$V" &&
     CL="$(git show "$SHA:CHANGELOG.md")" &&
     printf '%s\n' "$CL" | awk -v v="$V" 'index($0,"## ["v"]")==1{f=1;next} /^## \[/{f=0} /^\[[0-9]+\.[0-9]+\.[0-9]+\]:/{f=0} f' > "/tmp/notes-v$V.md" &&
     grep -q '[^[:space:]]' "/tmp/notes-v$V.md" &&
     git tag -a "v$V" "$SHA" -m "v$V" &&
     git push origin "v$V" &&
     gh release create "v$V" --verify-tag --notes-file "/tmp/notes-v$V.md"
   ```

   **Never run a bare `gh release create vX.Y.Z`.** With no existing tag it places one on the **tip of the default branch**, so running it while the bump is still on a release branch tags the *previous* release's commit. The workflow then publishes whatever version it finds in that commit's `package.json`, and you get a `vX.Y.Z` GitHub Release that silently republishes the old version. The publish workflow now refuses to continue when `GITHUB_REF_NAME` is not `v<package.json version>`, so that exact scenario fails before `npm publish` rather than silently republishing. The sequence above is still required, and guards a case the workflow cannot: the workflow guard only runs once a release already exists, and it passes for any commit carrying the right version — so it catches a *mis-tagged* release, not the *wrong commit* being tagged.

   Each element is load-bearing:

   - **`gh pr view … .mergeCommit.oid`** names the release PR's own squash commit. Do not substitute `git rev-parse origin/main` — that is merely whatever is on `main` at the moment you look, so an unrelated merge landing in the gap gets tagged and shipped instead. `gh` exits 0 and prints nothing for an unmerged PR, hence the explicit `test -n`.
   - **The `&&` chain** stops on the first failure instead of falling through to the irreversible step. Both `git show` calls are assigned to a variable rather than piped directly, so their exit status is actually checked — a pipeline reports only its *last* command's status unless `pipefail` is set, which is not assumed here.
   - **`git merge-base --is-ancestor`** proves the commit is reachable from `main`. Mere existence is not enough — a commit can be present locally because some other branch was fetched.
   - **The version test reads `package.json` out of the target commit**, not the working tree, which would still show the right version while `$SHA` pointed elsewhere.
   - **The `awk`** lifts that version's section out of the commit's `CHANGELOG.md` for `--notes-file`. It stops at the next `## [` heading *or* at the first link-reference definition, because the oldest entry has no heading after it and would otherwise swallow the entire link-reference block. `grep -q` rather than `test -s` guards the result: a section empty apart from its blank line still produces a one-byte file, which `test -s` accepts.
4. The `Publish to npm + MCP Registry` workflow runs automatically: it `npm publish`es with provenance, polls the registry until the tarball is available, then pushes the matching `server.json` to the MCP Registry via `mcp-publisher`.

The workflow skips `npm publish` cleanly if the version is already on npm (cutover guard for releases that were partially published manually).

## npm authentication

Publishing uses **npm Trusted Publishing**: the workflow's GitHub OIDC token (`id-token: write`) is exchanged for a one-shot publish token at runtime. No `NPM_TOKEN` secret needs to live in the repo.

The binding is configured in the npm web UI (package → Trusted Publishers): provider `GitHub Actions`, organization `lazyants`, repository `hetzner-mcp-server`, workflow `publish-registry.yml`.
