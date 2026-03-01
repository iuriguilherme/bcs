---
title: "Resolving Git Rebase Conflicts in the Auto-Generated index.html Bundle"
date: 2026-03-01
problem_type: build_error
component: git-workflow / build-system
symptoms:
  - "CONFLICT (content): Merge conflict in index.html at every commit during rebase"
  - "Source files (src/, intention.js, atom.js) auto-merge cleanly; only index.html conflicts"
  - "Rebase stops at each of N commits with the same error"
  - "git rebase --continue immediately hits the same error again if bundle is not rebuilt"
affected_files:
  - index.html
  - build.ts
tags:
  - git-rebase
  - bundle-generation
  - build-conflicts
  - index-html
  - deno-build
  - github-pages
related_tools: [git, deno]
---

# Resolving Git Rebase Conflicts in the Auto-Generated index.html Bundle

## Overview

When rebasing a feature branch onto main after another PR has landed, git reports a conflict
in `index.html` at every commit being replayed. The source files auto-merge cleanly — only
the auto-generated bundle conflicts. This is expected behaviour, not a real code conflict.

**Root cause:** Both branches ran `deno run --allow-read --allow-write --allow-run build.ts`
after making source changes. The resulting 630 KB `index.html` bundles differ throughout (version
strings, timestamps, concatenated source content), so git cannot automatically merge them.

---

## Why This Happens

`build.ts` concatenates 26 JavaScript source files in strict dependency order, embeds `index.css`
inline, and writes the complete application into `index.html`. The resulting bundle includes:

- All 26 source file contents concatenated in order
- A generated timestamp (`Generated: YYYY-MM-DDTHH:MM:SS.sssZ`)
- A version string derived from `git describe --tags --always`
- CSS from `index.css` embedded in a `<style>` block
- HTML body extracted from `dev.html`

When two branches independently modify any source file and rebuild, their bundles diverge
throughout the full 630 KB file. Git sees a line-by-line content conflict spanning thousands
of lines — not just the lines that actually changed.

**Why `index.html` must be tracked in git:** GitHub Pages serves the repository root directly.
If `index.html` is not committed, the production site would show a 404. This means the
auto-generated file must stay tracked despite causing rebase friction.

---

## The `--theirs`/`--ours` Direction Trap

During `git rebase main`, the terminology reverses from what merge direction suggests:

```
Feature:  A -- B -- C   (commits to replay)
                /
Main:     X -- Y -- Z   (the new base)
```

When replaying commit B onto Z:
- **`--theirs`** = **Z** (the rebase target / main HEAD) ← use this for index.html
- **`--ours`**   = **B** (the feature commit being replayed)

This is backwards from what most developers expect. During `git rebase`, `--theirs` is the
branch you're rebasing *onto*, not the feature branch. Taking `--ours` would keep the feature
branch's stale bundle and discard main's latest state.

---

## Solution: Accept Rebase HEAD, Then Rebuild

At each conflicting commit during rebase, apply this 4-step pattern:

```bash
# 1. Discard the bundle conflict — accept the rebase target's (main's) version
git checkout --theirs index.html

# 2. Rebuild from the NOW-MERGED source files of this commit
deno run --allow-read --allow-write --allow-run build.ts

# 3. Stage the freshly built bundle
git add index.html

# 4. Replay the next commit
git rebase --continue
```

Repeat for every commit until git reports:
```
Successfully rebased and updated refs/heads/feature-branch-name.
```

### Why rebuilding after checkout is essential

Taking `--theirs` alone preserves main's bundle, which was built from main's source state.
If the current commit modified source files, those changes are not reflected in main's bundle.
The rebuild generates a bundle that matches **all sources at the current rebased commit**,
keeping bundle and source files synchronized throughout the rebase.

### Actual session: 3 commits, each resolved the same way

```bash
$ git rebase main
Auto-merging src/entities/intention.js   ← clean auto-merge
CONFLICT (content): Merge conflict in index.html
Rebasing (1/3) error: could not apply 203f369...

$ git checkout --theirs index.html && \
  deno run --allow-read --allow-write --allow-run build.ts && \
  git add index.html && git rebase --continue
Updated 1 path from the index
Build complete: ./index.html  Version: v0.24.1-8-g55fb139  Total size: 615.3 KB
[detached HEAD 4edf15c] fix: resolve intention display bugs...

Auto-merging src/entities/intention.js   ← clean again
CONFLICT (content): Merge conflict in index.html
Rebasing (2/3) error: could not apply da3e45e...

$ git checkout --theirs index.html && \
  deno run --allow-read --allow-write --allow-run build.ts && \
  git add index.html && git rebase --continue
Updated 1 path from the index
Build complete: ./index.html  Version: v0.24.1-9-g4edf15c  Total size: 615.6 KB
[detached HEAD ec3cff6] refactor: address code review findings...

CONFLICT (content): Merge conflict in index.html
Rebasing (3/3) error: could not apply 9f17d48...

$ git checkout --theirs index.html && \
  deno run --allow-read --allow-write --allow-run build.ts && \
  git add index.html && git rebase --continue
Updated 1 path from the index
Build complete: ./index.html  Version: v0.24.1-10-gec3cff6  Total size: 616.2 KB
Successfully rebased and updated refs/heads/fix/intention-display-bugs.
```

---

## Detecting a Bundle-Only Conflict (Safe to Auto-Rebuild)

The rebuild approach is safe when **only `index.html` is conflicted** and source files merged
cleanly. Verify before applying:

```bash
git diff --name-only --diff-filter=U   # Shows only unresolved files
# Should output only: index.html
```

**Red flags requiring manual resolution:**
- `src/` files also appear as conflicted (`both modified`)
- The conflict contains real logic differences, not just version/timestamp strings
- `dev.html` or `index.css` are conflicted

For real source conflicts: resolve those files first, then apply the bundle rebuild pattern for
`index.html`.

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why It Breaks |
|---|---|
| `git checkout --ours index.html` | Keeps feature branch's stale bundle; new source changes from main are missing |
| `git checkout --theirs index.html` without rebuilding | Main's old bundle doesn't include this commit's source changes |
| Manually editing conflict markers in `index.html` | 630 KB of concatenated code is not hand-mergeable; syntax errors likely |
| Committing source changes without rebuilding the bundle | `dev.html` and `index.html` diverge; production site runs old code |

---

## Prevention

### Immediate (workflow discipline)

Before pushing a feature branch, always sync with main and rebuild:

```bash
git pull origin main          # Get latest main
deno run --allow-read --allow-write --allow-run build.ts  # Rebuild bundle
git add index.html && git commit -m "chore: rebuild bundle from main"
git push
```

This minimizes divergence. If main receives unrelated changes, conflicts still appear —
but only at the final rebase step, not at every commit.

### Safe rebase checklist

- [ ] `git status` is clean (no uncommitted changes)
- [ ] Last feature-branch commit includes a fresh `index.html` build
- [ ] `git fetch origin` shows latest main
- [ ] Backup branch created: `git branch feature-backup` (optional)
- [ ] At each conflict: confirm **only** `index.html` is listed by `git diff --name-only --diff-filter=U`
- [ ] Apply 4-step pattern (checkout → rebuild → add → continue) for each conflict
- [ ] After rebase completes: run full test suite (`npm test`) against both `dev.html` and `index.html`

### Long-term (`.gitattributes` merge driver)

Register a custom merge driver that auto-rebuilds `index.html` on every conflict:

```
# .gitattributes
index.html merge=bundle-rebuild
```

```ini
# .git/config (or global gitconfig)
[merge "bundle-rebuild"]
    driver = bash -c 'cp "$3" "$1" && deno run --allow-read --allow-write --allow-run build.ts'
    name = Rebuild bundle after merge
```

With this in place, `git rebase` resolves `index.html` conflicts automatically at each step —
no manual intervention needed. The driver copies the rebase HEAD version (equivalent to
`--theirs`) and immediately rebuilds from merged sources.

---

## Why `index.html` Cannot Be Gitignored

GitHub Pages serves static files directly from the repository root. Gitignoring `index.html`
would cause a 404 for all production users. The file must stay tracked. See also:
**CLAUDE.md → "Critical: The Bundle Problem"**.

The trade-off is intentional: committing the bundle creates occasional rebase friction but
ensures GitHub Pages always serves the correct, up-to-date application with no CI pipeline
required.

---

## Related Documentation

- **CLAUDE.md "Critical: The Bundle Problem"** — why `index.html` must stay committed alongside source changes
- **CLAUDE.md "Critical: Git Safety Rules"** — safe alternatives to destructive git commands
- **`build.ts`** — the build script; see `scriptOrder` array for file concatenation sequence
- **[`docs/solutions/build-errors/`](./)** — this file; no prior build-error solutions existed
